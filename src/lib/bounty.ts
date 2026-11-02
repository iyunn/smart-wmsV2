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

// ── Tagih lewat WhatsApp ──────────────────────────────────────────────────
export interface WaItem {
  as_inisial: string;
  jenis: string;
  qty: number;
  qty_selesai: number;
  tanggal: string;               // YYYY-MM-DD
  keterangan: string;
  tujuan: { kode: string; nama: string } | null;
}

export function tglIndo(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

interface WaGroup { as: string; list: WaItem[]; sisa: number; bounty: number }

/** Utang belum lunas dikelompokkan per AS, urut bounty terbesar (dipakai pesan WA & Excel). */
export function groupOpenByAs(items: WaItem[]): WaGroup[] {
  const byAs = new Map<string, WaItem[]>();
  for (const it of items) if (sisaBarang(it) > 0) byAs.set(it.as_inisial, [...(byAs.get(it.as_inisial) ?? []), it]);
  return [...byAs.entries()]
    .map(([as, list]) => ({
      as,
      list: list.sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
      sisa: list.reduce((n, it) => n + sisaBarang(it), 0),
      bounty: nilaiBounty(list),
    }))
    .sort((a, b) => b.bounty - a.bounty || a.as.localeCompare(b.as));
}

/** Umur utang dalam hari (tanggal WIB). */
export function umurHari(tanggal: string, today = todayWib()): number {
  return Math.max(0, Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(tanggal + "T00:00:00Z")) / 86_400_000));
}

/**
 * Teks tagihan WhatsApp DETAIL untuk utang yang BELUM lunas, per AS (urut bounty terbesar) — pas untuk
 * chat pribadi ke satu AS (pilih AS di list Wanted dulu). Untuk banyak AS sekaligus pakai Export Excel.
 * Format WhatsApp: *tebal*, _miring_. Kosong → "".
 */
export function buildWaMessage(items: WaItem[], today = todayWib()): string {
  const groups = groupOpenByAs(items);
  if (groups.length === 0) return "";
  const lines: string[] = ["*BOUNTY HUNTER — Barang belum kembali*", `_Per ${tglIndo(today)}_`, ""];
  for (const g of groups) {
    lines.push(`*AS ${g.as}* — ${g.sisa} barang · bounty *${formatRupiah(g.bounty)}*`);
    g.list.forEach((it, i) => {
      const s = sisaBarang(it);
      const qty = it.qty_selesai > 0 ? `${s} dari ${it.qty} (${it.qty_selesai} sudah kembali)` : `${s}`;
      const toko = it.tujuan ? ` · ${it.tujuan.kode} ${it.tujuan.nama}`.trimEnd() : "";
      const d = umurHari(it.tanggal, today);
      lines.push(`${i + 1}. ${it.jenis} × ${qty}${toko}`);
      lines.push(`    sejak ${tglIndo(it.tanggal)} (${d === 0 ? "hari ini" : `${d} hari`})${it.keterangan ? ` — ${it.keterangan}` : ""}`);
    });
    lines.push("");
  }
  if (groups.length > 1) lines.push(`*Total bounty: ${formatRupiah(groups.reduce((n, g) => n + g.bounty, 0))}*`, "");
  lines.push("Mohon segera dikembalikan ke GA CGA ya 🙏");
  return lines.join("\n");
}

/** Link WhatsApp (pilih kontak/grup di aplikasi). Teks panjang tetap aman: dienkode penuh. */
export function waLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
