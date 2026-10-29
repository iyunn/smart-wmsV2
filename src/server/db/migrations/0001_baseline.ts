import { type Kysely, sql } from "kysely";

// ══════════════════════════════════════════════════════════════════════════
// 0001 — Baseline skema V1 (ROADMAP Tahap 2b)
//
// Sumber: db/v1-snapshot/schema.sql (pg_dump Supabase production, PostgreSQL 17.6,
// 30 Okt 2026). Struktur tabel, kolom, default, constraint, dan index DISAMAKAN
// PERSIS dengan V1 agar kontrak API & data tidak berubah (ARCHITECTURE D-08).
//
// Sengaja TIDAK diikutkan (khusus Supabase):
//   - Semua policy RLS + ENABLE ROW LEVEL SECURITY (V2: akses DB hanya dari server)
//   - FK profiles.id → auth.users(id) dan function/trigger handle_new_user
//     (auth Supabase; diganti tabel app_users di Tahap 3)
//   - Function rls_auto_enable (event trigger milik Supabase)
//   - Schema `extensions`: default extensions.uuid_generate_v4() diganti
//     gen_random_uuid() bawaan PostgreSQL ≥ 13 (sama-sama UUID v4, tanpa extension)
//
// Tambahan V2:
//   - Zona waktu database dikunci ke UTC (ARCHITECTURE D-22) — sama dengan
//     Supabase. Tiga kolom V1 bertipe `timestamp` TANPA zona (assets_raw.uploaded_at,
//     assets_clean.created_at, classification_logs.processed_at) berisi jam UTC;
//     tanpa ini, now() di PostgreSQL Windows (zona WIB) akan menyimpan jam lokal.
// ══════════════════════════════════════════════════════════════════════════

const TABLES_DROP_ORDER = [
  // anak dulu, lalu induk (urutan foreign key)
  "surat_jalan_items",
  "staging_area",
  "pendingan_items",
  "surat_jalan",
  "sj_tujuan",
  "assets_clean",
  "assets_raw",
  "classification_logs",
  "asset_notes",
  "dat_closing",
  "keyword_rules",
  "lpp_raw",
  "profiles",
  "sj_item_templates",
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  // Zona waktu UTC untuk semua koneksi BARU ke database ini (D-22).
  // Butuh pemilik database → migrasi dijalankan smartwms_owner.
  await sql`
    do $$ begin
      execute format('alter database %I set timezone to %L', current_database(), 'UTC');
    end $$
  `.execute(db);
  // Sesi migrasi ini sendiri juga UTC (pengaturan di atas baru berlaku di koneksi baru).
  await sql`set local timezone to 'UTC'`.execute(db);

  // ── Aset (DAT Oracle) ────────────────────────────────────────────────────
  await sql`
    create table assets_raw (
      id               uuid default gen_random_uuid() not null,
      kode_asset       text,
      deskripsi        text,
      lokasi           text,
      status           text,
      source           text default 'DAT'::text,
      uploaded_at      timestamp without time zone default now(),
      toko             text,
      kategori_oracle  text,
      kuantitas        integer default 1,
      biaya_perolehan  bigint default 0,
      jumlah_tercatat  bigint default 0,
      invoice_number   text,
      tanggal_dokumen  text,
      sub_coce         text default '0'::text not null,
      is_prodsus       boolean default false not null,
      constraint assets_raw_pkey primary key (id),
      constraint assets_raw_kode_asset_unique unique (kode_asset)
    )
  `.execute(db);

  await sql`
    create table assets_clean (
      id                      uuid default gen_random_uuid() not null,
      raw_id                  uuid,
      original_description    text,
      normalized_description  text,
      jenis                   text,
      merk                    text,
      kategori                text,
      status                  text,
      confidence              text,
      created_at              timestamp without time zone default now(),
      tag                     text,
      constraint assets_clean_pkey primary key (id),
      constraint assets_clean_raw_id_unique unique (raw_id),
      constraint assets_clean_raw_id_fkey foreign key (raw_id)
        references assets_raw (id) on delete cascade
    )
  `.execute(db);

  await sql`
    create table classification_logs (
      id                    uuid default gen_random_uuid() not null,
      raw_id                uuid,
      original_description  text,
      result                jsonb,
      confidence            text,
      processed_at          timestamp without time zone default now(),
      constraint classification_logs_pkey primary key (id)
    )
  `.execute(db);

  await sql`
    create table keyword_rules (
      id          uuid default gen_random_uuid() not null,
      keyword     text not null,
      rule_type   text not null,
      value       text not null,
      created_at  timestamp with time zone default now(),
      constraint keyword_rules_pkey primary key (id)
    )
  `.execute(db);

  await sql`
    create table asset_notes (
      kode_asset  text not null,
      catatan     text not null,
      updated_at  timestamp with time zone default now(),
      constraint asset_notes_pkey primary key (kode_asset)
    )
  `.execute(db);

  await sql`
    create table dat_closing (
      id              uuid default gen_random_uuid() not null,
      bulan           text not null,
      cga             text not null,
      total_items     integer default 0 not null,
      total_qty       numeric default 0 not null,
      total_nilai     numeric default 0 not null,
      total_tercatat  numeric default 0 not null,
      uploaded_at     timestamp with time zone default now(),
      constraint dat_closing_pkey primary key (id),
      constraint dat_closing_bulan_cga_key unique (bulan, cga)
    )
  `.execute(db);

  // ── LPP Web Tracking ─────────────────────────────────────────────────────
  await sql`
    create table lpp_raw (
      id           uuid default gen_random_uuid() not null,
      kode_asset   text not null,
      toko         text not null,
      deskripsi    text,
      saldo_awal   integer default 0 not null,
      masuk        integer default 0 not null,
      keluar       integer default 0 not null,
      saldo_akhir  integer default 0 not null,
      uploaded_at  timestamp with time zone default now() not null,
      constraint lpp_raw_pkey primary key (id)
    )
  `.execute(db);

  // ── User (sementara; digabung ke app_users di Tahap 3) ───────────────────
  // FK ke auth.users dihapus — id tetap sama dengan id akun Supabase.
  await sql`
    create table profiles (
      id          uuid not null,
      username    text not null,
      nik         text not null,
      email       text not null,
      role        text default 'admin'::text not null,
      status      text default 'pending'::text not null,
      created_at  timestamp with time zone default now(),
      updated_at  timestamp with time zone default now(),
      theme       text default 'dark'::text not null,
      constraint profiles_pkey primary key (id),
      constraint profiles_role_check check (role = any (array['super_admin'::text, 'admin'::text])),
      constraint profiles_status_check check (status = any (array['pending'::text, 'active'::text, 'rejected'::text])),
      constraint profiles_theme_check check (theme = any (array['dark'::text, 'light'::text]))
    )
  `.execute(db);

  // ── Surat Jalan ──────────────────────────────────────────────────────────
  await sql`
    create table sj_tujuan (
      id          uuid default gen_random_uuid() not null,
      kode        text not null,
      nama        text not null,
      created_at  timestamp with time zone default now(),
      kota        text,
      kecamatan   text,
      constraint sj_tujuan_pkey primary key (id),
      constraint sj_tujuan_kode_key unique (kode)
    )
  `.execute(db);

  await sql`
    create table sj_item_templates (
      id          uuid default gen_random_uuid() not null,
      nama        text not null,
      items       jsonb default '[]'::jsonb not null,
      created_at  timestamp with time zone default now(),
      constraint sj_item_templates_pkey primary key (id),
      constraint sj_item_templates_nama_key unique (nama)
    )
  `.execute(db);

  await sql`
    create table surat_jalan (
      id           uuid default gen_random_uuid() not null,
      no_sj        text not null,
      tanggal      date not null,
      tujuan_id    uuid,
      pembawa      text,
      penerima     text,
      status       text default 'draft'::text not null,
      created_by   text default 'Admin User'::text,
      approved_by  text,
      created_at   timestamp with time zone default now(),
      updated_at   timestamp with time zone default now(),
      is_archived  boolean default false,
      jenis        text default 'keluar'::text not null,
      constraint surat_jalan_pkey primary key (id),
      constraint surat_jalan_no_sj_key unique (no_sj),
      constraint surat_jalan_jenis_check check (jenis = any (array['keluar'::text, 'masuk'::text])),
      constraint surat_jalan_tujuan_id_fkey foreign key (tujuan_id)
        references sj_tujuan (id) on delete restrict
    )
  `.execute(db);

  await sql`
    create table surat_jalan_items (
      id                    uuid default gen_random_uuid() not null,
      sj_id                 uuid,
      urutan                integer default 1 not null,
      jenis                 text,
      merk                  text,
      serial_number         text,
      qty                   integer default 1,
      satuan                text default 'Unit'::text,
      is_baru               boolean default false,
      is_aktiva             boolean default false,
      keterangan            text,
      mutasi_oracle_status  boolean default false,
      mutasi_oracle_at      timestamp with time zone,
      kode_asset            text,
      created_at            timestamp with time zone default now(),
      mutasi_wt_status      boolean default false,
      mutasi_wt_at          timestamp with time zone,
      constraint surat_jalan_items_pkey primary key (id),
      constraint surat_jalan_items_sj_id_fkey foreign key (sj_id)
        references surat_jalan (id) on delete cascade
    )
  `.execute(db);

  await sql`
    create table pendingan_items (
      id          uuid default gen_random_uuid() not null,
      tujuan_id   uuid not null,
      jenis       text not null,
      qty         integer default 1 not null,
      keterangan  text default ''::text,
      created_at  timestamp with time zone default now() not null,
      merk        text default ''::text,
      urgensi     text default 'sedang'::text,
      arah        text default 'kirim'::text,
      constraint pendingan_items_pkey primary key (id),
      constraint pendingan_items_qty_check check (qty > 0),
      constraint pendingan_items_tujuan_id_fkey foreign key (tujuan_id)
        references sj_tujuan (id) on delete cascade
    )
  `.execute(db);

  await sql`
    create table staging_area (
      id             uuid default gen_random_uuid() not null,
      kode_asset     text,
      jenis          text default ''::text,
      merk           text default ''::text,
      deskripsi      text default ''::text,
      catatan        text default ''::text,
      asal_toko      text default ''::text,
      is_at_lebih    boolean default false not null,
      sj_id          uuid,
      tanggal_masuk  date default current_date,
      created_at     timestamp with time zone default now(),
      updated_at     timestamp with time zone default now(),
      constraint staging_area_pkey primary key (id),
      constraint staging_area_sj_id_fkey foreign key (sj_id)
        references surat_jalan (id) on delete set null
    )
  `.execute(db);

  // ── Index (identik dengan V1) ────────────────────────────────────────────
  const indexes = [
    "create index idx_assets_clean_jenis on assets_clean using btree (jenis)",
    "create index idx_assets_clean_merk on assets_clean using btree (merk)",
    "create index idx_assets_clean_status on assets_clean using btree (status)",
    "create index idx_assets_clean_tag on assets_clean using btree (tag) where (tag is not null)",
    "create index idx_assets_raw_is_prodsus on assets_raw using btree (is_prodsus)",
    "create index idx_assets_raw_kode on assets_raw using btree (kode_asset)",
    "create index idx_assets_raw_toko on assets_raw using btree (toko)",
    "create index idx_assets_raw_toko_id on assets_raw using btree (toko, id)",
    "create index idx_assets_raw_uploaded_at on assets_raw using btree (uploaded_at desc)",
    "create index idx_dat_closing_bulan on dat_closing using btree (bulan)",
    "create index idx_dat_closing_cga on dat_closing using btree (cga)",
    "create index idx_lpp_raw_kode_asset on lpp_raw using btree (kode_asset)",
    "create index idx_lpp_raw_toko on lpp_raw using btree (toko)",
    "create index idx_pendingan_items_arah on pendingan_items using btree (arah)",
    "create index idx_pendingan_items_created on pendingan_items using btree (created_at)",
    "create index idx_pendingan_items_tujuan on pendingan_items using btree (tujuan_id)",
    "create index idx_pendingan_items_urgensi on pendingan_items using btree (urgensi)",
    "create index idx_profiles_role on profiles using btree (role)",
    "create index idx_profiles_status on profiles using btree (status)",
    "create index idx_sj_items_jenis on surat_jalan_items using btree (jenis)",
    "create index idx_sj_items_mutasi_status on surat_jalan_items using btree (mutasi_oracle_status)",
    "create index idx_sj_items_serial on surat_jalan_items using btree (serial_number)",
    "create index idx_sj_items_sj_id on surat_jalan_items using btree (sj_id)",
    "create index idx_sj_tujuan_kota on sj_tujuan using btree (kota)",
    "create index idx_staging_at_lebih on staging_area using btree (is_at_lebih)",
    "create index idx_staging_kode_asset on staging_area using btree (kode_asset)",
    "create index idx_surat_jalan_jenis on surat_jalan using btree (jenis)",
    "create index idx_surat_jalan_status on surat_jalan using btree (status)",
    "create index idx_surat_jalan_tanggal on surat_jalan using btree (tanggal desc)",
    "create index idx_surat_jalan_tujuan on surat_jalan using btree (tujuan_id)",
  ];
  for (const stmt of indexes) {
    await sql.raw(stmt).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of TABLES_DROP_ORDER) {
    await sql`drop table if exists ${sql.id(table)}`.execute(db);
  }
  await sql`
    do $$ begin
      execute format('alter database %I reset timezone', current_database());
    end $$
  `.execute(db);
}
