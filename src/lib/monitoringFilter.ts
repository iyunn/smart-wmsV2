// ══════════════════════════════════════════════════════════════════════════
// Filter Monitoring DAT — dipakai halaman /monitoring (tabel, Export Excel) DAN server
// (Export PDF /api/reports/dat-summary), supaya PDF selalu berisi data yang sama dengan
// yang tampil di layar. Murni (tanpa React / database) — diuji di monitoringFilter.test.ts.
//
// Flag: tag "kolom: kata" dengan logika AND antar tag (cocok bila kolom MENGANDUNG kata,
// tanpa beda huruf besar/kecil). Selain lewat dropdown kolom, flag bisa diketik langsung:
//   jenis:printer ink jet;merk:canon   → 2 flag: Jenis "printer ink jet" + Merk "canon"
// ══════════════════════════════════════════════════════════════════════════

export type CostCenter = "ALL" | "CGA1" | "CGA2" | "CGA3";
export type SearchField = "all" | "jenis" | "merk" | "kode_asset" | "kategori_oracle" | "deskripsi" | "invoice_number" | "catatan";
export type TagField = Exclude<SearchField, "all">;

export interface FilterTag { field: TagField; value: string }

export const TAG_FIELDS: readonly TagField[] = ["jenis", "merk", "kode_asset", "kategori_oracle", "deskripsi", "invoice_number", "catatan"];

export const FIELD_LABEL: Record<SearchField, string> = {
  all:             "Semua Kolom",
  jenis:           "Jenis",
  merk:            "Merk",
  kode_asset:      "Kode Aset",
  kategori_oracle: "Kategori",
  deskripsi:       "Deskripsi",
  invoice_number:  "Invoice Number",
  catatan:         "Catatan",
};

/** Nama kolom yang dikenali saat flag diketik (huruf kecil, spasi/strip/garis bawah disamakan). */
const FIELD_ALIASES: Record<string, TagField> = {
  jenis: "jenis",
  merk: "merk", merek: "merk",
  kode: "kode_asset", kodeaset: "kode_asset", kodeasset: "kode_asset", aset: "kode_asset",
  kategori: "kategori_oracle", kategorioracle: "kategori_oracle",
  deskripsi: "deskripsi", desk: "deskripsi", desc: "deskripsi",
  invoice: "invoice_number", invoicenumber: "invoice_number", noinvoice: "invoice_number",
  catatan: "catatan", note: "catatan",
};

export function fieldFromAlias(raw: string): TagField | null {
  return FIELD_ALIASES[raw.toLowerCase().replace(/[\s_-]+/g, "")] ?? null;
}

export interface ParsedQuery {
  /** Flag yang terbentuk dari bagian "kolom:kata" (dan bagian polos bila fallbackField bukan "all") */
  tags: FilterTag[];
  /** Sisa teks polos (hanya bila fallbackField = "all") → pencarian semua kolom */
  rest: string;
  /** Ada minimal satu bagian "kolom:kata" yang dikenali */
  hasFlags: boolean;
}

/**
 * Pecah teks pencarian menjadi flag. Pemisah antar bagian: ";".
 *   "jenis:printer ink jet;merk:canon" → [jenis printer ink jet, merk canon]
 *   "canon" (fallbackField "merk")     → [merk canon]                 (perilaku lama dropdown)
 *   "jenis:cpu;intel" (fallback "all") → [jenis cpu] + rest "intel"
 * Nama kolom tak dikenal ("warna:merah") dianggap teks biasa — titik dua bisa ada di isi data.
 */
export function parseFlagQuery(text: string, fallbackField: SearchField): ParsedQuery {
  const tags: FilterTag[] = [];
  const rest: string[] = [];
  let hasFlags = false;
  for (const part of text.split(";")) {
    const seg = part.trim().replace(/\s+/g, " ");
    if (!seg) continue;
    const m = seg.match(/^([^:]{1,30}):(.*)$/);
    const field = m ? fieldFromAlias(m[1].trim()) : null;
    if (m && field) {
      hasFlags = true;
      const value = m[2].trim();
      if (value) tags.push({ field, value });
    } else if (fallbackField !== "all") {
      tags.push({ field: fallbackField, value: seg });
    } else {
      rest.push(seg);
    }
  }
  return { tags: dedupeTags(tags), rest: rest.join(" "), hasFlags };
}

export function sameTag(a: FilterTag, b: FilterTag): boolean {
  return a.field === b.field && a.value.toLowerCase() === b.value.toLowerCase();
}

export function dedupeTags(tags: FilterTag[]): FilterTag[] {
  return tags.filter((t, i) => tags.findIndex((u) => sameTag(t, u)) === i);
}

// ── Filter ────────────────────────────────────────────────────────────────
export interface FilterableAsset {
  toko: string;
  jenis: string;
  merk: string;
  kode_asset: string;
  kategori_oracle: string;
  deskripsi: string;
  invoice_number: string;
  catatan: string;
}

export interface MonitoringFilters {
  costCenter: CostCenter;
  quickSearch: string;
  tags: FilterTag[];
}

/** "CGA1 – CADANGAN GENERAL AFFAIRS 1" → "CGA1" */
export function extractCGACode(toko: string): string {
  const match = toko.match(/CGA\d/i);
  return match ? match[0].toUpperCase() : toko;
}

/**
 * Filter yang sama untuk layar & PDF. `catatanOf` = catatan terbaru (halaman memakai catatan yang
 * baru disimpan sebelum data dimuat ulang).
 */
export function filterAssets<T extends FilterableAsset>(
  assets: T[],
  f: MonitoringFilters,
  catatanOf: (a: T) => string = (a) => a.catatan,
): T[] {
  let result = assets;
  if (f.costCenter !== "ALL") result = result.filter((a) => extractCGACode(a.toko) === f.costCenter);

  const q = f.quickSearch.toLowerCase().trim();
  if (q) {
    result = result.filter((a) =>
      a.jenis.toLowerCase().includes(q) ||
      a.merk.toLowerCase().includes(q) ||
      a.kode_asset.toLowerCase().includes(q) ||
      a.kategori_oracle.toLowerCase().includes(q) ||
      a.deskripsi.toLowerCase().includes(q) ||
      a.invoice_number.toLowerCase().includes(q) ||
      catatanOf(a).toLowerCase().includes(q),
    );
  }

  if (f.tags.length > 0) {
    result = result.filter((a) =>
      f.tags.every((tag) => {
        const v = tag.value.toLowerCase();
        const col = tag.field === "catatan" ? catatanOf(a) : a[tag.field];
        return col.toLowerCase().includes(v);
      }),
    );
  }
  return result;
}

/** Ringkasan filter untuk judul PDF / nama file. Kosong = tanpa filter. */
export function describeFilters(f: MonitoringFilters): string {
  const parts: string[] = [];
  if (f.costCenter !== "ALL") parts.push(f.costCenter);
  if (f.quickSearch.trim()) parts.push(`Cari "${f.quickSearch.trim()}"`);
  for (const t of f.tags) parts.push(`${FIELD_LABEL[t.field]}: ${t.value}`);
  return parts.join(" · ");
}
