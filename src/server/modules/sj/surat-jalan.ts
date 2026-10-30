import "server-only";
import { type Transaction, sql } from "kysely";
import { db } from "@/server/db";
import type { DB } from "@/server/db/types";
import { nextNoSJFrom, noSJPrefix } from "./no-sj";

// Surat Jalan (keluar & masuk/Penerimaan): daftar, detail, buat, ubah, hapus.
// Bedanya dengan V1:
//   - Header + item (+ staging) disimpan dalam SATU transaksi — tidak ada lagi SJ tanpa item
//     bila insert item gagal (V1 mencoba menghapus manual).
//   - Nomor SJ dibuat di dalam transaksi dengan advisory lock per bulan → dua orang yang
//     menyimpan bersamaan tidak mendapat nomor yang sama.
//   - Daftar SJ mengembalikan SEMUA SJ (V1 terpotong 1.000 oleh batas Supabase).

type Trx = Transaction<DB>;

export class SJError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Nomor berikutnya untuk bulan tanggal SJ. Wajib dipanggil di dalam transaksi. */
export async function nextNoSJ(trx: Trx, tanggal: string): Promise<string> {
  const prefix = noSJPrefix(tanggal);
  await sql`select pg_advisory_xact_lock(hashtext(${prefix}))`.execute(trx);
  const last = await trx
    .selectFrom("surat_jalan")
    .select("no_sj")
    .where("no_sj", "like", `${prefix}%`)
    .orderBy("no_sj", "desc")
    .limit(1)
    .executeTakeFirst();
  return nextNoSJFrom(prefix, last?.no_sj);
}

// ── Baca ─────────────────────────────────────────────────────────────────
export async function listSJ() {
  const rows = await db
    .selectFrom("surat_jalan as s")
    .leftJoin("sj_tujuan as t", "t.id", "s.tujuan_id")
    .select([
      "s.id", "s.no_sj", "s.tanggal", "s.pembawa", "s.penerima", "s.status", "s.approved_by", "s.is_archived",
      "s.jenis", "s.created_at", "s.updated_at",
      sql<{ id: string; kode: string; nama: string } | null>`
        case when t.id is null then null else json_build_object('id', t.id, 'kode', t.kode, 'nama', t.nama) end`.as("tujuan"),
      sql<number>`(select count(*)::int from surat_jalan_items i where i.sj_id = s.id)`.as("items_count"),
      // urutan kemunculan dipertahankan (array_agg berurutan) seperti Set di V1
      sql<string[]>`coalesce((select array_agg(x.v order by x.first) from (
          select i.jenis as v, min(i.urutan) as first from surat_jalan_items i
          where i.sj_id = s.id and coalesce(i.jenis, '') <> '' group by i.jenis) x), '{}')`.as("jenis_list"),
      sql<string[]>`coalesce((select array_agg(x.v order by x.first) from (
          select i.serial_number as v, min(i.urutan) as first from surat_jalan_items i
          where i.sj_id = s.id and coalesce(i.serial_number, '') <> '' group by i.serial_number) x), '{}')`.as("sn_list"),
    ])
    .orderBy("s.tanggal", "desc")
    .orderBy("s.created_at", "desc")
    .orderBy("s.id")
    .execute();
  return rows;
}

export async function getSJDetail(id: string) {
  const sj = await db
    .selectFrom("surat_jalan as s")
    .leftJoin("sj_tujuan as t", "t.id", "s.tujuan_id")
    .selectAll("s")
    .select(
      sql<{ id: string; kode: string; nama: string } | null>`
        case when t.id is null then null else json_build_object('id', t.id, 'kode', t.kode, 'nama', t.nama) end`.as("tujuan"),
    )
    .where("s.id", "=", id)
    .executeTakeFirst();
  if (!sj) return null;
  const items = await db.selectFrom("surat_jalan_items").selectAll().where("sj_id", "=", id).orderBy("urutan").orderBy("id").execute();
  return { ...sj, items };
}

// ── Tulis ────────────────────────────────────────────────────────────────
export interface SJItemInput {
  jenis?: string; merk?: string; serial_number?: string; qty?: number; satuan?: string;
  is_baru?: boolean; is_aktiva?: boolean; keterangan?: string; kode_asset?: string | null;
}

const itemRow = (sjId: string, item: SJItemInput, idx: number) => ({
  sj_id:         sjId,
  urutan:        idx + 1,
  jenis:         item.jenis ?? "",
  merk:          item.merk ?? "",
  serial_number: item.serial_number ?? "",
  qty:           item.qty ?? 1,
  satuan:        item.satuan ?? "Unit",
  is_baru:       !!item.is_baru,
  is_aktiva:     !!item.is_aktiva,
  keterangan:    item.keterangan ?? "",
  kode_asset:    (item.kode_asset ?? "").trim() || null,
});

async function asalToko(trx: Trx, tujuanId: string): Promise<string> {
  const t = await trx.selectFrom("sj_tujuan").select(["kode", "nama"]).where("id", "=", tujuanId).executeTakeFirst();
  return t ? `${t.kode} - ${t.nama}` : "";
}

export interface SJHeaderInput {
  tanggal: string; tujuan_id: string; pembawa?: string; penerima?: string; approved_by?: string; status?: string;
}

export async function createSJ(h: SJHeaderInput & { jenis?: string }, items: SJItemInput[]) {
  return db.transaction().execute(async (trx) => {
    const no_sj = await nextNoSJ(trx, h.tanggal);
    const jenis = h.jenis === "masuk" ? "masuk" : "keluar";
    const sj = await trx
      .insertInto("surat_jalan")
      .values({
        no_sj,
        tanggal: h.tanggal,
        tujuan_id: h.tujuan_id,
        pembawa: h.pembawa ?? "",
        penerima: h.penerima ?? "",
        approved_by: h.approved_by ?? "",
        status: h.status ?? "draft",
        jenis,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx.insertInto("surat_jalan_items").values(items.map((it, i) => itemRow(sj.id, it, i))).execute();

    // SJ masuk: item AT ditampung di staging (catatan sebelum DAT terbaru di-upload).
    if (jenis === "masuk") {
      const asal = await asalToko(trx, h.tujuan_id);
      const rows = items
        .filter((it) => !!it.is_aktiva)
        .map((it) => {
          const kode = (it.kode_asset ?? "").trim();
          return {
            kode_asset: kode || null, jenis: it.jenis ?? "", merk: it.merk ?? "", deskripsi: it.keterangan ?? "",
            catatan: "", asal_toko: asal, is_at_lebih: !kode, sj_id: sj.id,
          };
        });
      if (rows.length > 0) await trx.insertInto("staging_area").values(rows).execute();
    }
    return { sj, no_sj };
  });
}

/** Mode archive_only / reschedule_only — hanya satu kolom header. */
export async function patchSJHeader(id: string, set: { is_archived?: boolean; tanggal?: string }) {
  return db
    .updateTable("surat_jalan")
    .set({ ...set, updated_at: new Date() })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
}

/** Edit penuh: header + ganti seluruh item (+ sinkron staging untuk SJ masuk). */
export async function updateSJFull(id: string, h: SJHeaderInput & { jenis?: string }, items: SJItemInput[]) {
  return db.transaction().execute(async (trx) => {
    const sj = await trx
      .updateTable("surat_jalan")
      .set({
        tanggal: h.tanggal,
        tujuan_id: h.tujuan_id,
        pembawa: h.pembawa ?? "",
        penerima: h.penerima ?? "",
        approved_by: h.approved_by ?? "",
        status: h.status ?? "draft",
        updated_at: new Date(),
        // `jenis` hanya diubah bila dikirim (halaman Buat SJ tidak mengirimnya).
        ...(h.jenis === "masuk" || h.jenis === "keluar" ? { jenis: h.jenis } : {}),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();
    if (!sj) throw new SJError("Surat jalan tidak ditemukan.", 404);

    await trx.deleteFrom("surat_jalan_items").where("sj_id", "=", id).execute();
    await trx.insertInto("surat_jalan_items").values(items.map((it, i) => itemRow(id, it, i))).execute();

    if (sj.jenis === "masuk") {
      // Pertahankan catatan staging lama per kode_asset.
      const old = await trx.selectFrom("staging_area").select(["kode_asset", "catatan"]).where("sj_id", "=", id).execute();
      const catatanLama = new Map<string, string>();
      for (const r of old) if (r.kode_asset && r.catatan && r.catatan.trim()) catatanLama.set(r.kode_asset, r.catatan);
      await trx.deleteFrom("staging_area").where("sj_id", "=", id).execute();

      const kodeItems = items.map((it) => (it.kode_asset ?? "").trim()).filter(Boolean);
      const sudahDiCGA = new Set<string>();
      if (kodeItems.length > 0) {
        const existing = await trx.selectFrom("assets_raw").select(["kode_asset", "toko"]).where("kode_asset", "in", kodeItems).execute();
        for (const r of existing) if (r.kode_asset && /CGA\d/i.test(r.toko ?? "")) sudahDiCGA.add(r.kode_asset);
      }
      const asal = await asalToko(trx, h.tujuan_id);
      const rows = items
        .filter((it) => {
          if (!it.is_aktiva) return false;
          const kode = (it.kode_asset ?? "").trim();
          return !kode || !sudahDiCGA.has(kode);
        })
        .map((it) => {
          const kode = (it.kode_asset ?? "").trim();
          return {
            kode_asset: kode || null, jenis: it.jenis ?? "", merk: it.merk ?? "", deskripsi: it.keterangan ?? "",
            catatan: kode ? (catatanLama.get(kode) ?? "") : "", asal_toko: asal, is_at_lebih: !kode, sj_id: id,
          };
        });
      if (rows.length > 0) await trx.insertInto("staging_area").values(rows).execute();
    }
    return sj;
  });
}

/** Hapus SJ (item ikut CASCADE) + item staging terkait. */
export async function deleteSJ(id: string) {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom("staging_area").where("sj_id", "=", id).execute();
    await trx.deleteFrom("surat_jalan").where("id", "=", id).execute();
  });
}
