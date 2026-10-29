import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { LOCK_MINUTES, MAX_FAILED_LOGINS } from "./policy";
import { createSession, deleteExpiredSessions, type SessionMeta } from "./session";

// ══════════════════════════════════════════════════════════════════════════
// Login dengan email ATAU username + password.
// Urutan pemeriksaan sengaja sama dengan V1: status akun (pending/rejected) baru
// diberitahukan SETELAH password terbukti benar → orang yang tidak tahu password
// tidak bisa mengetahui status sebuah akun.
// ══════════════════════════════════════════════════════════════════════════

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; userId: string; mustChangePassword: boolean }
  | { ok: false; reason: "invalid" }                       // identitas/password salah (tidak dibedakan)
  | { ok: false; reason: "locked"; until: Date }           // terlalu banyak percobaan gagal
  | { ok: false; reason: "pending" | "rejected" };         // password benar, akun belum/tidak aktif

export async function authenticate(identifier: string, password: string, meta: SessionMeta = {}): Promise<LoginResult> {
  const id = identifier.trim().toLowerCase();
  if (!id || !password) return { ok: false, reason: "invalid" };

  const user = await db
    .selectFrom("app_users")
    .select(["id", "password_hash", "status", "locked_until", "must_change_password"])
    .where((eb) => eb.or([eb(sql`lower(email)`, "=", id), eb(sql`lower(username)`, "=", id)]))
    .executeTakeFirst();

  if (!user) {
    await verifyPassword(password, null); // samakan waktu respons
    return { ok: false, reason: "invalid" };
  }

  if (user.locked_until && user.locked_until.getTime() > Date.now()) {
    return { ok: false, reason: "locked", until: user.locked_until };
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    // Atomik: hitung gagal; saat mencapai batas → kunci & reset hitungan.
    const r = await db
      .updateTable("app_users")
      .set({
        failed_login_count: sql`case when failed_login_count + 1 >= ${MAX_FAILED_LOGINS} then 0 else failed_login_count + 1 end`,
        locked_until: sql`case when failed_login_count + 1 >= ${MAX_FAILED_LOGINS}
                               then now() + make_interval(mins => ${LOCK_MINUTES}) else locked_until end`,
      })
      .where("id", "=", user.id)
      .returning("locked_until")
      .executeTakeFirst();
    if (r?.locked_until && r.locked_until.getTime() > Date.now()) {
      return { ok: false, reason: "locked", until: r.locked_until };
    }
    return { ok: false, reason: "invalid" };
  }

  // Password benar.
  const upgrade = needsRehash(user.password_hash) ? await hashPassword(password) : null;
  await db
    .updateTable("app_users")
    .set({
      failed_login_count: 0,
      locked_until: null,
      ...(upgrade ? { password_hash: upgrade } : {}),
      ...(user.status === "active" ? { last_login_at: new Date() } : {}),
    })
    .where("id", "=", user.id)
    .execute();

  if (user.status === "pending" || user.status === "rejected") {
    return { ok: false, reason: user.status };
  }

  await deleteExpiredSessions();
  const session = await createSession(user.id, meta);
  return { ok: true, ...session, userId: user.id, mustChangePassword: user.must_change_password };
}
