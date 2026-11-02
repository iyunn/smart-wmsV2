# SmartWMS V2 — Chat Rules
> Berlaku untuk semua sesi pengembangan SmartWMS antara Fillian & Claude.
> Terakhir diupdate: 30 Oktober 2026 (repo baru `smart-wmsV2`, development di PC lokal)
>
> **Untuk AI baru / sesi baru**: baca file ini dulu, lalu `docs/v2/ROADMAP.md` (tahap aktif).
> Itu cukup untuk orient penuh tanpa perlu tanya-tanya ke user.

---

## 0. Dua Repo

| | V1 (produksi sekarang) | V2 (sedang dibangun) |
|---|---|---|
| Repo | `github.com/iyunn/smart-warehouse-management-system` | **`github.com/iyunn/smart-wmsV2`** |
| Stack | Next.js + Supabase + Vercel | Next.js + PostgreSQL 18 lokal + Kysely, PC server di LAN kantor |
| Status | Pemeliharaan: hotfix & bug saja | Semua pengembangan baru |
| Dokumen utama | `docs/project_context.md` (repo V1) | `docs/v2/PRD.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STYLEGUIDE.md` |

Repo V2 diawali dari clone repo V1 beserta histori git (ARCHITECTURE D-14).
Tag **`v1.0-cloud-ta`** di repo V1 = versi Tugas Akhir; jangan dihapus.

---

## 1. Session Startup Protocol

Di awal setiap sesi, baca dokumen via curl sebelum mengerjakan apa pun:

```bash
R=https://raw.githubusercontent.com/iyunn/smart-wmsV2/main
curl $R/docs/chat-rule.md
curl $R/docs/v2/ROADMAP.md          # selalu: tahap aktif & statusnya
curl $R/docs/v2/ARCHITECTURE.md     # bila menyentuh kode / keputusan teknis
curl $R/docs/v2/PRD.md              # bila menyentuh scope
curl $R/docs/v2/STYLEGUIDE.md       # bila menyentuh UI
curl $R/docs/project_context.md     # detail fitur V1 (sampai cutover isinya masih V1)
```

Kerja hotfix V1 → baca dari repo V1 (`.../smart-warehouse-management-system/main/...`).

---

## 2. Output & Git Workflow

- Claude **hanya generate file** untuk di-download dan di-apply manual oleh Fillian di PC lokal (VS Code).
- **Fillian yang menjalankan semua git command** (`add`, `commit`, `push`, `tag`) — Claude cukup berikan perintah & commit message.
- Perintah terminal ditulis untuk **bash MSYS2 (UCRT64)** — terminal yang dipakai Fillian. Path gaya
  `/d/BABAYAGA/...` (bukan `D:\...`); perintah PowerShell dipanggil lewat `powershell.exe -NoProfile -Command '...'`.
- Pengecualian: script server `deploy\windows\*.ps1` dijalankan di **PowerShell Administrator**
  (`docs/v2/DEPLOY-LOKAL.md` §2) karena memasang service, firewall, dan hak akses folder.
  Bila dijalankan dari **bash MSYS2** (dibuka "Run as administrator"), path ditulis dengan **`/`** —
  bash membuang `\` (`deploy\windows\backup.ps1` → `deploywindowsbackup.ps1`, 30 Okt):
  `powershell.exe -NoProfile -ExecutionPolicy Bypass -File deploy/windows/status.ps1`.
  Claude selalu menyebut untuk terminal mana perintah itu ditulis.
- Format commit message: **1 baris judul + bullets ringkas**. Prefix: `feat`, `fix`, `refactor`, `docs`, `chore`, `security`; sertakan tahap, mis. `feat(v2-3): auth sendiri`.
  Claude memberikannya sebagai perintah siap tempel `git commit -F - <<'MSG' … MSG` (bukan `-m "..."`
  dengan placeholder — commit `fc70454` sempat ber-judul "..." karena itu).
- Selalu sebut **repo tujuan** (V1 atau V2) untuk setiap paket file.
- Banyak file sekaligus → dikirim sebagai **zip berstruktur path repo**.
- **Apply otomatis (WAJIB setiap kali mengirim zip):** Claude menyertakan blok perintah siap jalan —
  Fillian cukup download zip lalu menjalankannya, **tanpa extract/copas manual**. Bentuk baku (bash MSYS2):
  ```bash
  cd /d/BABAYAGA/HMM/project/smart-wmsV2
  powershell.exe -NoProfile -Command 'Expand-Archive -Force "$env:USERPROFILE\Downloads\<nama>.zip" -DestinationPath .'
  git status --short
  ```
  Nama zip di perintah = nama file yang benar-benar dikirim; sebutkan hasil `git status` yang diharapkan
  (jumlah file `M` / `??`). Urutan di balasan: tabel file → apply otomatis → commit message → langkah
  deploy/tes (bila ada). Bila Fillian memakai PowerShell, berikan versi PowerShell dengan isi yang sama.
- Output file selalu disajikan dalam tabel:

  | File Generated | Lokasi di Repo | Status |
  |---|---|---|
  | `NamaFile.tsx` | `src/path/ke/file.tsx` | new / replace / delete |

---

## 3. Pola Kerja: Tahap → Present → Test → Lanjut

Pekerjaan besar **dipecah per tahap kecil yang berdiri sendiri** (`docs/v2/ROADMAP.md`),
supaya kalau sesi terputus di tengah, tidak ada kerja yang hilang. Polanya:

1. Claude mengerjakan **satu tahap**, generate & present file
2. Claude **STOP** — tidak lanjut ke tahap berikutnya
3. Fillian apply, test di PC lokal, push
4. Fillian laporan hasilnya ("udah jalan bro" / "ada bug X")
5. Claude update status di ROADMAP + entry journal, lalu baru lanjut

Kalau Fillian bilang **"sudah aku apply dan commit"** sebelum lanjut edit file yang sama,
Claude **wajib re-fetch** file tersebut dari raw GitHub.

---

## 4. Lingkungan Kerja & Membaca Repo

- Fillian develop di **PC lokal Windows**, folder `D:\BABAYAGA\HMM\project\smart-wmsV2`. **Tidak memakai Codespace lagi.**
- Claude **tidak bisa melihat file lokal** — hanya yang sudah di-push ke GitHub.
  Kalau Claude perlu file yang belum di-push, minta Fillian push dulu atau upload filenya.
- Error lokal (build, runtime, PostgreSQL) → minta Fillian paste output terminal lengkapnya.
- Dev server: `npm run dev` di port **3001**; database dev `smartwms_dev` (ARCHITECTURE D-13).

### Prioritas metode baca repo (dari paling hemat):

| # | Metode | Kapan dipakai |
|---|---|---|
| 1 | `curl https://raw.githubusercontent.com/iyunn/smart-wmsV2/main/{path}` | Baca 1 file **(default)** |
| 2 | `curl https://api.github.com/repos/iyunn/smart-wmsV2/contents/{path}` | List isi 1 folder |
| 3 | `git clone --depth 1 https://github.com/iyunn/smart-wmsV2.git` | **Last resort** — butuh banyak file sekaligus (mis. migrasi massal, type-check) |

### Aturan wajib:
- **Hanya baca file yang relevan** dengan tahap saat ini.
- **Re-fetch sebelum edit** jika Fillian sudah commit perubahan sejak file terakhir dibaca.
- Claude tetap **read-only** terhadap repo — semua write/push dilakukan Fillian.

---

## 5. Gaya Penjelasan (Wajib Dipertahankan)

Claude **selalu menjelaskan apa yang sedang dikerjakan** — jangan langsung kasih kode tanpa konteks:

- **Root cause analysis** saat debug — jelaskan KENAPA bug terjadi, bukan langsung fix
- **Alasan keputusan teknis** — kenapa pilih pendekatan ini vs alternatif; keputusan arsitektur baru dicatat sebagai `D-xx` di `docs/v2/ARCHITECTURE.md`
- **Trade-off** kalau ada beberapa opsi desain
- **Verifikasi logic** via `node -e` / Vitest sebelum present
- **Syntax/type check** sebelum file di-present (§11)

---

## 6. Arsitektur & Teknologi (detail & alasan: `docs/v2/ARCHITECTURE.md`)

- **Database:** PostgreSQL 18 lokal (`localhost` saja); dev `smartwms_dev`, prod `smartwms`
- **Akses data:** Kysely + `pg`, **hanya** dari `src/server/**` — browser tidak pernah ke DB
- **Auth:** sendiri (`app_users`, `user_sessions`, bcryptjs, cookie httpOnly)
- **Validasi:** zod di setiap Route Handler
- **Deploy:** Next.js standalone sebagai Windows Service (WinSW) di PC kantor, akses via LAN port 3000
- **Line ending:** LF (`.gitattributes`)

### Prinsip
- **Lightweight & performant**
- **Scalable** — struktur fleksibel untuk fitur masa depan
- **Scope data CGA-only** (CGA1/CGA2/CGA3)
- **JSONB** untuk data yang selalu dipakai utuh (tidak di-query per field)
- Agregasi di database (SQL), bukan loop JavaScript; filter/pagination client-side boleh untuk data < ±10.000 baris (D-10)

---

## 7. Model AI

Sebelum task kompleks (multi-file, desain skema, auth, migrasi data), Claude
**merekomendasikan Opus atau Sonnet** dan menunggu konfirmasi Fillian.
Patokan: Tahap 2, 3, 4b, 4c, 6 → Opus. Tahap 1b, 4a, 5, 8 → Sonnet cukup.
Kalau Fillian sudah bilang "gas" untuk tahap tertentu, itu dianggap konfirmasi.

---

## 8. Dokumentasi

| File | Sifat | Kapan diupdate |
|---|---|---|
| `docs/v2/ROADMAP.md` | Status tahap | Setiap tahap mulai/selesai |
| `docs/development-journal.md` | **Append-only** history kronologis (lanjutan dari V1) | Setiap tahap/sesi — entry baru di akhir, entry lama tidak diedit |
| `docs/v2/ARCHITECTURE.md` | Decision log + konvensi | Setiap keputusan teknis baru (`D-xx`); keputusan lama tidak dihapus, ditandai "DIGANTI" |
| `docs/v2/PRD.md` | Scope & requirement | Saat scope berubah (mis. improvement dipilih) |
| `docs/v2/STYLEGUIDE.md` | Aturan tampilan | Saat token/komponen/aturan UI berubah |
| `docs/project_context.md` | Snapshot state sistem | Sampai cutover = state V1 (referensi fitur). Saat cutover ditulis ulang menjadi state V2; setelah itu setiap update cek SEMUA section (Features, Database, File Structure, Known Issues, Libraries) |

Semua dokumen harus akurat & tidak saling kontradiktif kalau dibaca tanpa context chat.
Claude memberi ringkasan perubahan dokumen setiap kali update.

---

## 9. Aturan Kode

- Semua akses DB lewat `src/server/**`; komponen `"use client"` tidak boleh mengimpor `src/server/**`.
- Tidak ada limit 1000 baris (bukan PostgREST); query tabel besar wajib punya `WHERE`/`LIMIT` yang disengaja.
- Operasi multi-tabel dalam **satu transaksi**.
- Raw SQL hanya dengan parameter binding — tidak pernah menyambung string input user.
- Setelah migrasi skema: `npm run db:codegen` dan commit `types.ts` bersama migrasinya.
- Kontrak API (`/api/*`) tidak berubah selama fase paritas (D-08).
- Secret hanya di `.env.local` / `.env` — **tidak pernah** di kode (repo publik).
- Setiap Route Handler data memanggil `requireUser()` / `requireSuperAdmin()` di baris pertama; logika
  & query di `src/server/modules/<domain>/`, route hanya validasi → panggil modul → JSON.
- Aplikasi V2 tidak memakai Supabase lagi (sejak Tahap 4); `SUPABASE_DB_URL` hanya untuk `db:import-v1`.
- Hindari pattern deprecated; prioritaskan readability, maintainability, performance, security.

---

## 10. Komunikasi

- **Bahasa**: Indonesia casual ("bro")
- **Gaya**: langsung to the point, tapi tetap jelaskan reasoning
- Ambiguitas scope sebelum task besar → tanya dulu
- Multiple pilihan desain → jelaskan trade-off, beri rekomendasi, tunggu konfirmasi
- **Jangan tanya lebih dari 1 pertanyaan sekaligus** — tanya yang paling krusial dulu

---

## 11. Checklist Sebelum Present File ke Fillian

- [ ] Type check `npx tsc --noEmit` (atau `npx esbuild` bila dependency belum ada) — tidak ada error baru
- [ ] Logic kritis diverifikasi via `node -e` atau Vitest
- [ ] File yang diedit sudah di-fetch ulang jika Fillian sudah commit
- [ ] Tabel output + **repo tujuan** sudah ada
- [ ] Blok **apply otomatis** (§2: `cd` + `Expand-Archive` nama zip yang benar + `git status --short`) + commit message sudah disiapkan
- [ ] Tidak ada dead code / import yang tidak terpakai
- [ ] Tidak ada secret / key di file
- [ ] ROADMAP & journal sudah diupdate untuk tahap ini
