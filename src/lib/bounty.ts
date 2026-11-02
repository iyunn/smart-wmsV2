// ══════════════════════════════════════════════════════════════════════════
// Bounty Hunter (ROADMAP 9e, ARCHITECTURE D-39) — aturan murni, dipakai server & halaman.
// Nilai bounty TIDAK disimpan: selalu dihitung = BOUNTY_PER_BARANG × sisa barang belum kembali.
// ══════════════════════════════════════════════════════════════════════════

/** Rp per 1 barang yang belum kembali (keputusan Fillian 2 Nov 2026). */
export const BOUNTY_PER_BARANG = 10_000;

/** Inisial AS: dirapikan (spasi ganda, huruf besar) — "  jto " → "JTO". */
export function normalizeInisial(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Sama dengan constraint bounty_as_inisial_check di migrasi 0005. */
export const INISIAL_PATTERN = /^[A-Z0-9][A-Z0-9 ._-]{0,15}$/;

export function sisaBarang(it: { qty: number; qty_selesai: number }): number {
  return Math.max(0, it.qty - it.qty_selesai);
}

export function nilaiBounty(items: { qty: number; qty_selesai: number }[]): number {
  return items.reduce((n, it) => n + sisaBarang(it), 0) * BOUNTY_PER_BARANG;
}

export function formatRupiah(n: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID").format(n);
}

/** Tanggal hari ini di WIB (YYYY-MM-DD) — database berjalan UTC (D-22), jadi jangan pakai current_date. */
export function todayWib(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}
