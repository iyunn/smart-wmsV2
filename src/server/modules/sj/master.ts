import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";

// Master Surat Jalan: tujuan, template item, pendingan alokasi.

// ── Tujuan ────────────────────────────────────────────────────────────────
export function listTujuan() {
  return db.selectFrom("sj_tujuan").selectAll().orderBy("kode").execute();
}

const tujuanValues = (b: { kode: string; nama: string; kota?: string | null; kecamatan?: string | null }) => ({
  kode: b.kode.trim().toUpperCase(),
  nama: b.nama.trim(),
  kota: b.kota?.trim() || null,
  kecamatan: b.kecamatan?.trim() || null,
});

export function createTujuan(b: { kode: string; nama: string; kota?: string | null; kecamatan?: string | null }) {
  return db.insertInto("sj_tujuan").values(tujuanValues(b)).returningAll().executeTakeFirstOrThrow();
}

export function updateTujuan(id: string, b: { kode: string; nama: string; kota?: string | null; kecamatan?: string | null }) {
  return db.updateTable("sj_tujuan").set(tujuanValues(b)).where("id", "=", id).returningAll().executeTakeFirst();
}

export function deleteTujuan(id: string) {
  return db.deleteFrom("sj_tujuan").where("id", "=", id).execute();
}

// ── Template item SJ ────────────────────────────────────────────────────
export function listTemplates() {
  return db.selectFrom("sj_item_templates").select(["id", "nama", "items", "created_at"]).orderBy("nama").execute();
}

export function createTemplate(nama: string, items: unknown[]) {
  return db
    .insertInto("sj_item_templates")
    .values({ nama, items: JSON.stringify(items) })
    .returning(["id", "nama", "items", "created_at"])
    .executeTakeFirstOrThrow();
}

export function deleteTemplate(id: string) {
  return db.deleteFrom("sj_item_templates").where("id", "=", id).execute();
}

// ── Pendingan alokasi ───────────────────────────────────────────────────
const PENDINGAN_COLS = [
  "p.id", "p.tujuan_id", "p.jenis", "p.merk", "p.qty", "p.keterangan", "p.urgensi", "p.arah", "p.created_at",
] as const;

export async function listPendingan(tujuanId?: string | null) {
  let q = db
    .selectFrom("pendingan_items as p")
    .innerJoin("sj_tujuan as t", "t.id", "p.tujuan_id")
    .select([
      ...PENDINGAN_COLS,
      sql<{ id: string; kode: string; nama: string; kota: string | null; kecamatan: string | null }>`
        json_build_object('id', t.id, 'kode', t.kode, 'nama', t.nama, 'kota', t.kota, 'kecamatan', t.kecamatan)`.as("tujuan"),
    ])
    .orderBy("p.created_at", "asc")
    .orderBy("p.id", "asc");
  if (tujuanId) q = q.where("p.tujuan_id", "=", tujuanId);
  return q.execute();
}

export interface PendinganInput {
  tujuan_id: string;
  jenis: string;
  merk: string;
  qty: number;
  keterangan: string;
  urgensi: string;
  arah: string;
}

export function insertPendingan(rows: PendinganInput[]) {
  return db.insertInto("pendingan_items").values(rows).returningAll().execute();
}

export function updatePendingan(id: string, patch: Partial<Omit<PendinganInput, "tujuan_id">>) {
  return db.updateTable("pendingan_items").set(patch).where("id", "=", id).returningAll().executeTakeFirst();
}

export function deletePendingan(ids: string[]) {
  return db.deleteFrom("pendingan_items").where("id", "in", ids).execute();
}
