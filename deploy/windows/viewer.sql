-- ══════════════════════════════════════════════════════════════════════════
-- Akun BACA-SAJA untuk melihat data produksi lewat pgAdmin (ARCHITECTURE D-36).
-- Dijalankan setup-viewer.ps1 sebagai superuser `postgres`. Aman diulang.
--   viewer_role  : nama role (default smartwms_viewer)
--   viewer_pw    : dari environment SMARTWMS_VIEWER_PW
--   dbname       : database produksi
--   owner_role   : pemilik tabel (agar tabel BARU dari migrasi berikutnya ikut terbaca)
-- ══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\getenv viewer_pw SMARTWMS_VIEWER_PW

select format('create role %I login password %L', :'viewer_role', :'viewer_pw')
where not exists (select 1 from pg_roles where rolname = :'viewer_role') \gexec
select format('alter role %I password %L', :'viewer_role', :'viewer_pw') \gexec

-- Semua transaksi akun ini read-only (lapisan pengaman kedua selain GRANT SELECT)
select format('alter role %I set default_transaction_read_only = on', :'viewer_role') \gexec

\connect :"dbname"
grant connect on database :"dbname" to :"viewer_role";
grant usage on schema public to :"viewer_role";
grant select on all tables in schema public to :"viewer_role";
alter default privileges for role :"owner_role" in schema public grant select on tables to :"viewer_role";

\echo 'OK - akun baca-saja' :viewer_role 'siap untuk database' :dbname
