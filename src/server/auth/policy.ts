// ══════════════════════════════════════════════════════════════════════════
// Aturan keamanan auth di satu tempat (ARCHITECTURE D-05, §6). Tanpa dependency
// ke database/Next.js supaya bisa diuji unit.
// ══════════════════════════════════════════════════════════════════════════

/** Biaya bcrypt untuk hash baru. Hash lama (Supabase: 10) dinaikkan otomatis saat login berhasil. */
export const BCRYPT_COST = 12;

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt hanya memakai 72 byte pertama — password lebih panjang ditolak agar tidak "terpotong diam-diam". */
export const PASSWORD_MAX_BYTES = 72;

/** Setelah sekian kali gagal berturut-turut, akun dikunci sementara. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 10;

/** Lama sesi tanpa aktivitas. Diperpanjang otomatis saat dipakai (sliding) bila sisa < separuh. */
export function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 12);
  return (Number.isFinite(hours) && hours > 0 ? hours : 12) * 60 * 60 * 1000;
}

export type PasswordProblem = "too_short" | "too_long";

export function checkPasswordStrength(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "too_short";
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "too_long";
  return null;
}
