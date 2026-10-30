# ARCHITECTURE — SmartWMS V2

> Keputusan teknis & konvensi kode V2. Setiap keputusan punya ID (`D-xx`) agar bisa dirujuk
> dari kode, commit, dan dokumen lain.
> Dibuat: 30 Oktober 2026. Keputusan yang diganti **tidak dihapus** — tandai `DIGANTI oleh D-yy`.

---

## 1. Gambaran Sistem

```
Browser di LAN kantor
   │  http://<IP-server>:3000   (satu-satunya port yang dibuka di Windows Firewall)
   ▼
Next.js 16 (output: standalone) ── Windows Service
   ├─ Halaman (React 19, Tailwind v4)
   ├─ Route Handlers /api/*   ← kontrak API sama dengan V1 selama fase paritas
   └─ src/server/**           ← satu-satunya kode yang boleh menyentuh database
          │  node-postgres (pool) + Kysely
          ▼
PostgreSQL 18 ── Windows Service, listen_addresses = 'localhost'
          │
          └─ pg_dump harian (Task Scheduler) → D:\backup\smartwms\ (14 hari) + salinan mingguan di luar disk
```

## 2. Decision Log

| ID | Keputusan | Alasan | Alternatif yang ditolak |
|---|---|---|---|
| **D-01** | Database **PostgreSQL 18**, native Windows (installer EDB, sudah termasuk pgAdmin 4) | Skema V1 sudah PostgreSQL (`uuid`, `timestamptz`, `jsonb`, `ON CONFLICT`) → pindah via `pg_dump` tanpa konversi. Dukungan resmi sampai Nov 2030 | MySQL/XAMPP (perlu konversi tipe & tulis ulang query; XAMPP untuk dev, bukan produksi); SQLite (dialek beda, rewrite total) |
| **D-02** | Akses data **Kysely + `pg`** (node-postgres), tanpa PostgREST | SQL penuh (JOIN, GROUP BY, view, CTE) → agregasi pindah ke DB; type-safe; tidak ada limit 1.000 baris; satu service lebih sedikit di server | PostgREST (cepat untuk migrasi tapi terbatas untuk query kompleks); Supabase self-host Docker (terlalu berat, Docker Desktop berbayar untuk perusahaan besar); ORM berat |
| **D-03** | Tipe DB di-generate dari skema dengan **`kysely-codegen`** → `src/server/db/types.ts` | DB-first: skema V1 sudah ada, tipe mengikuti database, bukan ditulis tangan | Menulis interface tabel manual (rawan tidak sinkron) |
| **D-04** | Migrasi skema pakai **Kysely Migrator**, file di `src/server/db/migrations/` | Terversi di git, urutan jelas, bisa diulang di dev & produksi | SQL lepas di `Miscellaneous/` (pola V1, tidak terlacak) |
| **D-05** | **Auth sendiri**: tabel `app_users` + `user_sessions`, password **bcryptjs**, cookie sesi httpOnly berisi token acak; sesi divalidasi ke DB | Bisa impor hash bcrypt Supabase; sesi bisa dicabut seketika (user dinonaktifkan → semua sesi hapus); `bcryptjs` pure JS → tanpa kompilasi native di Windows | Auth.js (lapisan tambahan untuk kebutuhan sederhana); JWT stateless (sulit dicabut) |
| **D-06** | `src/proxy.ts` hanya cek **ada/tidaknya cookie berbentuk sah** (optimistic): tanpa cookie → halaman di-redirect ke `/login?next=…`, API → 401 JSON. Validasi sesi penuh di server dekat data: `requireUser()`/`requireSuperAdmin()` di **setiap** Route Handler data, dan `GET /api/me` di setiap halaman (menghapus cookie basi agar tidak terjadi loop redirect) | Di Next.js 16 proxy berjalan di runtime Node.js untuk setiap request termasuk prefetch, dan dianjurkan tidak melakukan query database | Validasi DB di proxy |
| **D-07** | Lupa password via email **dihapus**, diganti reset oleh Super Admin + wajib ganti password saat login berikutnya | Tidak ada SMTP di LAN | SMTP relay (butuh internet & izin IT) |
| **D-08** | **Kontrak API dipertahankan** selama fase paritas: isi Route Handler diganti, bentuk request/response tetap | Halaman & hook V1 (±14 ribu baris TSX) tidak perlu ditulis ulang; regresi mudah dilacak per route | Rewrite ke Server Actions sekaligus |
| **D-09** | Validasi input API dengan **zod** di semua route yang dimigrasi/baru — **DIPERSEMPIT oleh D-26** | Batas sistem yang jelas; pesan error konsisten | Validasi manual per route |
| **D-10** | **Agregasi di database** (SQL `GROUP BY`/view), bukan loop di JavaScript. Filter & pagination client-side tetap boleh untuk data < ±10.000 baris | LAN cepat → mengirim beberapa ribu baris masih ringan; agregasi di DB jauh lebih efisien | Semua server-side (berlebihan untuk skala sekarang) |
| **D-11** | Aturan V1 "wajib pagination loop `.range()`" **tidak berlaku di V2** (tidak ada limit PostgREST). Diganti: query tabel besar wajib punya `WHERE` / `LIMIT` yang disengaja | Akar masalah (truncate 1.000 baris) hilang | — |
| **D-12** | Next.js `output: 'standalone'` dijalankan sebagai **Windows Service via WinSW** (NSSM sebagai alternatif). Diterapkan Tahap 6a: WinSW v2.12.0, akun **LocalService**, `node --env-file=C:\SmartWMS\config\smartwms.env`, bergantung pada service PostgreSQL, restart otomatis bila crash | Auto-start setelah reboot tanpa login Windows; log ke file; akun tanpa hak admin (LocalSystem terlalu kuat untuk proses web) | PM2 (startup di Windows butuh tool tambahan) |
| **D-13** | **Dev & prod sama-sama native Windows** + PostgreSQL 18. Database terpisah: `smartwms_dev` (dev) dan `smartwms` (prod); `next dev` di port **3001**, service produksi di **3000** | Lingkungan dev = produksi (tidak ada beda Linux vs Windows); DB & port terpisah aman walau dev dan server di PC yang sama | Codespace + Docker Compose (rencana awal, ditinggalkan 30 Okt 2026 karena Fillian develop di PC lokal) |
| **D-14** | **Repo baru `github.com/iyunn/smart-wmsV2`**, diawali clone repo V1 (setelah hotfix Tahap 0a) **beserta histori git**. Repo V1 tetap deploy ke Vercel sampai cutover; tag **`v1.0-cloud-ta`** di repo V1 (commit sebelum hotfix) | V1 tidak terganggu; histori & journal tetap nyambung; versi TA bisa direproduksi | Branch `v2` di repo lama (rencana awal, diganti karena Fillian membuat repo baru); repo baru tanpa histori (kehilangan `git blame` & konteks commit) |
| **D-15** | Font di-host sendiri: **Plus Jakarta Sans Variable** (UI) + **JetBrains Mono Variable** (kode aset/serial) via `@fontsource-variable/*` (terpasang Tahap 5, diimpor di `layout.tsx`) | `next/font/google` butuh internet saat build | Google Fonts |
| **D-16** | Light theme mengikuti `STYLEGUIDE.md` (diadaptasi dari STYLEGUIDE AYAMSMART); **dark mode dipertahankan** — **DIGANTI oleh D-30** | Permintaan Fillian; dark sudah dipakai | Light-only |
| **D-17** | Parsing file upload (TXT DAT, LPP .xls-HTML, PDF WT) **tetap di browser**; hasil dikirim ke API per batch | Parser V1 sudah teruji; server tidak terbebani parsing | Parsing di server |
| **D-18** | Uji otomatis dengan **Vitest** untuk logika murni (parser, classifier, kalkulasi) + skrip **pembanding jumlah baris** untuk migrasi data | Paling banyak bug V1 ada di logika batch & parsing | Tanpa test / E2E penuh (terlalu mahal sekarang) |
| **D-19** | Line ending **LF** di repo lewat `.gitattributes` (`* text=auto eol=lf`) | Develop di Windows; mencegah diff palsu CRLF/LF dan script yang rusak | Mengandalkan setelan `core.autocrlf` tiap mesin |
| **D-20** | **Dua role database:** `smartwms_owner` (pemilik DB & tabel, dipakai migrasi lewat `DATABASE_URL_OWNER`) dan `smartwms_app` (hanya SELECT/INSERT/UPDATE/DELETE, dipakai aplikasi lewat `DATABASE_URL`). Dibuat dengan `deploy/windows/setup-db.sql`. Pabrik koneksi `src/server/db/create.ts` sengaja tanpa `server-only` agar bisa dipakai skrip CLI | Bila aplikasi kebobolan (mis. SQL injection), penyerang tidak bisa DROP/ALTER tabel; superuser `postgres` tidak pernah dipakai aplikasi. Paket `server-only` melempar error bila diimpor di luar Next.js | Satu user untuk semua (lebih simpel, tapi aplikasi punya hak DDL) |
| **D-21** | Parser tipe `pg` disamakan dengan bentuk data V1: `int8` & `numeric` → `number`, `date` → string `YYYY-MM-DD`, `timestamp` (tanpa zona) → string `YYYY-MM-DDTHH:MM:SS` seperti PostgREST; `timestamptz` tetap `Date`. Opsi `kysely-codegen` di `.kysely-codegenrc.json` mengikuti | Kontrak API V1 tetap (D-08); default `pg` menganggap `date`/`timestamp` sebagai jam lokal proses Node (WIB) sehingga bergeser saat jadi JSON | Default `pg` (string untuk int8/numeric, Date untuk date/timestamp) |
| **D-22** | Database dikunci ke zona waktu **UTC** (`ALTER DATABASE ... SET timezone`, di migrasi 0001) | Sama dengan Supabase. Tiga kolom V1 bertipe `timestamp` tanpa zona (`assets_raw.uploaded_at`, `assets_clean.created_at`, `classification_logs.processed_at`) berisi jam UTC; installer PostgreSQL Windows memakai zona OS (WIB) sehingga `now()` akan menyimpan jam lokal | Mengubah tiga kolom itu ke `timestamptz` (lebih benar, tapi mengubah bentuk data API → kandidat improvement setelah paritas) |
| **D-23** | Impor data V1 (`scripts/import-v1.ts`) memakai **`COPY` format teks PostgreSQL** via `pg-copy-streams`: sumber dalam transaksi READ ONLY + REPEATABLE READ, tujuan dalam satu transaksi (TRUNCATE → COPY → verifikasi jumlah baris + checksum md5 per tabel → COMMIT). Wajib `--confirm <nama_db>` | Nilai pindah persis tanpa konversi tipe di JavaScript (array `jsonb`, `numeric` presisi tinggi, `timestamp`); satu snapshot konsisten; gagal = database lokal utuh; aman diulang saat cutover | `SELECT` lalu `INSERT` lewat JS (rawan salah konversi jsonb/numeric/timezone); `pg_dump` + `pg_restore` data (tidak ada verifikasi & tidak bisa menolak beda skema) |
| **D-24** | Aturan yang bergantung pada beberapa baris (mis. "Super Admin aktif terakhir") dicek dalam transaksi dengan **satu** `SELECT ... ORDER BY id FOR UPDATE` yang mengunci semua baris terkait sekaligus | Urutan kunci selalu sama → tidak deadlock; transaksi kedua menunggu lalu melihat kondisi terbaru. Terbukti: versi dua-query (kunci target dulu, lalu Super Admin lain) deadlock 4 dari 6 percobaan | Cek di UI saja; dua query `FOR UPDATE` terpisah |
| **D-25** | Urutan keyword rule untuk classifier: **rule terlama menang** (`ORDER BY created_at, id`). Daftar di halaman Classification tetap terbaru dulu | Classifier memakai "aturan pertama yang cocok menang". V1 tidak pernah menentukan urutan (PostgREST mengembalikan urutan fisik tabel, yang berubah setelah rule di-edit/VACUUM) → hasil klasifikasi bisa berubah tanpa ada yang mengubah rule. Urutan fisik V1 ≈ urutan pembuatan, jadi hasil sama untuk data yang tidak pernah di-edit (terbukti uji paritas Tahap 4) | Urutan fisik (tidak deterministik); prioritas manual per rule (perlu UI baru → kandidat improvement) |
| **D-26** | Route yang **diporting dari V1** (Tahap 4) mempertahankan validasi manual V1 (pesan & status identik); **zod** wajib untuk route **baru** (`keyword-rules`, auth, users) dan route lama dikonversi saat berikutnya diubah | Paritas D-08 diuji otomatis per request; menulis ulang validasi 23 route sekaligus menambah risiko regresi tanpa menambah fungsi | zod di semua route sekaligus |
| **D-27** | Nomor Surat Jalan dibuat **di dalam transaksi** dengan `pg_advisory_xact_lock(hashtext(prefix_bulan))`; header + item (+ staging) SJ, import WT, alokasi Rekap, dan batch upload DAT masing-masing **satu transaksi** | V1: dua penyimpanan bersamaan di bulan yang sama → nomor kembar → error 500 (uji: 9 dari 12 simpan paralel gagal); SJ bisa tersimpan tanpa item bila insert item gagal. V2: 12/12 berhasil, nomor urut tanpa lompat | `SEQUENCE` per bulan (perlu DDL tiap bulan); retry saat unique violation |
| **D-28** | Pengecualian sementara D-10: `stock/live`, `reports/dat-summary`, dan `reconciliation` masih mengagregasi di **JavaScript** (data diambil lengkap dalam satu query, tanpa batas 1.000). `dashboard/stats` sudah agregasi SQL | Logika V1 (kelompok prodsus/kategori, label, 5 kondisi rekonsiliasi) diporting apa adanya agar paritas bisa dibuktikan; data saat ini ±5.000 baris (di bawah ambang D-10). Pindah ke SQL = kandidat PRD D2 | Tulis ulang ke SQL sekarang (risiko beda hasil tanpa pembanding) |
| **D-29** | Cache nilai saran (keyword values, master jenis/merk) = **in-memory per proses** (TTL 5 menit, disimpan di `globalThis`), diinvalidasi **oleh server** saat rule berubah, reklasifikasi, atau upload DAT. Endpoint `DELETE` cache V1 tetap ada (kontrak) tapi client tidak memanggilnya lagi | Satu proses Node (satu Windows Service) → cache lokal cukup; V1 bergantung pada browser memanggil `DELETE` setelah mengubah rule | Redis / tanpa cache |
| **D-30** | **Dark mode ikut STYLEGUIDE**: bahasa visual sama dengan light (netral hangat, aksen biru, kaca untuk bingkai), versi gelap yang nyaman di mata — arang hangat `#161412`/`#1E1B18`, teks gading `#E4DCD2` (±12:1), aksen diredam (STYLEGUIDE §2.4) | Permintaan Fillian (30 Okt 2026): dark disesuaikan styleguide tapi tidak melelahkan mata. Palet dark V1 (navy + neon) gagal AA di ±290 teks | Mempertahankan palet dark V1 (D-16) |
| **D-31** | Tema diterapkan lewat **variabel CSS**: token per tema di `.light`/`.dark`, dan variabel palet Tailwind v4 (`--color-cyan-*`, `--color-white`, …) dipetakan ke token. Aturan kompatibilitas ditulis di `@layer utilities` (setelah utility Tailwind, tanpa `!important`) agar varian `hover:`/`focus:` tetap menang | V1 memakai ±90 deklarasi `.light .x { … !important }` yang mengalahkan hover/focus dan harus ditulis ulang per tema. Tailwind v4 menulis utility sebagai `var(--color-…)`, jadi satu peta variabel cukup untuk kedua tema | Ganti class di semua halaman sekaligus (±1.500 class — dijadwalkan bertahap di Tahap 8) |
| **D-32** | Produksi memakai **role sendiri**: `smartwms_prod_owner` / `smartwms_prod_app` (dev tetap `smartwms_owner` / `smartwms_app`). Password acak 32 karakter dibuat `setup-server.ps1`, disimpan di `C:\SmartWMS\config` (ACL: Administrator; service hanya bisa membaca `smartwms.env`). `setup-db.sql` menerima nama role & password lewat environment | Dev & prod di PC yang sama: kredensial di `.env.local` dev secara fisik tidak bisa masuk ke database produksi (diuji: `has_database_privilege` = false) | Satu pasang role untuk dev & prod (D-20 awal) |
| **D-33** | Deploy = **clone terpisah** `C:\SmartWMS\src` (yang dirilis = yang sudah di-push) → `npm ci` + build → folder rilis `releases\<tanggal>-<commit>` → stop → migrasi → junction `C:\SmartWMS\app` dipindah → start → cek `GET /api/health` (publik, tanpa data sensitif) → gagal = kembali otomatis ke rilis sebelumnya. Pool database dibuat saat query pertama, jadi `next build` tidak butuh `DATABASE_URL` | Rollback cepat (ganti junction, ±10 detik); folder dev & `npm run dev` tidak terganggu deploy; build tidak memegang rahasia | Build langsung di folder dev (ikut perubahan yang belum di-commit, `npm ci` merusak `node_modules` dev); salin manual |
| **D-34** | Setelan PostgreSQL produksi lewat `ALTER SYSTEM` (`deploy/windows/tune-postgres.sql`): `listen_addresses = localhost`, `shared_buffers 512MB`, `effective_cache_size 3GB`, `work_mem 16MB`, `maintenance_work_mem 256MB`, `max_connections 50`, `random_page_cost 1.1`, log query > 1 detik | RAM 8 GB, NVMe, < 20 pengguna. Installer EDB default `listen_addresses = '*'`. Setelah upgrade 16 GB: `effective_cache_size 8GB` | Setelan default (memori kecil, menerima koneksi dari jaringan) |

## 3. Struktur Folder (target V2)

```
src/
├─ app/                         # halaman & Route Handlers (tetap seperti V1)
│  └─ api/**/route.ts           # tipis: validasi zod → panggil src/server/modules → JSON
├─ components/                  # UI (tetap)
├─ hooks/                       # hook client, fetch ke /api (tetap)
├─ lib/                         # util murni yang aman untuk browser (parser, format, types)
└─ server/                      # ⚠️ server-only — setiap file diawali `import "server-only"` (kecuali db/create.ts & db/migrate.ts, D-20)
   ├─ db/
   │  ├─ create.ts              # pabrik koneksi + parser tipe (dipakai app & skrip CLI)
   │  ├─ index.ts               # instance `db` untuk aplikasi (singleton, server-only)
   │  ├─ types.ts               # hasil kysely-codegen (JANGAN diedit manual)
   │  ├─ migrate.ts             # runner Kysely Migrator (npm run db:migrate)
   │  └─ migrations/            # 0001_baseline.ts, 0002_auth.ts, ...
   ├─ http.ts                  # helper respons Route Handler (serverError, readJson, pgCode)
   ├─ auth/
   │  ├─ password.ts            # hash & verify (bcryptjs)
   │  ├─ session.ts             # create / validate / revoke sesi + cookie
   │  └─ guard.ts               # requireUser(), requireSuperAdmin()
   └─ modules/<domain>/         # query & logika per domain (Tahap 4):
      ├─ assets/                #   cga.ts, cache.ts (D-29), queries.ts (freshness, monitoring, review)
      ├─ classification/        #   rules.ts (D-25), reclassify.ts
      ├─ sj/                    #   master.ts, staging.ts, surat-jalan.ts + no-sj.ts (D-27), report.ts, import-wt.ts
      ├─ upload/                #   dat.ts (upload DAT per batch + finalisasi), lpp.ts (LPP & closing)
      ├─ reports/               #   dashboard.ts, stock-live.ts, dat-summary.ts, reconciliation.ts (D-28)
      └─ users/                 #   manajemen akun (Tahap 3c)
scripts/
├─ import-supabase.ts           # impor dump V1 → DB lokal
└─ compare-counts.ts            # bandingkan jumlah baris sumber vs tujuan
deploy/windows/                 # server Windows (Tahap 6, docs/v2/DEPLOY-LOKAL.md)
├─ setup-server.ps1             #   setup sekali: DB prod, setelan PostgreSQL, service WinSW, firewall
├─ deploy.ps1 / rollback.ps1    #   rilis baru / kembali ke rilis sebelumnya (D-33)
├─ status.ps1                   #   cek service, health, disk, log
├─ common.ps1                   #   fungsi bersama
├─ setup-db.sql                 #   role & database (D-20, D-32)
└─ tune-postgres.sql            #   setelan PostgreSQL (D-34)
.kysely-codegenrc.json          # opsi kysely-codegen (D-21)
.gitattributes                  # LF untuk semua file teks (D-19)
```

## 4. Konvensi Kode

### Database
- Semua akses DB **hanya** lewat `src/server/**`. Komponen `"use client"` tidak boleh mengimpor apa pun dari `src/server`.
- Nama tabel & kolom tetap `snake_case` seperti V1. Tabel baru juga `snake_case`, jamak bila koleksi (`user_sessions`).
- Primary key `uuid` default `gen_random_uuid()`; waktu `timestamptz` default `now()`.
- Operasi multi-tabel (mis. hapus SJ + item + update tag aset) wajib dalam **satu transaksi** (`db.transaction().execute(...)`).
- Insert besar: batch 1.000 baris per statement di dalam transaksi.
- Setelah migrasi skema: jalankan `npm run db:codegen`, commit `types.ts` bersama migrasinya.
- Raw SQL (`sql\`...\``) boleh untuk agregasi kompleks — wajib parameter binding, **tidak pernah** menyambung string input user.

### Route Handler
```ts
// src/app/api/<domain>/route.ts — pola standar V2
import { requireUser } from "@/server/auth/guard";
import { listSomething } from "@/server/modules/<domain>/queries";
import { z } from "zod";

const Query = z.object({ status: z.enum(["draft", "submitted", "completed"]).optional() });

export async function GET(req: Request) {
  const user = await requireUser();            // 401 bila sesi tidak valid
  if (user instanceof Response) return user;
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Parameter tidak valid" }, { status: 400 });
  const data = await listSomething(parsed.data);
  return Response.json({ data });              // bentuk respons = V1 (D-08)
}
```

### Test
- Unit test (`*.test.ts`) memakai **import relatif** — Vitest belum dikonfigurasi alias `@/`.
- Logika yang menyentuh database diuji dengan skrip integrasi terhadap database dev, bukan Vitest.

### Error & pesan
- Pesan error ke user dalam Bahasa Indonesia, memberi langkah berikutnya (STYLEGUIDE §10).
- Error constraint DB diterjemahkan: unique → "Nama ini sudah dipakai", foreign key → "Masih dipakai, nonaktifkan saja".
- Detail teknis hanya ke log server, tidak ke respons.

### Environment (`.env.local` dev / `.env` prod — tidak pernah di-commit)
```
# dev: database smartwms_dev · prod: database smartwms (D-13)
DATABASE_URL=postgres://smartwms_app:<password>@localhost:5432/smartwms_dev          # aplikasi
DATABASE_URL_OWNER=postgres://smartwms_owner:<password>@localhost:5432/smartwms_dev  # migrasi & codegen
SESSION_COOKIE_SECURE=false      # true hanya bila nanti pakai HTTPS
SESSION_TTL_HOURS=12
```
`.env.example` di-commit tanpa nilai rahasia (`.gitignore` V1 mengabaikan `.env*` → perlu pengecualian `!.env.example`).

## 5. Skema Auth (Tahap 3)

| Tabel | Kolom utama |
|---|---|
| `app_users` | `id uuid` (= id Supabase V1), `email` & `username` unik tanpa beda huruf besar/kecil (`lower()`), `nik`, `password_hash` (bcrypt), `role` (`super_admin`/`admin`), `status` (`pending`/`active`/`rejected` — sama dengan V1; "nonaktifkan" = `rejected`), `theme` (`dark`/`light`), `must_change_password`, `failed_login_count`, `locked_until`, `last_login_at`, `created_at`, `updated_at` |
| `user_sessions` | `id` (SHA-256 hex dari token cookie), `user_id` FK → `app_users` ON DELETE CASCADE, `created_at`, `expires_at`, `last_seen_at`, `user_agent`, `ip` |

Migrasi `0002_auth` membuat dua tabel ini dan **menghapus `profiles`**; isinya + hash password dari
`auth.users` diimpor ke `app_users` oleh `npm run db:import-v1` (akun tanpa password → hash `!` +
`must_change_password`).

Aturan (semua angka di `src/server/auth/policy.ts`):
- Cookie hanya berisi token acak 32 byte (base64url, 43 karakter); DB menyimpan **hash**-nya.
- Sesi berlaku `SESSION_TTL_HOURS` (default 12) sejak aktivitas terakhir; diperpanjang saat sisa < separuh (sliding).
- Sesi otomatis tidak berlaku bila akun tidak `active`; ganti/reset password → semua sesi lain dicabut.
- Login: email **atau** username. Status `pending`/`rejected` baru diberitahukan setelah password benar
  (seperti V1). User tidak dikenal tetap menjalankan satu bcrypt (waktu respons sama).
- 5 kali gagal berturut-turut → akun dikunci 10 menit (atomik di database).
- bcrypt cost 12; hash lama cost 10 (Supabase) dinaikkan otomatis saat login berhasil. Password 8 karakter – 72 byte.

Manajemen akun (`src/server/modules/users/service.ts`, Tahap 3c):
- Akun dibuat Super Admin → langsung `active` + `must_change_password`. Register publik → `pending`.
- Super Admin tidak bisa mengubah role/status, me-reset, atau menghapus akunnya sendiri.
- Super Admin aktif terakhir tidak bisa diturunkan/dinonaktifkan/dihapus (D-24).
- Reset password → password sementara 12 karakter acak (tampil sekali), buka kunci, cabut semua sesi.
- `must_change_password` → `requireUser()` menolak 403 `MUST_CHANGE_PASSWORD`, kecuali route dengan
  `requireUser({ allowMustChange: true })` (ganti password, tema); UI diarahkan ke `/ganti-password`.
- Ganti password sendiri → wajib password sekarang; sesi lain dicabut, sesi yang dipakai tetap.

## 6. Keamanan

- PostgreSQL: aplikasi memakai role app (hanya DML); migrasi memakai role owner; superuser `postgres` hanya untuk setup awal & backup (D-20). Produksi punya role sendiri (D-32) dan hanya menerima koneksi `localhost` (D-34).
- Service aplikasi berjalan sebagai **LocalService** (bukan admin/LocalSystem); hanya bisa membaca folder rilis & `smartwms.env`, menulis log & `.next\cache`.
- Windows Firewall: inbound hanya port 3000, profil Domain/Private.
- Rate limit sederhana di `/api/auth/login` (mis. 5 percobaan gagal / 10 menit per username).
- Header keamanan via `next.config.ts` (Tahap 6a): `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy`; header `X-Powered-By` dimatikan.
- Route publik tanpa login hanya: login, register, logout, `/api/me` (mengembalikan 401 bila tanpa sesi) dan `/api/health` (status saja).
- Hapus Surat Jalan (`DELETE /api/sj`) hanya **Super Admin** di API (sejak Tahap 4). V1 hanya menyembunyikan tombolnya di UI; API-nya terbuka untuk siapa pun.
- Dependency `xlsx@0.18.5` (versi npm terakhir SheetJS) punya advisory keamanan. Status Tahap 4: **belum diganti** — hanya dipakai di browser (parse LPP `.xls` dari Oracle internal + export Excel), tidak di server. Ganti ke distribusi resmi SheetJS **ditunda ke Tahap 8** (bukan bagian server; perlu uji ulang parser LPP & semua export per halaman).
