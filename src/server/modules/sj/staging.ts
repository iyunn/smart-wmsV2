import "server-only";
import type { Kysely, Transaction } from "kysely";
import { db } from "@/server/db";
import type { DB } from "@/server/db/types";
import { extractCGA } from "@/server/modules/assets/cga";

// Staging area: barang AT dari SJ Penerimaan yang fisiknya sudah kembali ke CGA tapi
// belum muncul di DAT. Saat kode asetnya muncul di DAT (lokasi CGA), catatannya pindah
// ke asset_notes dan baris staging dihapus.

type Exec = Kysely<DB> | Transaction<DB>;

export function listStaging() {
  return db.selectFrom("staging_area").selectAll().orderBy("created_at", "desc").orderBy("id").execute();
}

export async function updateStaging(id: string, body: { catatan?: string | null; kode_asset?: string | null }) {
  const patch: { updated_at: Date; catatan?: string; kode_asset?: string | null; is_at_lebih?: boolean } = {
    updated_at: new Date(),
  };
  if (body.catatan !== undefined) patch.catatan = body.catatan ?? "";
  if (body.kode_asset !== undefined) {
    const trimmed = (body.kode_asset ?? "").trim();
    patch.kode_asset = trimmed || null;
    patch.is_at_lebih = !trimmed;
  }
  await db.updateTable("staging_area").set(patch).where("id", "=", id).execute();
}

/** Jumlah item staging yang punya kode aset (AT Lebih tidak ikut sinkron). */
export async function countStagingWithKode(): Promise<number> {
  const r = await db
    .selectFrom("staging_area")
    .select((eb) => eb.fn.countAll<number>().as("n"))
    .where("kode_asset", "is not", null)
    .where("kode_asset", "<>", "")
    .executeTakeFirstOrThrow();
  return Number(r.n);
}

export function deleteStaging(id: string) {
  return db.deleteFrom("staging_area").where("id", "=", id).execute();
}

/**
 * Pindahkan catatan staging → asset_notes untuk kode aset yang sudah ada di DAT dengan
 * lokasi CGA, lalu hapus dari staging. Mengembalikan jumlah item yang disinkronkan.
 */
export async function syncStagingToNotes(exec: Exec = db): Promise<number> {
  const items = await exec
    .selectFrom("staging_area as s")
    .innerJoin("assets_raw as r", "r.kode_asset", "s.kode_asset")
    .select(["s.id", "s.kode_asset", "s.catatan", "r.toko"])
    .where("s.kode_asset", "is not", null)
    .where("s.kode_asset", "<>", "")
    .execute();

  const synced = items.filter((i) => extractCGA(i.toko));
  if (synced.length === 0) return 0;

  const now = new Date();
  const notes = new Map<string, string>();
  for (const it of synced) if (it.catatan && it.catatan.trim()) notes.set(it.kode_asset!, it.catatan);
  if (notes.size > 0) {
    await exec
      .insertInto("asset_notes")
      .values([...notes].map(([kode_asset, catatan]) => ({ kode_asset, catatan, updated_at: now })))
      .onConflict((oc) =>
        oc.column("kode_asset").doUpdateSet((eb) => ({ catatan: eb.ref("excluded.catatan"), updated_at: eb.ref("excluded.updated_at") })),
      )
      .execute();
  }
  await exec.deleteFrom("staging_area").where("id", "in", synced.map((s) => s.id)).execute();
  return new Set(synced.map((s) => s.id)).size;
}
