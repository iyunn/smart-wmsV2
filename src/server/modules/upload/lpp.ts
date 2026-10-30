import "server-only";
import { db } from "@/server/db";

// Upload LPP Web Tracking (full replace; 3 file CGA1/2/3 sekaligus) + DAT Closing.

export async function clearLPP() {
  await db.deleteFrom("lpp_raw").execute();
}

export interface LPPRow {
  kode_asset: string; toko: string; deskripsi?: string;
  saldo_awal?: number; masuk?: number; keluar?: number; saldo_akhir?: number;
}

export async function insertLPPBatch(data: LPPRow[]) {
  const now = new Date();
  await db
    .insertInto("lpp_raw")
    .values(
      data.map((r) => ({
        kode_asset: r.kode_asset,
        toko: r.toko,
        deskripsi: r.deskripsi ?? "",
        saldo_awal: r.saldo_awal ?? 0,
        masuk: r.masuk ?? 0,
        keluar: r.keluar ?? 0,
        saldo_akhir: r.saldo_akhir ?? 0,
        uploaded_at: now,
      })),
    )
    .execute();
  return data.length;
}

export function listLPP() {
  return db
    .selectFrom("lpp_raw")
    .select(["id", "kode_asset", "toko", "deskripsi", "saldo_awal", "masuk", "keluar", "saldo_akhir", "uploaded_at"])
    .orderBy("toko")
    .orderBy("kode_asset")
    .execute();
}

export function listClosing() {
  return db
    .selectFrom("dat_closing")
    .select(["bulan", "cga", "total_items", "total_qty", "total_nilai", "total_tercatat", "uploaded_at"])
    .orderBy("bulan", "asc")
    .orderBy("cga", "asc")
    .execute();
}

export interface ClosingStat {
  cga: string; total_items?: number; total_qty?: number; total_nilai?: number; total_tercatat?: number;
}

export async function upsertClosing(bulan: string, stats: ClosingStat[]) {
  const now = new Date();
  // Satu statement; nilai kembar (bulan,cga) dalam satu request → baris terakhir yang dipakai.
  const byCga = new Map(stats.map((s) => [s.cga, s]));
  await db
    .insertInto("dat_closing")
    .values(
      [...byCga.values()].map((s) => ({
        bulan,
        cga: s.cga,
        total_items: s.total_items ?? 0,
        total_qty: s.total_qty ?? 0,
        total_nilai: s.total_nilai ?? 0,
        total_tercatat: s.total_tercatat ?? 0,
        uploaded_at: now,
      })),
    )
    .onConflict((oc) =>
      oc.columns(["bulan", "cga"]).doUpdateSet((eb) => ({
        total_items: eb.ref("excluded.total_items"),
        total_qty: eb.ref("excluded.total_qty"),
        total_nilai: eb.ref("excluded.total_nilai"),
        total_tercatat: eb.ref("excluded.total_tercatat"),
        uploaded_at: eb.ref("excluded.uploaded_at"),
      })),
    )
    .execute();
  return byCga.size;
}
