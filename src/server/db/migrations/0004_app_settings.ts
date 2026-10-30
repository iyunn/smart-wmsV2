import { type Kysely, sql } from "kysely";

// ══════════════════════════════════════════════════════════════════════════
// 0004 — app_settings: penanda/setelan tingkat sistem (ARCHITECTURE D-38)
//
// Dipakai pertama untuk KUNCI IMPOR V1: baris key = 'import_v1_locked' di database produksi
// membuat scripts/import-v1.ts menolak jalan (impor = TRUNCATE semua tabel → data baru V2 hilang).
// Kunci dipasang otomatis oleh deploy/windows/deploy.ps1 dan restore.ps1 -Production.
//
// Hanya role pemilik (migrasi) yang bisa membaca/mengubah tabel ini — role aplikasi tidak,
// supaya bug/celah di aplikasi tidak bisa melepas kunci.
//
// `if not exists`: deploy/windows/import-lock.sql membuat tabel yang SAMA bila database produksi
// dipulihkan dari backup lama (sebelum 0004) — definisi kedua tempat harus tetap sama.
// ══════════════════════════════════════════════════════════════════════════

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table if not exists app_settings (
      key        text primary key,
      value      jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `.execute(db);
  // Default privileges (setup-db.sql) memberi DML ke role aplikasi → cabut lagi untuk tabel ini.
  await sql`
    do $$
    declare r record;
    begin
      for r in select distinct grantee from information_schema.role_table_grants
               where table_schema = 'public' and table_name = 'app_settings' and grantee <> current_user
      loop
        execute format('revoke all on table public.app_settings from %I', r.grantee);
      end loop;
    end $$
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table if exists app_settings`.execute(db);
}
