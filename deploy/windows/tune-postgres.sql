-- ══════════════════════════════════════════════════════════════════════════
-- Setelan PostgreSQL 18 untuk PC server SmartWMS (ARCHITECTURE D-34).
-- Dijalankan setup-server.ps1 sebagai superuser `postgres`; berlaku setelah service
-- PostgreSQL di-restart. Aman dijalankan ulang (ALTER SYSTEM menimpa nilai lama).
-- Nilai disimpan di postgresql.auto.conf — lihat: select name, setting from pg_settings where source = 'configuration file';
--
-- Patokan: RAM 8 GB, NVMe, < 20 pengguna LAN, database < 1 GB.
-- Setelah RAM di-upgrade ke 16 GB: effective_cache_size = '8GB' (shared_buffers tetap,
-- di Windows nilai besar tidak menambah kecepatan).
-- ══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- Keamanan: hanya terima koneksi dari PC ini sendiri (installer EDB default '*')
alter system set listen_addresses = 'localhost';

-- Memori
alter system set shared_buffers = '512MB';
alter system set effective_cache_size = '3GB';
alter system set work_mem = '16MB';
alter system set maintenance_work_mem = '256MB';

-- Koneksi: pool aplikasi produksi 10 + dev 10 + migrasi/backup/pgAdmin
alter system set max_connections = 50;

-- Disk NVMe: akses acak hampir semurah berurutan
alter system set random_page_cost = 1.1;

-- Log query lambat (> 1 detik) untuk diagnosa
alter system set log_min_duration_statement = '1s';

\echo 'OK - setelan tersimpan. Restart service PostgreSQL agar berlaku.'
