-- ══════════════════════════════════════════════════════════════════════════
-- Setup database SmartWMS V2 (ARCHITECTURE D-20). Jalankan SEKALI per database
-- sebagai superuser `postgres`. Aman dijalankan untuk dev maupun produksi:
--
--   psql -U postgres -v dbname=smartwms_dev -v owner_pw='...' -v app_pw='...' -f deploy/windows/setup-db.sql
--   (produksi: dbname=smartwms)
--
-- Dua role:
--   smartwms_owner → pemilik database & tabel; dipakai migrasi (DATABASE_URL_OWNER)
--   smartwms_app   → dipakai aplikasi; hanya SELECT/INSERT/UPDATE/DELETE (DATABASE_URL)
-- Kalau role sudah ada (setup database kedua), pembuatan role dilewati dan
-- password tidak diubah.
-- ══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- 1. Role (dibuat hanya bila belum ada)
select format('create role smartwms_owner login password %L', :'owner_pw')
where not exists (select 1 from pg_roles where rolname = 'smartwms_owner') \gexec

select format('create role smartwms_app login password %L', :'app_pw')
where not exists (select 1 from pg_roles where rolname = 'smartwms_app') \gexec

-- 2. Database (UTF8, dimiliki smartwms_owner)
select format('create database %I owner smartwms_owner encoding %L template template0', :'dbname', 'UTF8')
where not exists (select 1 from pg_database where datname = :'dbname') \gexec

-- 3. Hak akses di dalam database
\connect :"dbname"

revoke all on database :"dbname" from public;
grant connect, temporary on database :"dbname" to smartwms_app;

-- Schema public milik owner; app hanya boleh memakai, bukan membuat objek
alter schema public owner to smartwms_owner;
revoke create on schema public from public;
grant usage on schema public to smartwms_app;

-- Tabel/sequence/function yang DIBUAT owner nanti (lewat migrasi) otomatis bisa dipakai app
alter default privileges for role smartwms_owner in schema public
  grant select, insert, update, delete on tables to smartwms_app;
alter default privileges for role smartwms_owner in schema public
  grant usage, select on sequences to smartwms_app;
alter default privileges for role smartwms_owner in schema public
  grant execute on functions to smartwms_app;

\echo
\echo 'OK - database' :dbname 'siap. Isi .env.local dengan DATABASE_URL (smartwms_app) & DATABASE_URL_OWNER (smartwms_owner).'
