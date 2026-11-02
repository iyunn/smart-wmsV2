import { type Kysely, sql } from "kysely";

// ══════════════════════════════════════════════════════════════════════════
// 0005 — Bounty Hunter (ROADMAP 9e, ARCHITECTURE D-39): catatan pinjaman / janji AS
// (Area Supervisor) yang belum dikembalikan.
//
//   bounty_as      — daftar AS (inisial unik, disimpan HURUF BESAR: "jto" = "JTO")
//   bounty_items   — satu utang: jenis barang × jumlah, toko (opsional), keterangan, tanggal ditetapkan.
//                    qty_selesai = jumlah yang sudah kembali (boleh sebagian). Sisa = qty − qty_selesai.
//                    Hapus = soft delete (deleted_at/by) supaya utang tidak hilang tanpa jejak.
//   bounty_events  — riwayat: siapa membuat / mengubah / menandai selesai / membatalkan, kapan, catatan
//                    (mis. "dikembalikan ke Budi").
// Nilai bounty dihitung saat dibaca (Rp10.000 × sisa) — tidak disimpan.
// ══════════════════════════════════════════════════════════════════════════

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table bounty_as (
      id          uuid primary key default gen_random_uuid(),
      inisial     text not null,
      nama        text not null default '',
      created_by  text not null default '',
      created_at  timestamptz not null default now(),
      constraint bounty_as_inisial_check check (inisial = upper(inisial) and inisial ~ '^[A-Z0-9][A-Z0-9 ._-]{0,15}$')
    )
  `.execute(db);
  await sql`create unique index bounty_as_inisial_key on bounty_as (inisial)`.execute(db);

  await sql`
    create table bounty_items (
      id           uuid primary key default gen_random_uuid(),
      as_id        uuid not null references bounty_as (id) on delete restrict,
      jenis        text not null check (length(btrim(jenis)) between 1 and 100),
      qty          integer not null check (qty between 1 and 9999),
      qty_selesai  integer not null default 0,
      tujuan_id    uuid references sj_tujuan (id) on delete set null,
      keterangan   text not null default '' check (length(keterangan) <= 500),
      tanggal      date not null default current_date,
      created_by   text not null default '',
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now(),
      selesai_at   timestamptz,
      deleted_at   timestamptz,
      deleted_by   text,
      constraint bounty_items_selesai_check check (qty_selesai between 0 and qty),
      constraint bounty_items_selesai_at_check check ((qty_selesai = qty) = (selesai_at is not null))
    )
  `.execute(db);
  await sql`create index bounty_items_as_idx on bounty_items (as_id) where deleted_at is null`.execute(db);

  await sql`
    create table bounty_events (
      id        bigint generated always as identity primary key,
      item_id   uuid not null references bounty_items (id) on delete cascade,
      aksi      text not null check (aksi in ('buat', 'ubah', 'selesai', 'batal', 'hapus')),
      qty       integer,
      catatan   text not null default '' check (length(catatan) <= 500),
      oleh      text not null default '',
      at        timestamptz not null default now()
    )
  `.execute(db);
  await sql`create index bounty_events_item_idx on bounty_events (item_id, at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists bounty_events`.execute(db);
  await sql`drop table if exists bounty_items`.execute(db);
  await sql`drop table if exists bounty_as`.execute(db);
}
