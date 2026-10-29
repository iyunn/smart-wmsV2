# ROADMAP — SmartWMS V2

> Urutan kerja V2. **Setiap tahap berdiri sendiri dan diakhiri STOP** — Claude berhenti,
> Fillian apply + test + push, lalu konfirmasi sebelum tahap berikutnya (`chat-rule.md` §3).
> Repo V1: `github.com/iyunn/smart-warehouse-management-system` · Repo V2: `github.com/iyunn/smart-wmsV2`
> Status: ⬜ belum · 🚧 dikerjakan · ✅ selesai · ⏸ ditunda
> Terakhir diupdate: 30 Oktober 2026

Setiap kali tahap selesai: update status di file ini + entry baru di `development-journal.md`.

---

## Ringkasan

| Tahap | Nama | Repo | Status |
|---|---|---|---|
| 0a | Hotfix keamanan V1 — kode | V1 | ⏸ dilewati |
| 0b | Hotfix keamanan V1 — SQL RLS | V1 (Supabase) | ⏸ dilewati |
| 1a | Setup repo V2 (clone + remote baru + dokumen) | V2 | ✅ |
| 1b | Fondasi V2 (PostgreSQL dev, dependency, `src/server/db`) | V2 | ✅ |
| 2a | Snapshot skema & jumlah baris Supabase | V2 | ✅ |
| 2b | Migrasi `0001_baseline` | V2 | ✅ |
| 2c | Impor data V1 + pembanding jumlah baris | V2 | ✅ |
| 3a | Auth — database & inti server | V2 | ✅ |
| 3b | Auth — login, register, proxy, sesi di UI | V2 | 🚧 |
| 3c | Auth — manajemen user & ganti password | V2 | ⬜ |
| 4a–4f | Data layer per domain (Supabase → Kysely) | V2 | ⬜ |
| 5 | Tema light — token & fondasi (T1–T2) | V2 | ⬜ |
| 6 | Server Windows & backup | PC server | ⬜ |
| 7 | UAT & cutover | — | ⬜ |
| 8 | Tema per halaman (T3) + Live Stock (T4) | V2 | ⬜ |
| 9 | Improvement V2 (PRD §5.D) | V2 | ⏸ menunggu pilihan |

Branch kerja di repo V2: `main`. Fitur besar boleh pakai branch sementara (`feat/...`) lalu merge.

---

> **Tahap 0a & 0b dilewati** (keputusan Fillian, 30 Okt 2026): V1 akan ditinggalkan saat migrasi lokal.
> Konsekuensi: data Supabase V1 tetap terbuka sampai cutover → Tahap 7 **wajib** memutus akses Supabase
> di hari cutover. Rencana di bawah disimpan sebagai referensi bila keputusan berubah.

## Tahap 0a — Hotfix keamanan V1: kode ⏸ (repo V1)
**Tujuan:** tidak ada lagi kode yang memakai anon key hardcoded; semua query server pakai client server-only.
- Buat `src/lib/supabase-client/admin.ts` (service role, menolak dipanggil dari browser)
- 23 route API berjalan sebagai anon: 11 impor `@/lib/supabaseClient` + 12 membuat client anon sendiri → semua pakai `admin.ts`;
  `admin/users` juga dipindah ke `admin.ts` (satu sumber service role)
  (kalau tidak, route anon ikut rusak saat RLS diperketat di 0b)
- 3 file client (`KeywordRulesTab`, `useKeywordRule`, `useReviewAssets`): pakai browser client ber-sesi (`supabase-client/client.ts`)
- Hapus `src/lib/supabaseClient.ts`
- SQL audit (read-only) untuk melihat status RLS & policy production
**Selesai bila:** semua halaman jalan normal di Vercel setelah deploy; hasil SQL audit dikirim ke Claude.
**STOP**

## Tahap 0b — Hotfix keamanan V1: SQL RLS ⏸ (Supabase V1)
**Tujuan:** role `anon` tidak bisa membaca/menulis tabel apa pun; hanya user login berstatus `active`.
- Function `public.is_active_user()` (SECURITY DEFINER, anti-rekursi)
- Ganti policy allow-all → `TO authenticated USING (is_active_user())`
- `profiles`: baca milik sendiri; update hanya kolom `theme`
- Uji dengan `curl` + anon key → harus kosong/ditolak
**Selesai bila:** curl anon gagal, aplikasi tetap jalan untuk user aktif.
**STOP**

## Tahap 1a — Setup repo V2 ✅
- Tag `v1.0-cloud-ta` pada commit TA terakhir (`17e9862`), di-push ke repo V1 dan V2
- Folder lokal V2 = clone repo V1 → remote `origin` diarahkan ke `smart-wmsV2`, remote `v1` ke repo lama
- `.gitattributes` (LF, ARCHITECTURE D-19), README V2, dokumen `docs/v2/*` + `docs/chat-rule.md` V2
**Selesai bila:** `smart-wmsV2` berisi histori V1 + commit dokumen V2; `npm run dev` jalan lokal (masih Supabase).
**STOP**

## Tahap 1b — Fondasi V2 ✅
- Prasyarat di PC dev: Node.js 24 LTS (minimal 22.12), PostgreSQL 18 (installer EDB, termasuk pgAdmin 4)
- `deploy/windows/setup-db.sql` → role `smartwms_owner` + `smartwms_app`, database `smartwms_dev` (D-20)
- Dependency: `kysely`, `pg`, `bcryptjs`, `zod`, `server-only`; dev: `kysely-codegen`, `vitest`, `tsx`, `@types/pg`, `@types/node@24`
- `src/server/db/{create,index,migrate,types}.ts`, `migrations/`, `.kysely-codegenrc.json`, `.env.example` (+ `!.env.example` di `.gitignore`)
- Script npm: `dev` (port 3001), `db:migrate` (`latest`/`down`/`status`/`check`), `db:codegen`, `test`
**Selesai bila:** `npm run db:migrate -- check` terhubung ke PostgreSQL 18, `npm run db:migrate` & `npm run db:codegen` jalan tanpa error, `npm run dev` tetap jalan.
**STOP**

## Tahap 2 — Skema baseline & migrasi data
Dipecah tiga karena baseline harus ditulis dari skema **production** asli, bukan dari dokumentasi.

### 2a — Snapshot V1 ✅
- `bash scripts/v1/snapshot.sh` (read-only) → `db/v1-snapshot/schema.sql` + `db/v1-snapshot/row-counts.txt`
- Isi snapshot: struktur public, jumlah baris exact per tabel, prefix hash `auth.users`, FK ke schema lain, trigger `auth.users`, extension
**Selesai bila:** dua file snapshot ter-push ke repo.
**STOP**

### 2b — Migrasi baseline ✅
- `src/server/db/migrations/0001_baseline.ts` dari snapshot: tabel, constraint, index, function yang dipakai
- Dibuang: policy & `ENABLE ROW LEVEL SECURITY`, grant role Supabase (`anon`/`authenticated`/`service_role`), FK & trigger ke `auth.*` (ditangani Tahap 3), function `rls_auto_enable`; `extensions.uuid_generate_v4()` → `gen_random_uuid()`
- Database dikunci UTC (D-22); parser `timestamp` tanpa zona (D-21)
- `npm run db:codegen` → `types.ts`
**Selesai bila:** `npm run db:migrate` membuat semua tabel di `smartwms_dev`; `types.ts` berisi semua tabel V1.
**STOP**

### 2c — Impor data ✅
- `npm run db:import-v1 -- --confirm <db>`: salin 14 tabel public Supabase → lokal dengan `COPY` (ARCHITECTURE D-23); urut induk → anak; **satu transaksi** di tujuan (gagal = ROLLBACK); sumber dibaca READ ONLY dari satu snapshot; bisa diulang — dipakai lagi saat cutover
- Verifikasi otomatis per tabel: jumlah baris + checksum md5 isi, harus identik
- Data akun (`auth.users`) ditunda ke Tahap 3
**Selesai bila:** semua tabel cocok 100% dengan `row-counts.txt` / hitungan langsung.
**STOP**

## Tahap 3 — Auth V2
Dipecah tiga. Aturan auth lengkap: ARCHITECTURE §5.

### 3a — Database & inti server ✅
- Migrasi `0002_auth.ts`: `app_users`, `user_sessions`; `profiles` dihapus
- `db:import-v1` mengisi `app_users` dari `profiles` + hash `auth.users` (cek email/username kembar dulu)
- `src/server/auth/`: `policy.ts`, `password.ts`, `tokens.ts`, `session.ts`, `login.ts` + unit test
- UI **belum** berubah (V1 masih login lewat Supabase)
**Selesai bila:** migrasi & impor jalan; `app_users` berisi 4 akun dengan hash `$2a$10$`; `npm test` lolos.
**STOP**

### 3b — Login, register, proxy 🚧
- Cookie sesi + `requireUser()`/`requireSuperAdmin()`; `proxy.ts` baru (cek cookie, tanpa Supabase)
- API `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/me` (+ simpan tema)
- Halaman `/login` (email atau username) & `/register`; `SessionContext` & `ThemeContext` tanpa Supabase
- Hapus `/forgot-password`, `/auth/callback`, `/auth/reset-password`, `src/lib/supabase-client/{client,server,middleware}.ts`
- `/api/admin/users` sementara: daftar user dari `app_users` (read-only); aksi ubah → 503 sampai 3c
**Selesai bila:** login akun V1 dengan password lama berhasil, logout, tema tersimpan, halaman terproteksi.
**STOP**

### 3c — Manajemen user ⬜
- `/admin/users` + API: approve/reject/aktifkan, ubah role, tambah, hapus, **reset password** (password sementara + wajib ganti)
- Halaman ganti password (wajib bila `must_change_password`); ganti/reset → sesi lain dicabut
- Tidak boleh menonaktifkan / menurunkan role / menghapus diri sendiri atau Super Admin terakhir
**Selesai bila:** semua aksi Manajemen User V1 jalan + reset password.
**STOP**

## Tahap 4 — Data layer per domain ⬜
Setiap sub-tahap: route diganti ke Kysely, **kontrak API sama** (ARCHITECTURE D-08), diuji di halaman terkait. **STOP di setiap sub-tahap.**

**Wajib di setiap route yang dimigrasi:** `requireUser()` (atau `requireSuperAdmin()`) di baris pertama handler. Sampai route dimigrasi, route data V1 hanya dijaga proxy (cek cookie) — celah ini harus tertutup sebelum cutover (PRD §7).

| Sub | Domain | Route |
|---|---|---|
| 4a | Master & ringan | `sj/tujuan`, `sj/templates`, `sj/master/jenis`, `sj/master/merk`, `keyword-rules/values`, `freshness` + `KeywordRulesTab`/`useKeywordRule` via API |
| 4b | Upload pipeline | `process`, `process/clear`, `lpp/process`, `lpp/clear`, `closing`, `staging`, `sj/import-wt` |
| 4c | Surat Jalan | `sj`, `pendingan`, `sj/report` |
| 4d | Analisa | `monitoring`, `lpp/monitoring`, `reconciliation`, `reclassify` + `useReviewAssets` via API |
| 4e | Dashboard & laporan | `dashboard/stats`, `stock/live`, `reports/dat-summary` (agregasi di SQL, D-10) |
| 4f | Bersih-bersih | Hapus `@supabase/*`, `supabase-client/`, env Supabase; file sampah V1 (mis. `(tailwind.config.ts)`, `bckp/`, daftar dikonfirmasi dulu); `next.config.ts` → `output: 'standalone'` |

## Tahap 5 — Tema light: token & fondasi ⬜
- **T1:** nilai token light di `globals.css` diganti sesuai STYLEGUIDE; override lapisan kompatibilitas diarahkan ke `var()` → seluruh app ikut palet baru
- **T2:** font `@fontsource` (hapus `next/font/google`), latar `.app-backdrop`, utilitas `glass`/`glass-bar` untuk Topbar/Sidebar/modal, radius, bayangan, `:focus-visible`
**Selesai bila:** semua halaman terbaca di light & dark; tidak ada teks < 4,5:1.
**STOP**

## Tahap 6 — Server Windows & backup ⬜
- Prasyarat: izin IT (PRD Q2), spesifikasi PC (Q4)
- PostgreSQL 18 (lewati install bila PC dev = PC server), buat DB `smartwms` + user `smartwms_app`, `listen_addresses='localhost'`
- Build standalone, WinSW service, firewall port 3000, IP tetap (DHCP reservation)
- Backup harian Task Scheduler + uji restore
- Runbook: `docs/v2/DEPLOY-LOKAL.md` (instalasi, update versi, restore, troubleshooting)
**Selesai bila:** server jalan setelah restart PC; restore teruji.
**STOP**

## Tahap 7 — UAT & cutover ⬜
- Checklist UAT per modul (PRD §5.B) di server lokal
- Freeze input V1 (akhir pekan) → dump terakhir → import → compare-counts
- Pengguna pindah ke URL LAN
- **Hari itu juga:** pause project Supabase (atau cabut akses `anon`) — celah V1 tidak ditutup di Tahap 0; dump terakhir disimpan sebagai cadangan
- Matikan project Vercel V1; setelah masa cadangan, archive repo V1 (read-only)
**Selesai bila:** semua kriteria PRD §7 tercentang.
**STOP**

## Tahap 8 — Tema per halaman ⬜
- **T3:** per halaman: pakai class token, sentence case (ganti `uppercase`), ukuran font minimal, tombol ≥ 40px; hapus override lapisan kompatibilitas halaman tersebut
- Urutan: Pendingan → Upload → Rekap Alokasi → Daftar SJ → Buat SJ → Monitoring → Dashboard → Review → Reconciliation → Auth
- **T4:** Live Stock terakhir, uji di resolusi TV
**STOP per halaman**

## Tahap 9 — Improvement V2 ⏸
Menunggu pilihan Fillian dari PRD §5.D. Setiap improvement mendapat sub-tahap sendiri di sini.
