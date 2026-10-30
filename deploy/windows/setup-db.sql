-- ══════════════════════════════════════════════════════════════════════════
-- Setup database SmartWMS V2 (ARCHITECTURE D-20, D-32). Jalankan SEKALI per database
-- sebagai superuser `postgres`.
--
--   Dev  : psql -U postgres -v dbname=smartwms_dev -v owner_pw='...' -v app_pw='...' -f deploy/windows/setup-db.sql
--   Prod : dijalankan otomatis oleh deploy/windows/setup-server.ps1
--          (dbname=smartwms, owner_role=smartwms_prod_owner, app_role=smartwms_prod_app)
--
-- Dua role per lingkungan:
--   owner_role → pemilik database & tabel; dipakai migrasi (DATABASE_URL_OWNER)
--   app_role   → dipakai aplikasi; hanya SELECT/INSERT/UPDATE/DELETE (DATABASE_URL)
-- Default nama role: smartwms_owner & smartwms_app (dev). Produksi memakai role sendiri
-- supaya kredensial dev di .env.local tidak bisa masuk ke database produksi (D-32).
-- Kalau role sudah ada, pembuatan role dilewati dan password TIDAK diubah.
-- ══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

\if :{?owner_role}
\else
  \set owner_role smartwms_owner
\endif
\if :{?app_role}
\else
  \set app_role smartwms_app
\endif

-- Password boleh dari -v (dev) atau dari environment SMARTWMS_OWNER_PW / SMARTWMS_APP_PW
-- (setup-server.ps1 — supaya password tidak terlihat di daftar proses)
\if :{?owner_pw}
\else
  \getenv owner_pw SMARTWMS_OWNER_PW
\endif
\if :{?app_pw}
\else
  \getenv app_pw SMARTWMS_APP_PW
\endif

-- 1. Role (dibuat hanya bila belum ada)
select format('create role %I login password %L', :'owner_role', :'owner_pw')
where not exists (select 1 from pg_roles where rolname = :'owner_role') \gexec

select format('create role %I login password %L', :'app_role', :'app_pw')
where not exists (select 1 from pg_roles where rolname = :'app_role') \gexec

-- -v sync_pw=1 → samakan password role yang SUDAH ada dengan nilai di atas (dipakai setup-server.ps1
-- saat kredensial produksi dibuat ulang). Tanpa flag ini password lama tidak disentuh.
\if :{?sync_pw}
  select format('alter role %I password %L', :'owner_role', :'owner_pw') \gexec
  select format('alter role %I password %L', :'app_role', :'app_pw') \gexec
\endif

-- 2. Database (UTF8, dimiliki owner_role)
select format('create database %I owner %I encoding %L template template0', :'dbname', :'owner_role', 'UTF8')
where not exists (select 1 from pg_database where datname = :'dbname') \gexec

-- 3. Hak akses di dalam database
\connect :"dbname"

revoke all on database :"dbname" from public;
grant connect, temporary on database :"dbname" to :"app_role";

-- Schema public milik owner; app hanya boleh memakai, bukan membuat objek
alter schema public owner to :"owner_role";
revoke create on schema public from public;
grant usage on schema public to :"app_role";

-- Tabel/sequence/function yang DIBUAT owner nanti (lewat migrasi) otomatis bisa dipakai app
alter default privileges for role :"owner_role" in schema public
  grant select, insert, update, delete on tables to :"app_role";
alter default privileges for role :"owner_role" in schema public
  grant usage, select on sequences to :"app_role";
alter default privileges for role :"owner_role" in schema public
  grant execute on functions to :"app_role";

\echo
\echo 'OK - database' :dbname 'siap (owner' :owner_role ', app' :app_role ').'
