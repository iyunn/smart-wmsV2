import "server-only";
import { type Transaction, sql } from "kysely";
import { db } from "@/server/db";
import type { DB } from "@/server/db/types";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeUserSessions } from "@/server/auth/session";
import { generateTempPassword } from "./temp-password";

// ══════════════════════════════════════════════════════════════════════════
// Manajemen akun (Tahap 3c). Semua aturan pengaman ada DI SINI, bukan di UI:
//   - Super Admin tidak bisa mengubah role/status, me-reset, atau menghapus akunnya sendiri
//   - Super Admin aktif TERAKHIR tidak bisa diturunkan, dinonaktifkan, atau dihapus
//     (dicek di dalam transaksi dengan FOR UPDATE → aman bila dua admin klik bersamaan)
//   - Nonaktif / reset password → semua sesi user itu dicabut
// ══════════════════════════════════════════════════════════════════════════

export class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type Role = "super_admin" | "admin";
export type Status = "pending" | "active" | "rejected";

export async function listUsers() {
  const rows = await db
    .selectFrom("app_users")
    .select([
      "id", "username", "nik", "email", "role", "status", "created_at", "last_login_at",
      "must_change_password", "locked_until",
    ])
    .orderBy("created_at", "desc")
    .execute();
  const now = Date.now();
  return rows.map(({ locked_until, ...u }) => ({
    ...u,
    locked: locked_until !== null && locked_until.getTime() > now,
  }));
}

const isUniqueViolation = (err: unknown) => (err as { code?: string }).code === "23505";

/** Akun dibuat Super Admin: langsung aktif, password awal dari Super Admin, wajib diganti saat login. */
export async function createUser(input: { username: string; nik: string; email: string; password: string; role: Role }) {
  try {
    const row = await db
      .insertInto("app_users")
      .values({
        username: input.username,
        nik: input.nik,
        email: input.email,
        password_hash: await hashPassword(input.password),
        role: input.role,
        status: "active",
        must_change_password: true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  } catch (err) {
    if (isUniqueViolation(err)) throw new UserError("Email atau username sudah terdaftar.", 409);
    throw err;
  }
}

/**
 * Kunci target + semua Super Admin aktif dalam SATU query berurutan id, lalu cek aturan
 * "Super Admin terakhir". Satu query berurutan = urutan kunci selalu sama di semua transaksi,
 * jadi dua Super Admin yang saling menurunkan role bersamaan tidak deadlock: yang kedua
 * menunggu, lalu melihat kondisi terbaru (READ COMMITTED mengevaluasi ulang baris terkunci).
 */
async function guardTarget(trx: Transaction<DB>, actorId: string, targetId: string, action: string) {
  if (actorId === targetId) {
    throw new UserError(`Tidak bisa ${action} akun sendiri. Minta Super Admin lain.`, 400);
  }
  const rows = await trx
    .selectFrom("app_users")
    .select(["id", "role", "status"])
    .where((eb) =>
      eb.or([eb("id", "=", targetId), eb.and([eb("role", "=", "super_admin"), eb("status", "=", "active")])]),
    )
    .orderBy("id")
    .forUpdate()
    .execute();

  const target = rows.find((r) => r.id === targetId);
  if (!target) throw new UserError("User tidak ditemukan.", 404);
  const activeSuperAdmins = rows.filter((r) => r.role === "super_admin" && r.status === "active");
  const isLastSuperAdmin =
    target.role === "super_admin" && target.status === "active" && activeSuperAdmins.length <= 1;
  return { target, isLastSuperAdmin };
}

export async function updateUser(actorId: string, targetId: string, patch: { role?: Role; status?: Status }) {
  if (!patch.role && !patch.status) throw new UserError("Tidak ada perubahan.", 400);

  await db.transaction().execute(async (trx) => {
    const { target, isLastSuperAdmin } = await guardTarget(trx, actorId, targetId, "mengubah");
    const demoting = patch.role === "admin" && target.role === "super_admin";
    const deactivating = patch.status !== undefined && patch.status !== "active" && target.status === "active";
    if (isLastSuperAdmin && (demoting || deactivating)) {
      throw new UserError("Ini Super Admin aktif terakhir — jadikan user lain Super Admin dulu.", 409);
    }
    await trx
      .updateTable("app_users")
      .set({ ...patch, updated_at: new Date() })
      .where("id", "=", targetId)
      .execute();
  });

  if (patch.status && patch.status !== "active") await revokeUserSessions(targetId);
}

export async function deleteUser(actorId: string, targetId: string) {
  await db.transaction().execute(async (trx) => {
    const { isLastSuperAdmin } = await guardTarget(trx, actorId, targetId, "menghapus");
    if (isLastSuperAdmin) {
      throw new UserError("Ini Super Admin aktif terakhir — tidak bisa dihapus.", 409);
    }
    // user_sessions ikut terhapus (ON DELETE CASCADE)
    await trx.deleteFrom("app_users").where("id", "=", targetId).execute();
  });
}

/** Reset oleh Super Admin → password sementara (ditampilkan SEKALI), buka kunci, cabut semua sesi. */
export async function resetPassword(actorId: string, targetId: string): Promise<string> {
  if (actorId === targetId) {
    throw new UserError("Untuk akun sendiri, pakai menu Ganti Password.", 400);
  }
  const temp = generateTempPassword();
  const r = await db
    .updateTable("app_users")
    .set({
      password_hash: await hashPassword(temp),
      must_change_password: true,
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date(),
    })
    .where("id", "=", targetId)
    .executeTakeFirst();
  if (Number(r.numUpdatedRows) === 0) throw new UserError("User tidak ditemukan.", 404);
  await revokeUserSessions(targetId);
  return temp;
}

/** Ganti password sendiri. Sesi lain dicabut; sesi yang sedang dipakai tetap. */
export async function changeOwnPassword(userId: string, current: string, next: string, keepToken?: string) {
  const user = await db
    .selectFrom("app_users")
    .select("password_hash")
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user || !(await verifyPassword(current, user.password_hash))) {
    throw new UserError("Password sekarang salah.", 400);
  }
  if (current === next) throw new UserError("Password baru harus berbeda dari password sekarang.", 400);

  await db
    .updateTable("app_users")
    .set({
      password_hash: await hashPassword(next),
      must_change_password: false,
      updated_at: sql`now()`,
    })
    .where("id", "=", userId)
    .execute();
  await revokeUserSessions(userId, keepToken);
}
