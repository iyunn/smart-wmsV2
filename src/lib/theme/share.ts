// ══════════════════════════════════════════════════════════════════════════
// Bagikan warna tampilan (Tahap 9b): ekspor ke file/teks JSON dan impor kembali.
// Format: { "format": "smartwms-tema", "version": 1, "theme": { light?, dark? } }
// Impor juga menerima objek tema polos ({ light?, dark? }). Semua isi disaring
// `sanitizeCustomTheme` → hanya 18 kunci yang dikenal dengan nilai #RRGGBB; sisanya dibuang.
// ══════════════════════════════════════════════════════════════════════════

import { type CustomTheme, sanitizeCustomTheme } from "./custom";

export const SHARE_FORMAT = "smartwms-tema";
export const SHARE_VERSION = 1;
/** Batas ukuran teks impor (tema lengkap ±1,5 KB) — cegah file salah/besar membebani browser. */
export const MAX_IMPORT_CHARS = 20_000;

export function exportTheme(theme: CustomTheme | null): string {
  return JSON.stringify({ format: SHARE_FORMAT, version: SHARE_VERSION, theme: theme ?? {} }, null, 2);
}

export type ImportResult = { ok: true; theme: CustomTheme | null } | { ok: false; error: string };

export function parseThemeImport(text: string): ImportResult {
  const raw = text.trim();
  if (!raw) return { ok: false, error: "Kode warna kosong." };
  if (raw.length > MAX_IMPORT_CHARS) return { ok: false, error: "Isi terlalu besar — bukan file warna SmartWMS." };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Bukan kode warna yang valid (format JSON rusak)." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Bukan kode warna SmartWMS." };
  }
  const obj = data as Record<string, unknown>;
  const wrapped = "format" in obj || "theme" in obj;
  if (wrapped && obj.format !== SHARE_FORMAT) return { ok: false, error: "Bukan kode warna SmartWMS." };
  if (wrapped && typeof obj.version === "number" && obj.version > SHARE_VERSION) {
    return { ok: false, error: "Kode warna dari versi aplikasi yang lebih baru." };
  }
  const src = wrapped ? obj.theme : obj;
  if (!src || typeof src !== "object" || Array.isArray(src)) return { ok: false, error: "Bukan kode warna SmartWMS." };
  const s = src as Record<string, unknown>;
  // Objek polos wajib punya light/dark; versi berbungkus boleh kosong (= ekspor warna bawaan)
  if (!wrapped && !("light" in s) && !("dark" in s)) return { ok: false, error: "Bukan kode warna SmartWMS." };
  // Tema kosong ({}) valid = warna bawaan
  return { ok: true, theme: sanitizeCustomTheme(src) };
}
