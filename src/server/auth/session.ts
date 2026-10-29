import "server-only";
import { db } from "@/server/db";
import { sessionTtlMs } from "./policy";
import { generateSessionToken, hashSessionToken, isWellFormedToken } from "./tokens";

// ══════════════════════════════════════════════════════════════════════════
// Sesi login disimpan di tabel user_sessions (ARCHITECTURE D-05).
// - Token acak hanya ada di cookie; database menyimpan SHA-256-nya.
// - Sliding expiry: setiap dipakai dan sisa waktu < separuh TTL → diperpanjang.
// - Sesi otomatis tidak berlaku bila akun tidak lagi `active` (dinonaktifkan/di-reject).
// Cookie ditangani di Tahap 3b; modul ini hanya urusan database.
// ══════════════════════════════════════════════════════════════════════════

/** Data user yang aman dikirim ke aplikasi (tanpa password_hash & penghitung login). */
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  nik: string;
  role: "super_admin" | "admin";
  status: "pending" | "active" | "rejected";
  theme: "dark" | "light";
  mustChangePassword: boolean;
}

export interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

export async function createSession(userId: string, meta: SessionMeta = {}) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await db
    .insertInto("user_sessions")
    .values({
      id: hashSessionToken(token),
      user_id: userId,
      expires_at: expiresAt,
      user_agent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
    })
    .execute();
  return { token, expiresAt };
}

/** Kembalikan user pemilik sesi, atau null bila token tidak sah / kedaluwarsa / akun tidak aktif. */
export async function validateSession(
  token: unknown,
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
  if (!isWellFormedToken(token)) return null;
  const id = hashSessionToken(token);

  const row = await db
    .selectFrom("user_sessions as s")
    .innerJoin("app_users as u", "u.id", "s.user_id")
    .select([
      "s.expires_at", "u.id", "u.email", "u.username", "u.nik", "u.role", "u.status", "u.theme",
      "u.must_change_password",
    ])
    .where("s.id", "=", id)
    .executeTakeFirst();
  if (!row) return null;

  const now = Date.now();
  if (row.expires_at.getTime() <= now || row.status !== "active") {
    await db.deleteFrom("user_sessions").where("id", "=", id).execute();
    return null;
  }

  let expiresAt = row.expires_at;
  const ttl = sessionTtlMs();
  if (expiresAt.getTime() - now < ttl / 2) {
    expiresAt = new Date(now + ttl);
    await db
      .updateTable("user_sessions")
      .set({ expires_at: expiresAt, last_seen_at: new Date(now) })
      .where("id", "=", id)
      .execute();
  }

  return {
    expiresAt,
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      nik: row.nik,
      role: row.role as SessionUser["role"],
      status: row.status as SessionUser["status"],
      theme: row.theme as SessionUser["theme"],
      mustChangePassword: row.must_change_password,
    },
  };
}

export async function revokeSession(token: unknown): Promise<void> {
  if (!isWellFormedToken(token)) return;
  await db.deleteFrom("user_sessions").where("id", "=", hashSessionToken(token)).execute();
}

/** Cabut semua sesi user (mis. setelah ganti/reset password, dinonaktifkan). `exceptToken` = sesi yang tetap dipertahankan. */
export async function revokeUserSessions(userId: string, exceptToken?: string): Promise<number> {
  let q = db.deleteFrom("user_sessions").where("user_id", "=", userId);
  if (exceptToken && isWellFormedToken(exceptToken)) {
    q = q.where("id", "<>", hashSessionToken(exceptToken));
  }
  const r = await q.executeTakeFirst();
  return Number(r.numDeletedRows);
}

/** Bersihkan sesi kedaluwarsa (dipanggil sesekali saat login). */
export async function deleteExpiredSessions(): Promise<void> {
  await db.deleteFrom("user_sessions").where("expires_at", "<", new Date()).execute();
}
