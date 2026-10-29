-- ══════════════════════════════════════════════════════════════════════════
-- Snapshot V1 (Supabase) — READ-ONLY. Dipanggil oleh scripts/v1/snapshot.sh.
-- Hasil dipakai untuk menulis migrasi baseline (Tahap 2b) dan sebagai patokan
-- pembanding jumlah baris saat impor data (Tahap 2c).
-- ══════════════════════════════════════════════════════════════════════════

\pset footer off

\echo '== Versi server'
select version();

\echo
\echo '== Jumlah baris per tabel (schema public, dihitung exact)'
select t.table_name as tabel,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from public.%I', t.table_name), false, true, '')))[1]::text::bigint as baris
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
order by 1;

\echo
\echo '== Akun di auth.users (hanya jumlah & 4 karakter awal hash — bukan hash-nya)'
select coalesce(left(encrypted_password, 4), '(kosong)') as prefix_hash, count(*) as jumlah
from auth.users
group by 1
order by 1;

\echo
\echo '== Foreign key dari public ke schema lain (mis. auth.users) — perlu diarahkan ulang di V2'
select con.conrelid::regclass::text as dari_tabel,
       con.conname as constraint_name,
       con.confrelid::regclass::text as ke_tabel
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_class rc on rc.oid = con.confrelid
join pg_namespace rn on rn.oid = rc.relnamespace
where con.contype = 'f' and n.nspname = 'public' and rn.nspname <> 'public'
order by 1, 2;

\echo
\echo '== Trigger di auth.users yang memanggil function public'
select t.tgname as trigger_name, p.proname as function_name
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal and t.tgrelid = 'auth.users'::regclass
order by 1;

\echo
\echo '== Extension terpasang'
select extname, extversion from pg_extension order by 1;
