-- =============================================================================
-- SmartWMS V2 - KUNCI IMPOR V1 untuk database produksi (ARCHITECTURE D-38).
--
-- scripts/import-v1.ts mengosongkan (TRUNCATE) semua tabel lalu mengisinya dari Supabase.
-- Di database produksi yang sudah berisi data baru V2 itu = kehilangan data. Baris
-- app_settings.import_v1_locked membuat import-v1.ts menolak jalan, apa pun flag-nya.
--
-- Dijalankan otomatis (idempoten) oleh deploy.ps1 setiap deploy dan restore.ps1 -Production,
-- sebagai role pemilik. Tabel dibuat di sini juga (definisi = migrasi 0004) supaya kunci tetap
-- terpasang walau database dipulihkan dari backup yang lebih tua dari migrasi 0004.
--
-- MELEPAS kunci (jangan, kecuali benar-benar paham akibatnya): lihat DEPLOY-LOKAL.md §3.4.
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Hanya pemilik yang boleh baca/ubah (role aplikasi & viewer tidak).
do $$
declare r record;
begin
  for r in select distinct grantee from information_schema.role_table_grants
           where table_schema = 'public' and table_name = 'app_settings' and grantee <> current_user
  loop
    execute format('revoke all on table public.app_settings from %I', r.grantee);
  end loop;
end $$;

insert into public.app_settings (key, value)
values ('import_v1_locked', jsonb_build_object(
  'reason', 'Database produksi berisi data baru V2 - impor V1 (TRUNCATE) dilarang.',
  'by', :'locked_by'))
on conflict (key) do nothing;

select 'import_v1_locked sejak ' || to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'
from public.app_settings where key = 'import_v1_locked';
