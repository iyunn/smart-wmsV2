# PRD — SmartWMS V2

> Product Requirements Document untuk SmartWMS V2 (versi lokal/on-premise).
> Dibuat: 30 Oktober 2026 · Pemilik: Fillian · Status: **Draft v1.0, scope improvement belum dikunci**
>
> Dokumen terkait: [`ARCHITECTURE.md`](./ARCHITECTURE.md) (keputusan teknis),
> [`ROADMAP.md`](./ROADMAP.md) (tahapan kerja & progres), [`STYLEGUIDE.md`](./STYLEGUIDE.md) (tampilan),
> [`../chat-rule.md`](../chat-rule.md) (pola kerja), [`../project_context.md`](../project_context.md) (state V1).

---

## 1. Latar Belakang

SmartWMS V1 (*Smart Asset Monitoring and Reconciliation System*) dibangun sebagai Tugas Akhir
dengan arsitektur cloud: Next.js di Vercel + Supabase (PostgreSQL, Auth). V1 sudah dipakai
resmi di operasional divisi General Affairs PT Indomarco Prismatama (Surat Jalan Manual,
monitoring & rekonsiliasi aset CGA1/CGA2/CGA3).

Keterbatasan V1 yang mendorong V2:

| Masalah | Bukti |
|---|---|
| Ketergantungan internet & server luar negeri | Semua request lewat internet kantor yang lambat |
| Supabase free plan: project di-pause setelah 7 hari tidak aktif, kuota 500 MB | Kebijakan free plan Supabase |
| Limit 1.000 baris per query PostgREST memaksa pagination loop di banyak route | `chat-rule.md` §11, bug data loss 18 Juni 2026 |
| Agregasi berat dihitung di JavaScript, bukan di database | Item "DB Optimization (Deferred)" di `project_context.md` |
| **Keamanan:** anon key tertulis di kode (`src/lib/supabaseClient.ts`) pada repo publik + RLS allow-all → data bisa dibaca/diubah siapa pun | Terverifikasi dari kode 30 Okt 2026. Hotfix V1 (Tahap 0) dilewati; celah hilang saat Supabase diputus di cutover |
| Light mode belum konsisten: kontras teks samar 2,3:1 (gagal WCAG AA), baru 3 dari 10 halaman memakai token | Audit `globals.css` 30 Okt 2026 |

## 2. Tujuan

| # | Tujuan | Ukuran keberhasilan |
|---|---|---|
| G1 | Sistem berjalan **sepenuhnya di PC kantor** (server lokal), diakses lewat LAN | Tidak ada dependensi layanan cloud saat runtime |
| G2 | **Paritas fitur** penuh dengan V1 sebelum cutover | Semua item di §5.B lolos checklist UAT |
| G3 | Fondasi **scalable** untuk pengembangan jangka panjang | Akses data type-safe, migrasi skema terversi, agregasi di database |
| G4 | **Data aman & tidak hilang** | DB tidak terekspos ke jaringan; backup harian otomatis + uji restore |
| G5 | **Light theme** baru sesuai `STYLEGUIDE.md` | Semua teks < 18px kontras ≥ 4,5:1; dark mode tetap berfungsi |
| G6 | Ruang untuk **improvement V2** | Backlog §5.D dikonfirmasi & dikerjakan setelah cutover |

## 3. Non-Goals (V2 tidak mengerjakan)

- Akses dari luar LAN kantor (internet/VPN). Kalau nanti dibutuhkan → keputusan arsitektur baru.
- Multi-server, high availability, atau replikasi database.
- Menggantikan Oracle DAT atau Web Tracking (sama seperti V1: sistem pendukung).
- Mengubah isi Laporan TA / artikel jurnal — keduanya tetap merujuk V1 (tag `v1.0-cloud-ta` di repo
  `smart-warehouse-management-system`).
- Aplikasi mobile native.

## 4. Pengguna & Lingkungan

**Pengguna:** sama dengan V1 — Super Admin dan Admin (Admin Gudang, Admin Web Tracking,
Supervisor Asset, tim GA). Penonton layar Live Stock (view-only).

**Lingkungan operasional (asumsi, konfirmasi di §10):**

| Komponen | Nilai |
|---|---|
| Server | 1 PC kantor milik Fillian, Windows, menyala selama jam kerja |
| Jaringan | LAN kantor; klien membuka `http://<IP-server>:3000` |
| Jumlah pengguna bersamaan | Kecil (di bawah 20) |
| Internet di server | Ada, hanya untuk deploy (`git pull`, `npm ci`), bukan untuk runtime |
| Development | PC lokal Windows, repo `github.com/iyunn/smart-wmsV2` (tanpa Codespace) |

## 5. Scope

### A. Migrasi Platform (wajib, sebelum cutover)

| ID | Requirement |
|---|---|
| A1 | Database **PostgreSQL 18** native Windows, hanya listen di `localhost` |
| A2 | Akses data lewat **Kysely + node-postgres**, hanya dari server (Route Handler / Server Action / Server Component). Browser tidak pernah terhubung langsung ke DB |
| A3 | Skema dikelola sebagai **migrasi terversi** di repo (bukan SQL lepas di `Miscellaneous/`) |
| A4 | **Auth sendiri** menggantikan Supabase Auth: login email/username + password, registrasi berstatus `pending` + approval Super Admin, role `super_admin`/`admin`, sesi berbasis cookie httpOnly yang bisa dicabut |
| A5 | Akun V1 **dimigrasikan dengan id yang sama**; target: user tidak perlu ganti password (hash bcrypt diimpor — diverifikasi Tahap 2) |
| A6 | "Lupa password via email" diganti **reset password oleh Super Admin** (tidak ada SMTP di LAN) |
| A7 | Semua data V1 dimigrasikan; jumlah baris per tabel identik sebelum & sesudah |
| A8 | Next.js build `standalone`, berjalan sebagai **Windows Service** (auto-start setelah reboot) |
| A9 | **Backup harian** otomatis (`pg_dump`), retensi 14 hari + salinan mingguan di luar disk server; prosedur restore terdokumentasi & diuji — diterapkan Tahap 6b (ARCHITECTURE D-35, `MANUAL-ADMIN-SERVER.md`) |
| A10 | Font di-host sendiri (`@fontsource`) — build & runtime tidak butuh Google Fonts |
| A11 | Kontrak API (`/api/*` request/response) dipertahankan selama fase paritas, agar halaman & hook tidak ikut ditulis ulang |

### B. Paritas Fitur V1 (semua harus jalan di V2)

| Modul | Halaman / Route | Catatan |
|---|---|---|
| Auth & user | `/login`, `/register`, `/admin/users` | `/forgot-password`, `/auth/*` dihapus (A6) |
| Dashboard | `/` | 6 baris: status data, DAT vs LPP, CGA summary, trend CGA, rekap pengiriman, warning |
| Upload | `/upload` | DAT (TXT), LPP (.xls HTML), DAT Closing, import SJ Web Tracking (PDF) |
| Review & klasifikasi | `/review` | Klasifikasi, keyword rules, reclassify |
| Monitoring v2 | `/monitoring` | Catatan aset, export Excel |
| Rekonsiliasi | `/reconciliation` | DAT vs LPP, export Excel |
| Staging | tab di Upload/Monitoring | DAT masuk dari luar CGA |
| Surat Jalan | `/sj/buat`, `/sj/list`, `/sj/masuk`, `/sj/pendingan`, `/sj/report`, `/sj/templates`, `/sj/tujuan` | PDF SJ & Penerimaan, arsip, mutasi Oracle/WT, rekap alokasi |
| Laporan | export PDF Rekap DAT | `@react-pdf/renderer` |
| Live Stock | `/stock/live` | Mode TV/fullscreen, auto-cycle |
| Tema | toggle dark/light, preferensi per akun | Light diganti sesuai STYLEGUIDE |

### C. Light Theme Baru

| ID | Requirement |
|---|---|
| C1 | Token warna light diganti sesuai `STYLEGUIDE.md`; nama class token yang sudah dipakai (`bg-surface`, `text-muted`, dst.) **tidak berubah** |
| C2 | Semua teks < 18px kontras ≥ 4,5:1 terhadap latarnya |
| C3 | Efek kaca hanya untuk chrome (Topbar, Sidebar, modal, toast); tabel & kartu data memakai permukaan solid |
| C4 | Dark mode tetap tersedia, **disesuaikan STYLEGUIDE** dalam versi gelap yang nyaman di mata (ARCHITECTURE D-30); kontras AA berlaku juga di dark |
| C5 | PDF (Surat Jalan, Penerimaan, Rekap DAT) tidak terpengaruh tema |

### D. Improvement V2 — kandidat (BELUM DIKONFIRMASI)

Diambil dari backlog & known issues V1. **Tidak dikerjakan sebelum Fillian memilih.**
Item baru dari Fillian ditambahkan di sini.

| ID | Kandidat | Sumber |
|---|---|---|
| D1 | Live Stock publik (tanpa login) untuk layar kantor | `project_context.md` → Features Planned |
| D2 | Agregasi dashboard/monitoring di database (view / materialized view) | DB Optimization (Deferred) |
| D3 | Integrasi Mutasi WT otomatis dari LPP | Features Planned → Next |
| D4 | Tombol "Pakai Template" di sebelah "Tambah Baris" | Features Planned → Next |
| D5 | Kondisi 3 "Aset Intransit" pada rekonsiliasi | Saran penelitian lanjutan TA |
| D6 | Dashboard placeholder & Recent Activity diaktifkan | Known Issues |
| D7 | Opsi jenis/kategori/satuan dari master DB, bukan hardcoded | Accepted Technical Debt |
| D8 | Audit log aktivitas user (siapa mengubah apa) | Usulan baru, perlu konfirmasi |
| D9 | Halaman status server (umur backup terakhir, ruang disk) | Usulan baru, perlu konfirmasi — sebagian sudah ada di `status.ps1` (Tahap 6) |
| **D10** | **Warna tampilan custom per user** — semua warna dasar tema terang & gelap bebas diubah (tanpa batasan), disimpan di akun, ikut antar-perangkat | ✅ **Dipilih Fillian (30 Okt 2026)**, dikerjakan sebelum cutover (terisolasi di lapisan tampilan) — ROADMAP Tahap 9a |

## 6. Kebutuhan Non-Fungsional

Angka di bawah adalah **target** yang diukur saat UAT, bukan hasil yang sudah terbukti.

| Aspek | Target |
|---|---|
| Kinerja | Halaman utama tampil < 1 detik di LAN; upload DAT ±5.000 baris selesai < 15 detik |
| Ketersediaan | Semua service otomatis jalan setelah PC restart, tanpa login Windows |
| Pemulihan | Kehilangan data maksimal 24 jam (backup harian); restore < 1 jam dengan runbook |
| Keamanan | DB & port internal hanya `localhost`; password di-hash; sesi bisa dicabut; input API divalidasi; secret hanya di `.env` (tidak di repo) |
| Aksesibilitas | Kontras AA, fokus keyboard terlihat, status tidak hanya dibedakan warna |
| Maintainability | TypeScript strict, tipe DB di-generate dari skema, migrasi terversi, dokumentasi sesuai `chat-rule.md` |

## 7. Kriteria Cutover (Definition of Done V2.0)

- [ ] Semua modul §5.B lolos checklist UAT di server lokal
- [x] Setiap Route Handler `/api/*` (kecuali login/register/logout/me, dan `/api/health` yang hanya berisi status) memanggil `requireUser()`/`requireSuperAdmin()` — dicek dengan pencarian kode (Tahap 4: 29 route, uji HTTP tanpa sesi → 401)
- [ ] Jumlah baris semua tabel identik dengan Supabase pada saat freeze
- [ ] Semua akun bisa login (atau sudah di-reset Super Admin)
- [ ] Restore dari backup berhasil diuji minimal 1 kali
- [ ] Service bertahan setelah PC di-restart
- [ ] Tag `v1.0-cloud-ta` ada di repo V1
- [ ] Project Supabase di-pause / akses anon dicabut di hari cutover; dump terakhir disimpan sebagai cadangan

## 8. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| PC server mati (cuti, mati listrik, Windows Update) | Sistem GA tidak bisa dipakai | Windows Service auto-start, active hours Windows Update, UPS bila ada, PC tidak sleep |
| Disk rusak | Data hilang | Backup harian + salinan mingguan di luar disk server; uji restore |
| Kebijakan IT kantor melarang server di PC kerja | V2 tidak bisa jalan | Konfirmasi ke IT sebelum Tahap 6 |
| Regresi saat migrasi query | Data salah tampil | Kontrak API tetap; uji per domain; skrip pembanding jumlah baris; uji paritas otomatis V1↔V2 per request & isi tabel (Tahap 4) |
| Hash password Supabase tidak kompatibel | User harus reset | Fallback: Super Admin reset semua password saat cutover |
| Scope creep improvement | Cutover molor | Improvement §5.D baru dikerjakan setelah cutover |
| Data V1 di Supabase terbuka sampai cutover (hotfix Tahap 0 dilewati) | Data aset/SJ bisa dibaca/diubah pihak luar | Kejar cutover; putus akses Supabase di hari cutover |

## 9. Milestone

Rincian tahap & status ada di [`ROADMAP.md`](./ROADMAP.md).

| Milestone | Isi |
|---|---|
| M0 | Hotfix keamanan V1 |
| M1 | Fondasi V2 (dev stack, skema, data, auth) |
| M2 | Paritas data layer (semua route pakai Kysely) + tema fondasi |
| M3 | Server lokal siap, UAT, cutover |
| M4 | Tema per halaman + improvement §5.D |

## 10. Asumsi & Pertanyaan Terbuka

| # | Hal | Status |
|---|---|---|
| Q1 | Tidak ada akses dari luar LAN | Asumsi — konfirmasi |
| Q2 | IT kantor mengizinkan PC menjalankan server & membuka port 3000 di LAN | ✅ Aman — Fillian sendiri pemegang wewenangnya (30 Okt 2026) |
| Q3 | Daftar improvement V2 yang dipilih (§5.D) | Menunggu Fillian |
| Q4 | Spesifikasi PC server (RAM, disk, versi Windows) | Windows 11, Intel Core i3 gen 12, NVMe 512 GB, RAM 8 GB (rencana upgrade dalam waktu dekat) |
| Q5 | Login pakai email, username, atau keduanya | Default: keduanya |
| Q6 | PC development sama dengan PC server? | Belum diketahui — rencana aman untuk dua kemungkinan (ARCHITECTURE D-13) |
