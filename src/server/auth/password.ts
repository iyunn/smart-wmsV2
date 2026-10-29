import bcrypt from "bcryptjs";
import { BCRYPT_COST } from "./policy";

// Hash & verifikasi password (bcryptjs: pure JS, tanpa kompilasi native di Windows).
// Kompatibel dengan hash Supabase V1 ($2a$10$...).

/** Hash pembanding untuk menyamakan waktu respons saat username tidak ditemukan (anti user-enumeration). */
const DUMMY_HASH = bcrypt.hashSync("smartwms-dummy-password", BCRYPT_COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * true bila cocok. Hash null/rusak (mis. akun tanpa password "!") → false, tapi tetap
 * menjalankan satu perbandingan bcrypt agar waktunya sama dengan kasus normal.
 */
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const usable = typeof hash === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
  try {
    const ok = await bcrypt.compare(password, usable ? hash : DUMMY_HASH);
    return usable && ok;
  } catch {
    return false;
  }
}

/** true bila hash perlu dibuat ulang dengan biaya sekarang (hash lama lebih lemah). */
export function needsRehash(hash: string): boolean {
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COST;
  } catch {
    return false;
  }
}
