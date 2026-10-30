import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";
import { nextNoSJ } from "./surat-jalan";

// Import SJ dari Web Tracking (hasil parse PDF di browser) → SJ SmartWMS berstatus submitted.
// Satu transaksi: tujuan (auto-create bila belum ada) + header + item.

export interface ImportWTInput {
  tujuan_kode: string;
  tujuan_nama?: string;
  tanggal: string;
  pembawa?: string;
  no_sj_wt?: string;
  items: {
    kode_asset?: string | null; keterangan?: string; jenis?: string; merk?: string;
    qty?: number; satuan?: string; is_baru?: boolean;
  }[];
}

export async function importWT(b: ImportWTInput) {
  return db.transaction().execute(async (trx) => {
    // Tujuan dicocokkan tanpa beda huruf besar/kecil (V1: ilike tanpa wildcard).
    const existing = await trx
      .selectFrom("sj_tujuan")
      .select("id")
      .where(sql<string>`lower(kode)`, "=", b.tujuan_kode.toLowerCase())
      .orderBy("id")
      .limit(1)
      .executeTakeFirst();
    const tujuanId =
      existing?.id ??
      (await trx
        .insertInto("sj_tujuan")
        .values({ kode: b.tujuan_kode.toUpperCase(), nama: b.tujuan_nama ?? "" })
        .returning("id")
        .executeTakeFirstOrThrow()).id;

    const noSJ = await nextNoSJ(trx, b.tanggal);
    const sj = await trx
      .insertInto("surat_jalan")
      .values({
        no_sj: noSJ,
        tanggal: b.tanggal,
        tujuan_id: tujuanId,
        pembawa: b.pembawa || "",
        penerima: `${b.tujuan_kode} — ${b.tujuan_nama}`,
        approved_by: "SPV/Manager",
        created_by: "Admin GA",
        status: "submitted",
      })
      .returning(["id", "no_sj"])
      .executeTakeFirstOrThrow();

    const now = new Date();
    const items = b.items.map((it, idx) => ({
      sj_id: sj.id,
      urutan: idx + 1,
      jenis: it.jenis ?? "",
      merk: it.merk ?? "",
      serial_number: "",
      qty: it.qty ?? 1,
      satuan: it.satuan ?? "Unit",
      is_baru: !!it.is_baru,
      is_aktiva: true,            // SJ WT selalu aktiva (ada kode_asset)
      keterangan: it.keterangan ?? "",
      kode_asset: it.kode_asset ?? null,
      mutasi_wt_status: true,     // SJ WT sudah dibuat = mutasi WT sudah terjadi
      mutasi_wt_at: now,
    }));
    await trx.insertInto("surat_jalan_items").values(items).execute();

    return {
      success: true,
      no_sj: sj.no_sj,
      no_sj_wt: b.no_sj_wt,
      tujuan_created: !existing,
      items_count: items.length,
    };
  });
}
