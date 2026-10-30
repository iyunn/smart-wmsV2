import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";
import { classifyAsset } from "@/lib/classifier";
import { invalidateClassificationCaches, loadRulesForClassifier } from "@/server/modules/classification/rules";
import { syncStagingToNotes } from "@/server/modules/sj/staging";

// Upload DAT (full replace). Alur client tidak berubah:
//   1. POST /api/process/clear       → kosongkan assets_raw (assets_clean ikut CASCADE)
//   2. POST /api/process  × N batch  → simpan raw + hasil klasifikasi
//   3. batch terakhir (isLastBatch)  → pulihkan tag Allocated, bersihkan catatan usang,
//                                      sinkron staging → asset_notes
// Perbaikan dibanding V1:
//   - Tiap batch (raw + clean) disimpan dalam SATU transaksi.
//   - Pemulihan tag Allocated membaca SEMUA item SJ (V1 terpotong 1.000 baris → sebagian
//     aset kehilangan tag setiap kali DAT di-upload).
//   - clear menghapus semua baris (V1: baris dengan kode_asset NULL/kosong tertinggal).

export async function clearDAT() {
  await db.deleteFrom("assets_raw").execute();
  invalidateClassificationCaches();
}

export interface DATRow {
  kode_asset: string; deskripsi: string; toko: string; kategori_oracle: string; status: string;
  kuantitas?: number; biaya_perolehan?: number; jumlah_tercatat?: number;
  invoice_number?: string | null; tanggal_dokumen?: string | null; sub_coce?: string | number | null;
}

export async function processDATBatch(data: DATRow[], isLastBatch: boolean) {
  const rules = await loadRulesForClassifier();
  const uploadedAt = new Date().toISOString().replace("Z", "").replace("T", " "); // kolom timestamp TANPA zona (UTC)

  const classified = data.map((item) => {
    const subCoce = (item.sub_coce ?? "0").toString().trim() || "0";
    return {
      raw: {
        kode_asset: item.kode_asset,
        deskripsi: item.deskripsi,
        toko: item.toko,
        kategori_oracle: item.kategori_oracle,
        status: item.status,
        kuantitas: item.kuantitas ?? 1,
        biaya_perolehan: item.biaya_perolehan ?? 0,
        jumlah_tercatat: item.jumlah_tercatat ?? 0,
        invoice_number: item.invoice_number ?? null,
        tanggal_dokumen: item.tanggal_dokumen ?? null,
        sub_coce: subCoce,
        is_prodsus: !/^0*$/.test(subCoce),
        uploaded_at: uploadedAt,
      },
      result: classifyAsset(item.deskripsi ?? "", rules),
    };
  });

  const inserted = await db.transaction().execute(async (trx) => {
    const rawRows = await trx
      .insertInto("assets_raw")
      .values(classified.map((c) => c.raw))
      .returning(["id", "kode_asset"])
      .execute();

    const rawIdMap = new Map(rawRows.map((r) => [r.kode_asset, r.id]));
    const cleanRows = classified.flatMap(({ raw, result }) => {
      const rawId = rawIdMap.get(raw.kode_asset);
      return rawId
        ? [{
            raw_id: rawId,
            original_description: result.original_description,
            normalized_description: result.normalized_description,
            jenis: result.jenis,
            merk: result.merk,
            kategori: result.kategori,
            confidence: result.confidence,
            status: raw.status,
          }]
        : [];
    });
    if (cleanRows.length > 0) await trx.insertInto("assets_clean").values(cleanRows).execute();
    return rawRows.length;
  });

  if (isLastBatch) {
    await finalizeDATUpload();
    invalidateClassificationCaches();
  }

  return {
    success: true,
    inserted,
    preview: classified.slice(0, 5).map((c) => c.result),
  };
}

/** Langkah batch terakhir: tag Allocated, catatan usang, staging. */
async function finalizeDATUpload() {
  await db.transaction().execute(async (trx) => {
    // Tag 'Allocated' untuk kode aset yang transaksi SJ TERAKHIR-nya 'keluar'
    // (tanggal terbaru, pengikat created_at) — sama dengan aturan V1.
    await sql`
      update assets_clean c set tag = 'Allocated'
      from assets_raw r
      where r.id = c.raw_id
        and r.kode_asset in (
          select kode_asset from (
            select distinct on (i.kode_asset) i.kode_asset, s.jenis
            from surat_jalan_items i join surat_jalan s on s.id = i.sj_id
            where i.kode_asset is not null and i.kode_asset <> ''
            order by i.kode_asset, s.tanggal desc, s.created_at desc
          ) latest
          where coalesce(latest.jenis, 'keluar') = 'keluar'
        )`.execute(trx);

    // Catatan aset yang kode-nya tidak ada lagi di DAT baru → siklus selesai, hapus.
    await sql`
      delete from asset_notes n
      where not exists (select 1 from assets_raw r where r.kode_asset = n.kode_asset)`.execute(trx);
  });

  // Best-effort, terpisah dari transaksi di atas (seperti V1: gagal sync tidak menggagalkan upload).
  try {
    await syncStagingToNotes();
  } catch (e) {
    console.error("[process] auto-sync staging gagal:", e);
  }
}
