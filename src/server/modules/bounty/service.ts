import "server-only";
import { type Transaction, sql } from "kysely";
import { db } from "@/server/db";
import type { DB } from "@/server/db/types";
import { BOUNTY_PER_BARANG, INISIAL_PATTERN, normalizeInisial, todayWib } from "@/lib/bounty";

// ══════════════════════════════════════════════════════════════════════════
// Bounty Hunter (ROADMAP 9e, ARCHITECTURE D-39). Semua user aktif boleh membuat, mengubah,
// menandai selesai (boleh sebagian), membatalkan, dan menghapus (keputusan Fillian).
// Setiap perubahan dicatat di bounty_events (siapa, kapan, catatan). Hapus = soft delete.
// Perubahan satu item dikunci FOR UPDATE → dua orang menandai selesai bersamaan tidak
// membuat jumlah selesai melebihi jumlah utang.
// ══════════════════════════════════════════════════════════════════════════

export class BountyError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface BountyInput {
  as_inisial: string;
  as_nama?: string;
  jenis: string;
  qty: number;
  tujuan_id?: string | null;
  keterangan?: string;
  tanggal?: string;
}

const isFk = (err: unknown) => (err as { code?: string }).code === "23503";

async function ensureAs(trx: Transaction<DB>, raw: string, nama: string | undefined, by: string): Promise<string> {
  const inisial = normalizeInisial(raw);
  if (!INISIAL_PATTERN.test(inisial)) {
    throw new BountyError("Inisial AS hanya huruf/angka (boleh spasi, titik, strip), maksimal 16 karakter.");
  }
  await trx
    .insertInto("bounty_as")
    .values({ inisial, nama: nama?.trim() ?? "", created_by: by })
    .onConflict((oc) => oc.column("inisial").doNothing())
    .execute();
  const row = await trx.selectFrom("bounty_as").select("id").where("inisial", "=", inisial).executeTakeFirstOrThrow();
  return row.id;
}

async function lockItem(trx: Transaction<DB>, id: string) {
  const it = await trx
    .selectFrom("bounty_items")
    .selectAll()
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .forUpdate()
    .executeTakeFirst();
  if (!it) throw new BountyError("Catatan bounty tidak ditemukan (mungkin sudah dihapus).", 404);
  return it;
}

function event(trx: Transaction<DB>, item_id: string, aksi: string, oleh: string, qty: number | null, catatan = "") {
  return trx.insertInto("bounty_events").values({ item_id, aksi, oleh, qty, catatan: catatan.trim() }).execute();
}

// ── Baca ────────────────────────────────────────────────────────────────
export async function listBounty() {
  const items = await db
    .selectFrom("bounty_items as b")
    .innerJoin("bounty_as as a", "a.id", "b.as_id")
    .leftJoin("sj_tujuan as t", "t.id", "b.tujuan_id")
    .where("b.deleted_at", "is", null)
    .select([
      "b.id", "b.as_id", "a.inisial as as_inisial", "b.jenis", "b.qty", "b.qty_selesai", "b.keterangan",
      "b.tanggal", "b.created_by", "b.created_at", "b.updated_at", "b.selesai_at",
      sql<{ id: string; kode: string; nama: string } | null>`
        case when t.id is null then null else json_build_object('id', t.id, 'kode', t.kode, 'nama', t.nama) end`.as("tujuan"),
      sql<{ aksi: string; qty: number | null; catatan: string; oleh: string; at: string }[]>`
        coalesce((select json_agg(json_build_object('aksi', e.aksi, 'qty', e.qty, 'catatan', e.catatan, 'oleh', e.oleh, 'at', e.at) order by e.at, e.id)
          from bounty_events e where e.item_id = b.id), '[]')`.as("riwayat"),
    ])
    .orderBy("b.tanggal", "asc")
    .orderBy("b.created_at", "asc")
    .execute();

  const as = await db
    .selectFrom("bounty_as as a")
    .leftJoin("bounty_items as b", (j) => j.onRef("b.as_id", "=", "a.id").on("b.deleted_at", "is", null))
    .select([
      "a.id", "a.inisial", "a.nama",
      sql<number>`coalesce(sum(b.qty - b.qty_selesai), 0)::int`.as("sisa"),
      sql<number>`count(b.id) filter (where b.qty > b.qty_selesai)::int`.as("utang_aktif"),
      sql<string | null>`min(b.tanggal) filter (where b.qty > b.qty_selesai)`.as("sejak"),
    ])
    .groupBy(["a.id", "a.inisial", "a.nama"])
    .execute();

  return {
    per_barang: BOUNTY_PER_BARANG,
    as: as
      .map((a) => ({ ...a, bounty: a.sisa * BOUNTY_PER_BARANG }))
      .sort((x, y) => y.bounty - x.bounty || x.inisial.localeCompare(y.inisial)),
    items,
  };
}

// ── Tulis ───────────────────────────────────────────────────────────────
export async function createBounty(input: BountyInput, by: string) {
  try {
    return await db.transaction().execute(async (trx) => {
      const as_id = await ensureAs(trx, input.as_inisial, input.as_nama, by);
      const row = await trx
        .insertInto("bounty_items")
        .values({
          as_id,
          jenis: input.jenis.trim(),
          qty: input.qty,
          tujuan_id: input.tujuan_id || null,
          keterangan: input.keterangan?.trim() ?? "",
          tanggal: input.tanggal || todayWib(),
          created_by: by,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      await event(trx, row.id, "buat", by, input.qty, input.keterangan ?? "");
      return row.id;
    });
  } catch (err) {
    if (isFk(err)) throw new BountyError("Toko yang dipilih tidak ditemukan.");
    throw err;
  }
}

export async function updateBounty(id: string, patch: Partial<BountyInput>, by: string) {
  try {
    await db.transaction().execute(async (trx) => {
      const it = await lockItem(trx, id);
      const set: Record<string, unknown> = {};
      const notes: string[] = [];

      if (patch.as_inisial !== undefined) {
        const as_id = await ensureAs(trx, patch.as_inisial, patch.as_nama, by);
        if (as_id !== it.as_id) { set.as_id = as_id; notes.push(`AS → ${normalizeInisial(patch.as_inisial)}`); }
      }
      if (patch.jenis !== undefined && patch.jenis.trim() !== it.jenis) { set.jenis = patch.jenis.trim(); notes.push(`barang ${it.jenis} → ${set.jenis}`); }
      if (patch.qty !== undefined && patch.qty !== it.qty) {
        if (patch.qty < it.qty_selesai) {
          throw new BountyError(`Jumlah tidak boleh kurang dari yang sudah kembali (${it.qty_selesai}).`);
        }
        set.qty = patch.qty;
        set.selesai_at = patch.qty === it.qty_selesai ? (it.selesai_at ?? new Date()) : null;
        notes.push(`jumlah ${it.qty} → ${patch.qty}`);
      }
      if (patch.tujuan_id !== undefined && (patch.tujuan_id || null) !== it.tujuan_id) { set.tujuan_id = patch.tujuan_id || null; notes.push("toko diubah"); }
      if (patch.keterangan !== undefined && patch.keterangan.trim() !== it.keterangan) { set.keterangan = patch.keterangan.trim(); notes.push("keterangan diubah"); }
      if (patch.tanggal !== undefined && patch.tanggal !== it.tanggal) { set.tanggal = patch.tanggal; notes.push(`tanggal ${it.tanggal} → ${patch.tanggal}`); }

      if (notes.length === 0) throw new BountyError("Tidak ada perubahan.");
      await trx.updateTable("bounty_items").set({ ...set, updated_at: new Date() }).where("id", "=", id).execute();
      await event(trx, id, "ubah", by, null, notes.join("; "));
    });
  } catch (err) {
    if (isFk(err)) throw new BountyError("Toko yang dipilih tidak ditemukan.");
    throw err;
  }
}

/** Tandai selesai `qty` barang (boleh sebagian). catatan mis. "dikembalikan ke Budi". */
export async function settleBounty(id: string, qty: number, catatan: string, by: string) {
  await db.transaction().execute(async (trx) => {
    const it = await lockItem(trx, id);
    const sisa = it.qty - it.qty_selesai;
    if (sisa === 0) throw new BountyError("Utang ini sudah lunas.");
    if (qty > sisa) throw new BountyError(`Maksimal ${sisa} — sisa yang belum kembali.`);
    const selesai = it.qty_selesai + qty;
    await trx
      .updateTable("bounty_items")
      .set({ qty_selesai: selesai, selesai_at: selesai === it.qty ? new Date() : null, updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    await event(trx, id, "selesai", by, qty, catatan);
  });
}

/** Batalkan tanda selesai `qty` barang (salah centang). */
export async function undoSettleBounty(id: string, qty: number, catatan: string, by: string) {
  await db.transaction().execute(async (trx) => {
    const it = await lockItem(trx, id);
    if (it.qty_selesai === 0) throw new BountyError("Belum ada yang ditandai selesai.");
    if (qty > it.qty_selesai) throw new BountyError(`Maksimal ${it.qty_selesai} — jumlah yang sudah ditandai selesai.`);
    await trx
      .updateTable("bounty_items")
      .set({ qty_selesai: it.qty_selesai - qty, selesai_at: null, updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    await event(trx, id, "batal", by, qty, catatan);
  });
}

export async function deleteBounty(id: string, catatan: string, by: string) {
  await db.transaction().execute(async (trx) => {
    await lockItem(trx, id);
    await trx.updateTable("bounty_items").set({ deleted_at: new Date(), deleted_by: by }).where("id", "=", id).execute();
    await event(trx, id, "hapus", by, null, catatan);
  });
}
