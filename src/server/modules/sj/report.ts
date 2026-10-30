import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";

// Rekap Alokasi: 1 baris per item SJ + status mutasi, dan update alokasi per item.
// Logika penguncian (K1/K2, barang masuk terbalik) identik dengan V1.

export async function listReportItems() {
  const [items, rawCodes, kategori] = await Promise.all([
    db
      .selectFrom("surat_jalan_items as i")
      .innerJoin("surat_jalan as s", "s.id", "i.sj_id")
      .leftJoin("sj_tujuan as t", "t.id", "s.tujuan_id")
      .select([
        "i.id", "i.urutan", "i.jenis", "i.merk", "i.serial_number", "i.qty", "i.satuan", "i.is_baru", "i.is_aktiva",
        "i.keterangan", "i.mutasi_oracle_status", "i.kode_asset", "i.mutasi_wt_status",
        "s.id as sj_id", "s.no_sj", "s.tanggal", "s.pembawa", "s.penerima", "s.status", "s.approved_by",
        "s.jenis as sj_jenis", "s.created_at as sj_created_at",
        "t.id as tujuan_id", "t.kode as tujuan_kode", "t.nama as tujuan_nama",
      ])
      .execute(),
    db.selectFrom("assets_raw").select("kode_asset").execute(),
    // jenis → kategori_oracle. V1 memakai kategori yang KEBETULAN ditemui pertama (urutan fisik);
    // V2 memakai kategori yang paling sering untuk jenis itu (deterministik).
    sql<{ jenis: string; kategori: string }>`
      select distinct on (jenis) jenis, kategori from (
        select btrim(c.jenis) as jenis, btrim(r.kategori_oracle) as kategori, count(*) as n
        from assets_clean c join assets_raw r on r.id = c.raw_id
        where coalesce(btrim(c.jenis), '') <> '' and coalesce(btrim(r.kategori_oracle), '') <> ''
        group by 1, 2
      ) x order by jenis, n desc, kategori`.execute(db),
  ]);

  const codes = rawCodes.map((r) => r.kode_asset).filter((k): k is string => !!k);
  // Guard: DAT belum pernah di-upload → jangan anggap semua kode sudah mutasi.
  const activeKodeSet = codes.length > 0 ? new Set(codes) : null;
  const kategoriByJenis = new Map(kategori.rows.map((r) => [r.jenis, r.kategori]));

  const isMutated = (kode: string | null, mutasi: boolean, jenisSJ: string): boolean => {
    const k = (kode ?? "").trim();
    if (jenisSJ === "masuk") return k ? activeKodeSet !== null && activeKodeSet.has(k) : !!mutasi;
    return k ? activeKodeSet !== null && !activeKodeSet.has(k) : !!mutasi;
  };

  const flat = items.map((it) => {
    const jenisSJ = it.sj_jenis === "masuk" ? "masuk" : "keluar";
    return {
      item_id:       it.id,
      urutan:        it.urutan,
      jenis:         it.jenis ?? "",
      merk:          it.merk ?? "",
      serial_number: it.serial_number ?? "",
      qty:           it.qty ?? 1,
      satuan:        it.satuan ?? "Unit",
      is_baru:       !!it.is_baru,
      is_aktiva:     !!it.is_aktiva,
      keterangan:    it.keterangan ?? "",
      mutasi_oracle: !!it.mutasi_oracle_status,
      kode_asset:    it.kode_asset ?? "",
      kategori:      kategoriByJenis.get((it.jenis ?? "").trim()) ?? "",
      is_mutated:    isMutated(it.kode_asset, !!it.mutasi_oracle_status, jenisSJ),
      mutasi_wt:     !!it.mutasi_wt_status,
      sj_id:         it.sj_id,
      no_sj:         it.no_sj ?? "",
      tanggal:       it.tanggal ?? "",
      pembawa:       it.pembawa ?? "",
      penerima:      it.penerima ?? "",
      status:        it.status ?? "",
      approved_by:   it.approved_by ?? "",
      jenis_sj:      jenisSJ,
      tujuan_id:     it.tujuan_id ?? null,
      tujuan_kode:   it.tujuan_kode ?? "",
      tujuan_nama:   it.tujuan_nama ?? "",
      _created:      it.sj_created_at?.getTime() ?? 0,
    };
  });

  // tanggal desc, urutan asc (seperti V1); pengikat tambahan agar urutan stabil antar-SJ.
  flat.sort((a, b) =>
    b.tanggal.localeCompare(a.tanggal) || b._created - a._created || a.no_sj.localeCompare(b.no_sj) || a.urutan - b.urutan,
  );
  return flat.map(({ _created, ...rest }) => rest);
}

export class ReportError extends Error {
  constructor(message: string, readonly status: number, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

export interface AllocationPatch {
  item_id: string;
  kode_asset?: string;
  mutasi_oracle_status?: boolean;
  mutasi_wt_status?: boolean;
}

/** Update alokasi 1 item + tag 'Allocated' di assets_clean (dalam satu transaksi). */
export async function patchAllocation(p: AllocationPatch): Promise<{ success: true; tagged: boolean }> {
  const newKode = (p.kode_asset ?? "").trim();

  return db.transaction().execute(async (trx) => {
    const old = await trx
      .selectFrom("surat_jalan_items as i")
      .innerJoin("surat_jalan as s", "s.id", "i.sj_id")
      .select(["i.kode_asset", "s.jenis"])
      .where("i.id", "=", p.item_id)
      .forUpdate("i")
      .executeTakeFirst();
    if (!old) throw new ReportError("Item tidak ditemukan.", 404);

    const oldKode = (old.kode_asset ?? "").trim();
    const isJenisMasuk = old.jenis === "masuk";

    // Lock guard: evaluasi state LAMA. Reset (kode kosong + mutasi false) selalu boleh.
    const isReset = !newKode && !p.mutasi_oracle_status;
    if (oldKode && !isReset) {
      const [exists, any] = await Promise.all([
        trx.selectFrom("assets_raw").select("id").where("kode_asset", "=", oldKode).executeTakeFirst(),
        trx.selectFrom("assets_raw").select("id").limit(1).executeTakeFirst(),
      ]);
      const hasDAT = !!any;
      const lockedByDAT = isJenisMasuk ? hasDAT && !!exists : hasDAT && !exists;
      if (lockedByDAT) {
        throw new ReportError(
          isJenisMasuk
            ? "Item sudah dimutasi masuk (kode sudah ada di DAT) dan terkunci permanen."
            : "Item sudah dimutasi (kode hilang dari DAT) dan terkunci permanen.",
          409,
          { locked: true },
        );
      }
    }

    const set: Record<string, unknown> = {};
    if (p.kode_asset !== undefined || p.mutasi_oracle_status !== undefined) {
      set.kode_asset = newKode || null;
      set.mutasi_oracle_status = !!p.mutasi_oracle_status;
      set.mutasi_oracle_at = p.mutasi_oracle_status ? new Date() : null;
    }
    if (p.mutasi_wt_status !== undefined) {
      set.mutasi_wt_status = !!p.mutasi_wt_status;
      set.mutasi_wt_at = p.mutasi_wt_status ? new Date() : null;
    }
    if (Object.keys(set).length > 0) {
      await trx.updateTable("surat_jalan_items").set(set).where("id", "=", p.item_id).execute();
    }

    // Tag baru: kode cocok di DAT → assets_clean pasangannya ditandai 'Allocated'.
    let tagged = false;
    if (newKode) {
      const raw = await trx.selectFrom("assets_raw").select("id").where("kode_asset", "=", newKode).executeTakeFirst();
      if (raw) {
        await trx.updateTable("assets_clean").set({ tag: "Allocated" }).where("raw_id", "=", raw.id).execute();
        tagged = true;
      }
    }

    // Tag lama dibersihkan bila kode lama tidak dipakai item SJ lain.
    if (oldKode && oldKode !== newKode) {
      const stillUsed = await trx.selectFrom("surat_jalan_items").select("id").where("kode_asset", "=", oldKode).limit(1).executeTakeFirst();
      if (!stillUsed) {
        await trx
          .updateTable("assets_clean")
          .set({ tag: null })
          .where("raw_id", "in", (eb) => eb.selectFrom("assets_raw").select("id").where("kode_asset", "=", oldKode))
          .execute();
      }
    }
    return { success: true as const, tagged };
  });
}
