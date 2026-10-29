import { createHash, randomBytes } from "node:crypto";

// Token sesi: 32 byte acak (256 bit) → base64url di cookie. Database hanya menyimpan
// SHA-256-nya, jadi isi tabel user_sessions tidak bisa dipakai untuk login.

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Bentuk token yang sah: 43 karakter base64url. Menolak input aneh sebelum menyentuh database. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
