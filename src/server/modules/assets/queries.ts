import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";

// Query aset (DAT) — Monitoring, freshness, master jenis/merk, Review.
// Semua tanpa pagination loop: tidak ada batas 1.000 baris di V2 (D-11).

/** Timestamp upload terakhir DAT & LPP (Sidebar). */
export async function getFreshness() {
  const [dat, lpp] = await Promise.all([
    db.selectFrom("assets_raw").select((eb) => eb.fn.max("uploaded_at").as("t")).executeTakeFirst(),
    db.selectFrom("lpp_raw").select((eb) => eb.fn.max("uploaded_at").as("t")).executeTakeFirst(),
  ]);
  return { datLastUpload: dat?.t ?? null, lppLastUpload: lpp?.t ?? null };
}

/** Monitoring: 1 baris per aset (assets_clean ⨝ assets_raw) + catatan. Bentuk sama dengan V1. */
export interface TujuanAlokasi { kode: string; nama: string; no_sj: string; tanggal: string }

/**
 * Kode aset → toko tujuan dari transaksi SJ TERAKHIR-nya (tanggal terbaru, pengikat created_at),
 * hanya bila transaksi terakhir itu SJ KELUAR. Aturan SAMA dengan pemulihan tag 'Allocated' saat
 * upload DAT (src/server/modules/upload/dat.ts): SJ masuk terakhir = barang sudah kembali ke CGA → tidak ada.
 * Dihitung saat dibaca (tidak disimpan), jadi ikut berubah begitu kode di Rekap Alokasi diubah/dihapus.
 */
export async function latestTujuanByKode(): Promise<Map<string, TujuanAlokasi>> {
  const rows = await sql<{ kode_asset: string; jenis: string | null; kode: string | null; nama: string | null; no_sj: string | null; tanggal: string | null }>`
    select distinct on (i.kode_asset) i.kode_asset, s.jenis, t.kode, t.nama, s.no_sj, s.tanggal::text as tanggal
    from surat_jalan_items i
    join surat_jalan s on s.id = i.sj_id
    left join sj_tujuan t on t.id = s.tujuan_id
    where i.kode_asset is not null and i.kode_asset <> ''
    order by i.kode_asset, s.tanggal desc, s.created_at desc`.execute(db);
  const map = new Map<string, TujuanAlokasi>();
  for (const r of rows.rows) {
    if ((r.jenis ?? "keluar") !== "keluar" || !r.kode) continue;
    map.set(r.kode_asset, { kode: r.kode, nama: r.nama ?? "", no_sj: r.no_sj ?? "", tanggal: r.tanggal ?? "" });
  }
  return map;
}

export async function listMonitoringAssets() {
  const [rows, tujuan] = await Promise.all([
    db
    .selectFrom("assets_clean as c")
    .innerJoin("assets_raw as r", "r.id", "c.raw_id")
    .leftJoin("asset_notes as n", "n.kode_asset", "r.kode_asset")
    .select([
      "c.id as clean_id", "c.jenis", "c.merk", "c.confidence", "c.tag",
      "r.kode_asset", "r.deskripsi", "r.toko", "r.kategori_oracle", "r.kuantitas",
      "r.biaya_perolehan", "r.jumlah_tercatat", "r.invoice_number", "r.tanggal_dokumen",
      "n.catatan",
    ])
    .orderBy("r.kode_asset")
    .execute(),
    latestTujuanByKode(),
  ]);

  return rows.map((r) => ({
    clean_id:        r.clean_id,
    jenis:           r.jenis ?? "Unknown",
    merk:            r.merk ?? "Unknown",
    confidence:      r.confidence ?? "low",
    kode_asset:      r.kode_asset ?? "",
    deskripsi:       r.deskripsi ?? "",
    toko:            r.toko ?? "",
    kategori_oracle: r.kategori_oracle ?? "",
    kuantitas:       r.kuantitas ?? 1,
    biaya_perolehan: r.biaya_perolehan ?? 0,
    jumlah_tercatat: r.jumlah_tercatat ?? 0,
    tag:             r.tag ?? null,
    invoice_number:  r.invoice_number ?? "",
    tanggal_dokumen: r.tanggal_dokumen ?? "",
    catatan:         r.catatan ?? "",
    // Kode Tujuan: toko dari SJ keluar terakhir yang memakai kode aset ini (Rekap Alokasi)
    kode_tujuan:     tujuan.get(r.kode_asset ?? "")?.kode ?? "",
    nama_tujuan:     tujuan.get(r.kode_asset ?? "")?.nama ?? "",
    tujuan_no_sj:    tujuan.get(r.kode_asset ?? "")?.no_sj ?? "",
    tujuan_tanggal:  tujuan.get(r.kode_asset ?? "")?.tanggal ?? "",
  }));
}

/** Simpan catatan aset; catatan kosong → baris dihapus. */
export async function saveAssetNote(kodeAsset: string, catatan: string) {
  const trimmed = catatan.trim();
  if (!trimmed) {
    await db.deleteFrom("asset_notes").where("kode_asset", "=", kodeAsset).execute();
    return "";
  }
  await db
    .insertInto("asset_notes")
    .values({ kode_asset: kodeAsset, catatan: trimmed, updated_at: new Date() })
    .onConflict((oc) => oc.column("kode_asset").doUpdateSet({ catatan: trimmed, updated_at: new Date() }))
    .execute();
  return trimmed;
}

/** Daftar unik jenis/merk dari hasil klasifikasi (dropdown SJ), tanpa 'Unknown'/kosong. */
export async function distinctCleanValues(column: "jenis" | "merk"): Promise<string[]> {
  const rows = await db
    .selectFrom("assets_clean")
    .select(sql<string>`${sql.ref(column)}`.as("v"))
    .distinct()
    .where(column, "<>", "Unknown")
    .where(column, "is not", null)
    .execute();
  return rows.map((r) => r.v).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

const REVIEW_SORT = {
  original_description: "original_description",
  jenis: "jenis",
  merk: "merk",
  confidence_score: "confidence",
} as const;
export type ReviewSort = keyof typeof REVIEW_SORT;

/** Review: semua aset dengan jenis/merk Unknown + total aset (pengganti query Supabase di useReviewAssets). */
export async function listReviewAssets(sort: ReviewSort, dir: "asc" | "desc") {
  const column = REVIEW_SORT[sort];
  const [rows, total] = await Promise.all([
    db
      .selectFrom("assets_clean")
      .select(["id", "original_description", "normalized_description", "jenis", "merk", "kategori", "confidence", "status"])
      .where((eb) => eb.or([eb("jenis", "=", "Unknown"), eb("merk", "=", "Unknown")]))
      .orderBy(column, dir)
      .orderBy("id")
      .execute(),
    db.selectFrom("assets_clean").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow(),
  ]);
  return { rows, total: Number(total.n) };
}
