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
| **D-06** | `src/proxy.ts` hanya cek **ada/tidaknya cookie** (optimistic); validasi sesi penuh dilakukan di server dekat data (`requireUser()` di route/page) | Proxy berjalan di setiap request — query DB di sana memperlambat semua aset; pemeriksaan sebenarnya harus di dekat data | Validasi DB di proxy |
| **D-07** | Lupa password via email **dihapus**, diganti reset oleh Super Admin + wajib ganti password saat login berikutnya | Tidak ada SMTP di LAN | SMTP relay (butuh internet & izin IT) |
| **D-08** | **Kontrak API dipertahankan** selama fase paritas: isi Route Handler diganti, bentuk request/response tetap | Halaman & hook V1 (±14 ribu baris TSX) tidak perlu ditulis ulang; regresi mudah dilacak per route | Rewrite ke Server Actions sekaligus |
| **D-09** | Validasi input API dengan **zod** di semua route yang dimigrasi/baru | Batas sistem yang jelas; pesan error konsisten | Validasi manual per route |
| **D-10** | **Agregasi di database** (SQL `GROUP BY`/view), bukan loop di JavaScript. Filter & pagination client-side tetap boleh untuk data < ±10.000 baris | LAN cepat → mengirim beberapa ribu baris masih ringan; agregasi di DB jauh lebih efisien | Semua server-side (berlebihan untuk skala sekarang) |
| **D-11** | Aturan V1 "wajib pagination loop `.range()`" **tidak berlaku di V2** (tidak ada limit PostgREST). Diganti: query tabel besar wajib punya `WHERE` / `LIMIT` yang disengaja | Akar masalah (truncate 1.000 baris) hilang | — |
| **D-12** | Next.js `output: 'standalone'` dijalankan sebagai **Windows Service via WinSW** (NSSM sebagai alternatif) | Auto-start setelah reboot tanpa login Windows; log ke file | PM2 (startup di Windows butuh tool tambahan) |
| **D-13** | **Dev & prod sama-sama native Windows** + PostgreSQL 18. Database terpisah: `smartwms_dev` (dev) dan `smartwms` (prod); `next dev` di port **3001**, service produksi di **3000** | Lingkungan dev = produksi (tidak ada beda Linux vs Windows); DB & port terpisah aman walau dev dan server di PC yang sama | Codespace + Docker Compose (rencana awal, ditinggalkan 30 Okt 2026 karena Fillian develop di PC lokal) |
| **D-14** | **Repo baru `github.com/iyunn/smart-wmsV2`**, diawali clone repo V1 (setelah hotfix Tahap 0a) **beserta histori git**. Repo V1 tetap deploy ke Vercel sampai cutover; tag **`v1.0-cloud-ta`** di repo V1 (commit sebelum hotfix) | V1 tidak terganggu; histori & journal tetap nyambung; versi TA bisa direproduksi | Branch `v2` di repo lama (rencana awal, diganti karena Fillian membuat repo baru); repo baru tanpa histori (kehilangan `git blame` & konteks commit) |
| **D-15** | Font di-host sendiri: **Plus Jakarta Sans Variable** (UI) + **JetBrains Mono Variable** (kode aset/serial) via `@fontsource-variable/*` | `next/font/google` butuh internet saat build | Google Fonts |
| **D-16** | Light theme mengikuti `STYLEGUIDE.md` (diadaptasi dari STYLEGUIDE AYAMSMART); **dark mode dipertahankan** | Permintaan Fillian; dark sudah dipakai | Light-only |
| **D-17** | Parsing file upload (TXT DAT, LPP .xls-HTML, PDF WT) **tetap di browser**; hasil dikirim ke API per batch | Parser V1 sudah teruji; server tidak terbebani parsing | Parsing di server |
| **D-18** | Uji otomatis dengan **Vitest** untuk logika murni (parser, classifier, kalkulasi) + skrip **pembanding jumlah baris** untuk migrasi data | Paling banyak bug V1 ada di logika batch & parsing | Tanpa test / E2E penuh (terlalu mahal sekarang) |
| **D-19** | Line ending **LF** di repo lewat `.gitattributes` (`* text=auto eol=lf`) | Develop di Windows; mencegah diff palsu CRLF/LF dan script yang rusak | Mengandalkan setelan `core.autocrlf` tiap mesin |
| **D-20** | **Dua role database:** `smartwms_owner` (pemilik DB & tabel, dipakai migrasi lewat `DATABASE_URL_OWNER`) dan `smartwms_app` (hanya SELECT/INSERT/UPDATE/DELETE, dipakai aplikasi lewat `DATABASE_URL`). Dibuat dengan `deploy/windows/setup-db.sql`. Pabrik koneksi `src/server/db/create.ts` sengaja tanpa `server-only` agar bisa dipakai skrip CLI | Bila aplikasi kebobolan (mis. SQL injection), penyerang tidak bisa DROP/ALTER tabel; superuser `postgres` tidak pernah dipakai aplikasi. Paket `server-only` melempar error bila diimpor di luar Next.js | Satu user untuk semua (lebih simpel, tapi aplikasi punya hak DDL) |
| **D-21** | Parser tipe `pg` disamakan dengan bentuk data V1: `int8` & `numeric` → `number`, `date` → string `YYYY-MM-DD`, `timestamp` (tanpa zona) → string `YYYY-MM-DDTHH:MM:SS` seperti PostgREST; `timestamptz` tetap `Date`. Opsi `kysely-codegen` di `.kysely-codegenrc.json` mengikuti | Kontrak API V1 tetap (D-08); default `pg` menganggap `date`/`timestamp` sebagai jam lokal proses Node (WIB) sehingga bergeser saat jadi JSON | Default `pg` (string untuk int8/numeric, Date untuk date/timestamp) |
| **D-22** | Database dikunci ke zona waktu **UTC** (`ALTER DATABASE ... SET timezone`, di migrasi 0001) | Sama dengan Supabase. Tiga kolom V1 bertipe `timestamp` tanpa zona (`assets_raw.uploaded_at`, `assets_clean.created_at`, `classification_logs.processed_at`) berisi jam UTC; installer PostgreSQL Windows memakai zona OS (WIB) sehingga `now()` akan menyimpan jam lokal | Mengubah tiga kolom itu ke `timestamptz` (lebih benar, tapi mengubah bentuk data API → kandidat improvement setelah paritas) |
| **D-23** | Impor data V1 (`scripts/import-v1.ts`) memakai **`COPY` format teks PostgreSQL** via `pg-copy-streams`: sumber dalam transaksi READ ONLY + REPEATABLE READ, tujuan dalam satu transaksi (TRUNCATE → COPY → verifikasi jumlah baris + checksum md5 per tabel → COMMIT). Wajib `--confirm <nama_db>` | Nilai pindah persis tanpa konversi tipe di JavaScript (array `jsonb`, `numeric` presisi tinggi, `timestamp`); satu snapshot konsisten; gagal = database lokal utuh; aman diulang saat cutover | `SELECT` lalu `INSERT` lewat JS (rawan salah konversi jsonb/numeric/timezone); `pg_dump` + `pg_restore` data (tidak ada verifikasi & tidak bisa menolak beda skema) |

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
   ├─ auth/
   │  ├─ password.ts            # hash & verify (bcryptjs)
   │  ├─ session.ts             # create / validate / revoke sesi + cookie
   │  └─ guard.ts               # requireUser(), requireSuperAdmin()
   └─ modules/<domain>/         # query & logika per domain: sj, assets, lpp, staging, dashboard, ...
scripts/
├─ import-supabase.ts           # impor dump V1 → DB lokal
└─ compare-counts.ts            # bandingkan jumlah baris sumber vs tujuan
deploy/windows/                 # file WinSW, skrip backup, firewall (Tahap 6)
deploy/windows/setup-db.sql     # buat role & database (D-20)
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

## 6. Keamanan

- PostgreSQL: aplikasi memakai `smartwms_app` (hanya DML); migrasi memakai `smartwms_owner`; superuser `postgres` hanya untuk setup awal & backup (D-20).
- Windows Firewall: inbound hanya port 3000, profil Domain/Private.
- Rate limit sederhana di `/api/auth/login` (mis. 5 percobaan gagal / 10 menit per username).
- Header keamanan dasar via `next.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`).
- Dependency `xlsx@0.18.5` (versi npm terakhir SheetJS) punya advisory keamanan → evaluasi ganti ke distribusi resmi SheetJS saat Tahap 4b.
