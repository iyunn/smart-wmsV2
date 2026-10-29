# Smart Warehouse Management System
# Development Journal

---

# Minggu, 10 Mei 2026

## Aktivitas Hari Ini

Melanjutkan pengembangan **Smart Warehouse Management System** dengan fokus utama pada:

- Modern dashboard UI
- Implementasi Excel upload pipeline
- Parsing DAT Oracle
- Batch processing
- Integrasi Supabase
- Debugging ETL parser

Hari ini menjadi milestone penting karena sistem berhasil melakukan upload dan parsing file DAT Oracle asli hingga data berhasil masuk ke database Supabase.

> **Catatan retrospektif (7 Juni 2026):** Pipeline Excel sudah di-deprecate pada sesi 6 Juni 2026. Lihat entry tersebut.

---

## Tujuan Pengembangan Hari Ini

Membangun sistem upload DAT otomatis yang mampu:

- Membaca file Excel hasil export Oracle
- Melakukan parsing data aset
- Memproses data dalam batch
- Melakukan klasifikasi otomatis
- Menyimpan data ke database Supabase

### Tujuan Utama

Menggantikan proses manual menggunakan:

- Microsoft Excel
- Sorting manual
- VLOOKUP
- Klasifikasi manual

---

## Teknologi yang Digunakan

### Frontend
- Next.js 16
- TypeScript
- Tailwind CSS

### Backend / API
- Next.js Route Handler API

### Database
- Supabase PostgreSQL

### Library
- XLSX (deprecated per 6 Juni 2026)

### Tools
- GitHub
- Vercel
- VS Code

---

## Arsitektur yang Digunakan

### ETL Pipeline Architecture

```text
Excel Upload
    ↓
Excel Parsing
    ↓
Header Validation
    ↓
Data Normalization
    ↓
Batch Processing
    ↓
API Route
    ↓
Supabase Insert
    ↓
Classification Engine
    ↓
Dashboard Analytics
```

> **Catatan retrospektif (7 Juni 2026):** Pipeline diatas adalah versi awal. Sudah diganti dengan TXT bulk-upsert pipeline.

---

## Implementasi Sistem

### Batch Processing

Digunakan untuk:

- Menghindari browser freeze
- Menjaga stabilitas upload data besar

#### Konfigurasi
- 500 row per batch

---

### Raw & Clean Data Architecture

Menggunakan tabel:

- `assets_raw`
- `assets_clean`

#### Tujuan
- Memisahkan data mentah
- Memisahkan data hasil klasifikasi

---

### Keyword-Based Classification

Digunakan untuk:

- Identifikasi jenis barang
- Identifikasi merk
- Normalisasi deskripsi aset

---

## Fitur yang Sudah Berhasil

- Dashboard UI
- Sidebar & Topbar
- Upload DAT Excel
- XLSX Parser
- Batch Upload Processing
- Supabase Integration
- Asset Classification
- DAT Oracle Parsing

---

## Struktur Database Saat Ini

### assets_raw

Menyimpan data mentah hasil upload Oracle.

#### Field Utama
- `kode_asset`
- `toko`
- `kategori_oracle`
- `deskripsi`
- `status`

---

### assets_clean

Menyimpan data hasil klasifikasi.

#### Field Utama
- `jenis`
- `merk`
- `kategori`
- `confidence_score`

---

## Hasil Pengujian

- Upload DAT berhasil diproses
- Data berhasil masuk ke database Supabase
- Sistem berhasil membaca file DAT Oracle asli
- Classifier berhasil mengenali beberapa aset seperti:
  - Printer
  - Scanner
  - Komputer

---

## Catatan Pengembangan Selanjutnya

- Dynamic keyword classifier
- Dashboard analytics realtime
- Monitoring mismatch DAT & Web Tracking
- Reporting system
- AI classification enhancement

---

# Rabu, 13 Mei 2026

## Fitur yang Dikerjakan

- Implementasi halaman Review Assets (`/review`)
- Implementasi sistem keyword rule untuk klasifikasi aset
- Integrasi modal tambah rule dengan Supabase
- Implementasi hook `useKeywordRule`
- Sinkronisasi arsitektur form modal dengan centralized hook state
- Implementasi filter dan review workflow aset unknown
- Perbaikan parsing dan workflow review assets
- Integrasi tabel `keyword_rules`

## Teknologi / Library

- Next.js App Router
- React Hooks
- TypeScript
- Supabase
- Tailwind CSS

## Pendekatan / Metode

- Centralized form state management menggunakan custom hook
- Rule-based classification system
- Adaptive keyword learning
- Client-side review workflow
- Modular component architecture

## Progress

- Sistem review asset berhasil berjalan
- Rule berhasil tersimpan ke Supabase
- Dashboard review berhasil diintegrasikan dengan UI utama
- Persiapan integrasi dashboard utama dengan live Supabase statistics

---

# Minggu, 17 Mei 2026

## Pengembangan Classification System

- Merevisi arsitektur keyword classification menjadi database-driven
- Menghapus seluruh hardcoded keyword rule pada classifier
- Mengimplementasikan dynamic keyword matching menggunakan tabel `keyword_rules`
- Menjadikan `keyword_rules` sebagai single source of truth untuk klasifikasi aset
- Menambahkan dukungan rule terpisah berdasarkan `rule_type`: merk, jenis

## Pengembangan Review Workflow

- Merevisi Add Rule modal agar lebih sederhana dan modular
- Menghapus field kategori dan catatan dari rule system
- Mengimplementasikan form rule berbasis: keyword, rule_type, value

## Pengembangan Navigation & UI

- Menghubungkan halaman Dashboard dan Classification
- Menghapus menu sidebar "Review Assets"
- Menjadikan halaman Review sebagai referensi utama design system

## Arsitektur Sistem

- Mempertahankan arsitektur modular existing
- Memastikan classifier tetap sebagai pure utility function
- Implementasi fetch `keyword_rules` dilakukan di API layer untuk menghindari N+1 query

---

# Sabtu, 6 Juni 2026

## Ringkasan Sesi Pengembangan

Sesi pengembangan intensif dengan fokus pada:

1. Live dashboard Classification dari Supabase
2. Optimasi upload pipeline (bulk upsert)
3. Migrasi parser dari Excel ke TXT Oracle asli
4. Penambahan kolom finansial
5. Keyword rule management (edit, delete, revert)
6. No-merk classification support
7. Word boundary matching fix
8. Warehouse filter (CGA only)
9. PDF Report generation
10. Font consistency fix

---

## 1. Live Classification Dashboard

### Masalah Sebelumnya
- Summary cards masih dummy/hardcoded
- Data tidak terhubung ke Supabase

### Solusi
- Implementasi `useReviewAssets` hook dengan fetch langsung ke `assets_clean`
- Query menggunakan join `assets_raw!inner(toko)` untuk filter warehouse
- Fetch semua data dengan pagination loop (bypass Supabase 1000 row limit)
- Fix kolom `confidence` vs `confidence_score` mismatch antara DB dan TypeScript type

### Hasil
- Summary cards menampilkan data live: Total Unknown, Unknown Merk, Unknown Jenis, Completion %
- Completion % dihitung dari total aset gudang (bukan hanya unknown)

> **Catatan retrospektif (7 Juni 2026):** Join `assets_raw!inner(toko)` dihapus di sesi 7 Juni karena arsitektur CGA-only refactor.

---

## 2. Reclassification Engine

### Implementasi
- API route `/api/reclassify` dengan dua mode:
  - Normal mode: reclassify semua aset Unknown dengan keyword rules aktif
  - Revert mode: targeted revert setelah rule dihapus (`revert_merk` / `revert_jenis`)
- Tombol Reclassify di header Classification page
- Auto-trigger reclassify setelah Add Rule modal berhasil simpan
- Success banner menampilkan jumlah aset yang berhasil diklasifikasi ulang

---

## 3. Keyword Rule Management

### Fitur Baru
- Tab **Keyword Rules** di halaman Classification (dua tab: Review Aset & Keyword Rules)
- Edit rule via modal (inline update ke Supabase)
- Delete rule dengan confirm modal + **auto revert aset terdampak**
- Search/filter di tabel keyword rules
- Badge tipe rule: Merk (violet) / Jenis (blue)

### Targeted Revert Engine
- Saat rule dihapus, API reclassify dipanggil dengan parameter `revert_merk` atau `revert_jenis`
- Hanya aset yang nilainya cocok dengan rule yang dihapus yang di-revert
- Jauh lebih efisien dari full reclassify (misalnya hanya 50 aset terdampak vs 4000+)

---

## 4. No-Merk Classification Support

### Latar Belakang
- Beberapa aset memang tidak memiliki merk (barang generic/non-branded)
- Sebelumnya aset seperti ini akan selalu Unknown merk selamanya

### Implementasi
- Rule type baru: `no_merk`
- Classifier: kalau rule type `no_merk` match dan merk masih Unknown → set `merk = 'Non-Merk'`
- AddRuleModal: tambah opsi "No Merk" di dropdown, sembunyikan field value, tampilkan info hint amber
- UnknownBadge: badge slate dengan icon minus untuk Non-Merk (berbeda dari amber Unknown)
- Priority: rule `merk` spesifik selalu menang atas rule `no_merk` (guard `merk === 'Unknown'`)

---

## 5. Word Boundary Matching Fix

### Masalah
- Keyword pendek seperti "GEA" bisa false positive match ke kata "OMEGA", "EGAL", dll
- Keyword multi-kata seperti "AC SPLIT WALL" tidak match karena regex agresif mengubah "WALL 1" → "WALL1"

### Fix
- Hapus regex `replace(/(\w)\s+(\d)/g, '$1$2')` dari `normalizeText()`
- Implementasi word boundary matching: wrap description dan keyword dengan spasi
  ```ts
  const toSearch = ` ${normalized} `
  const toFind = ` ${normalizedKeyword} `
  ```
- "GEA" hanya match kalau ada sebagai kata utuh: " gea " ✅, "omega" ❌

---

## 6. Upload Pipeline Optimization

### Masalah Sebelumnya
- Sequential insert: 1 row per query → 8,310 queries untuk 4,155 baris → 20 menit

### Solusi: Bulk Upsert
- Semua data di-classify di memory terlebih dahulu
- Satu bulk upsert untuk `assets_raw`, satu bulk upsert untuk `assets_clean`
- Total: 2 queries vs 8,310 queries sebelumnya

### Hasil
- 51,459 baris (ALL DAT) selesai dalam **85.6 detik**
- 0 batch gagal, 0 baris dilewati

### Upsert Strategy
- Unique constraint di `kode_asset` pada `assets_raw`
- `ON CONFLICT (kode_asset) DO UPDATE` → upload DAT terbaru otomatis update data lama
- Tidak ada duplikat, database tidak bengkak

> **Catatan retrospektif (7 Juni 2026):** Performance numbers "51,459 baris (ALL DAT)" itu pengujian dengan dataset ALL DAT. Per 7 Juni 2026 sudah CGA-only, jadi dataset sekarang ~4,145 baris dan upload bahkan lebih cepat lagi.

---

## 7. Migrasi dari Excel Parser ke TXT Parser

### Latar Belakang
- File DAT Oracle asli berformat `.txt` (tab-delimited)
- Export ke Excel menyebabkan angka finansial tidak konsisten:
  - `944.000` (Rp 944 ribu) di TXT → Excel baca sebagai integer `944`
  - Sulit dibedakan antara nilai Rp 944 vs Rp 944.000

### Implementasi
- Buat `txtParser.ts` untuk parse file `.txt` Oracle langsung
- Tab-delimited, angka format Indonesia: `' 6.190.000 '` → `6190000`
- Hapus dependency XLSX untuk upload (lebih ringan)
- Update `UploadSection.tsx`: accept `.txt`, reject `.xlsx`
- Update `types.ts`: tambah kolom finansial `kuantitas`, `biaya_perolehan`, `jumlah_tercatat`

---

## 8. Penambahan Kolom Finansial

### Database Migration
```sql
ALTER TABLE assets_raw
ADD COLUMN IF NOT EXISTS kuantitas integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS biaya_perolehan bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS jumlah_tercatat bigint DEFAULT 0;
```

### Performance Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_assets_raw_toko ON assets_raw(toko);
CREATE INDEX IF NOT EXISTS idx_assets_clean_jenis ON assets_clean(jenis);
CREATE INDEX IF NOT EXISTS idx_assets_clean_merk ON assets_clean(merk);
```

---

## 9. Warehouse Filter (CGA Only)

### Latar Belakang
- DAT Oracle ALL berisi 51,459 baris (semua cost center: toko, departemen, gudang)
- Sistem ini fokus monitoring gudang: CGA1, CGA2, CGA3
- Non-gudang tetap tersimpan sebagai background data untuk reconciliation

### Definisi Gudang
| Kode | Nama | Fungsi |
|------|------|--------|
| CGA1 | Cadangan General Affairs 1 | Barang baru dari supplier |
| CGA2 | Cadangan General Affairs 2 | Barang bekas layak pakai |
| CGA3 | Cadangan General Affairs 3 | Barang calon pemusnahan |

### Implementasi
- Konstanta `WAREHOUSE_COST_CENTERS = ['CGA1', 'CGA2', 'CGA3']` di `types.ts`
- Fungsi `buildWarehouseFilter()` menghasilkan Supabase filter string
- Filter diterapkan di: `useReviewAssets`, `/api/reclassify`, `/api/reports/dat-summary`
- Performance: query hanya menyentuh 4,145 dari 51,459 total aset

> **Catatan retrospektif (7 Juni 2026):** Strategi ini berubah total. Per 7 Juni 2026 sistem **CGA-only sejak upload** — non-CGA tidak disimpan sama sekali. `buildWarehouseFilter()` dihapus. Lihat entry 7 Juni 2026 untuk detail.

---

## 10. PDF Report Generation

### Implementasi
- Library: `@react-pdf/renderer`
- API route: `GET /api/reports/dat-summary?cost_center=ALL|CGA1|CGA2|CGA3`
- Halaman Reports di sidebar

### Struktur Report
```
Per Cost Center (CGA1/CGA2/CGA3)
  └── Per Kategori Oracle
        └── Per Jenis Barang (dari assets_clean classifier)
              ├── Item (jumlah kode_asset unik)
              ├── Qty (sum kuantitas)
              ├── Perolehan (sum biaya_perolehan)
              └── Tercatat (sum jumlah_tercatat)
```

### Validasi
- Item count dan Qty 100% match dengan Excel manual Oracle
- CGA1: 2,234 item, 2,553 qty ✅
- CGA2: 1,126 item, 1,710 qty ✅
- CGA3: 785 item, 2,059 qty ✅

---

## 11. Sidebar Active State Fix

### Masalah
- Sidebar menggunakan `useState` untuk tracking active item
- Selalu default ke "dashboard" saat halaman di-load ulang

### Fix
- Ganti dengan `usePathname()` dari Next.js
- Fungsi `getActiveId(pathname)` mapping URL → nav item ID
- Active state selalu akurat berdasarkan URL

---

## 12. Font Consistency Fix

### Masalah
- `layout.tsx` menggunakan Geist font (Next.js default)
- `globals.css` mendefinisikan DM Sans
- Konflik menyebabkan font tidak konsisten antar halaman

### Fix
- Ganti Geist → DM Sans + JetBrains Mono di `layout.tsx`
- Gunakan CSS variable `--font-dm-sans` dari `next/font/google`
- Unifikasi `--color-bg` ke `#080e18` di semua halaman

---

## Status Akhir Sesi (6 Juni 2026)

### Fitur Selesai Hari Ini
- ✅ Live Classification Dashboard (Supabase)
- ✅ Reclassification Engine
- ✅ Targeted Revert Engine
- ✅ Keyword Rule Management (Edit + Delete)
- ✅ No-Merk Classification
- ✅ Word Boundary Matching Fix
- ✅ Bulk Upsert Upload Pipeline
- ✅ TXT Parser (Oracle native format)
- ✅ Kolom Finansial (biaya_perolehan, jumlah_tercatat)
- ✅ Warehouse Filter CGA1/CGA2/CGA3
- ✅ PDF Report Export
- ✅ Sidebar Active State Fix
- ✅ Font Consistency

### Next Priority
- Live Dashboard Statistics (summary cards dummy → Supabase)
- Warehouse Analytics (distribusi aset, nilai per kategori)
- Reconciliation Engine (DAT vs Web Tracking)
- Reporting Module Excel export
- Authentication & Role Management

---

# Minggu, 7 Juni 2026

## Ringkasan Sesi Pengembangan

Sesi paling produktif sejauh ini. Major refactor arsitektur + 3 fitur besar:

1. **Performance optimization** halaman Classification (eksplorasi server-side, finalisasi client-side)
2. **CGA-only architecture refactor** — DB tidak lagi simpan non-CGA
3. **TXT parser auto-detect delimiter** — support TAB dan PIPE
4. **Live Dashboard** dengan layout 6 baris (mix live + placeholder)
5. **Monitoring page** dengan 2 tab (DAT live, LPP placeholder)
6. **Upload Data restructure** — page tersendiri dengan 4 panel
7. **Classification bug fixes** — hide kolom Kategori, fix NaN, fix hydration
8. **TypeScript build fix** untuk Vercel
9. **Closing storage architecture** — keputusan desain (belum implementasi)
10. **Surat Jalan Manual Sesi 1** — schema + sidebar dropdown + Buat SJ + Master Tujuan

---

## 1. Performance Optimization Classification Page

### Masalah Awal
- Halaman Classification load 4.52 detik dengan transfer 268 KB
- Beban berat di koneksi internet kantor yang lambat

### Iterasi Solusi

**Iterasi 1: Server-side via API route**
- Bikin `/api/classification/route.ts` yang handle 5 query parallel di server
- Browser cukup 1 request → 1.47 detik / 7.3 KB
- Trade-off: setiap ganti halaman = network request

**Iterasi 2 (Final): Client-side pagination dengan CGA-only**
- Kombinasi dengan refactor CGA-only (data jauh lebih kecil)
- Fetch semua data sekali, manipulate di JS
- Filter/search/pagination instant tanpa network
- `/api/classification/route.ts` **dihapus** karena tidak diperlukan lagi

---

## 2. CGA-Only Architecture Refactor

### Keputusan Strategis
User memutuskan upload DAT CGA-only saja, bukan ALL DAT. Alasan:
- LPP Web Tracking memang hanya support CGA filter (tidak ada export ALL)
- Tidak ada manfaat menyimpan DAT non-CGA karena reconciliation engine fokus CGA
- DB jauh lebih ringan: 51,459 rows → 4,145 rows

### Perubahan Code
- Hapus `buildWarehouseFilter()` dan semua join `assets_raw!inner(toko)` dari query
- Hapus `/api/classification/route.ts`
- Update `useReviewAssets` ke pure client-side dengan fetch DISTINCT
- Update `/api/reclassify/route.ts` — tanpa warehouse filter
- Update `/api/reports/dat-summary/route.ts` — tanpa join warehouse

### File yang Dihapus
- `src/lib/xlsxParser.ts` (sudah deprecated sejak migrasi TXT)
- `src/app/api/classification/` (seluruh folder)
- `src/components/dashboard/DistribusiCostCenter.tsx` (replaced dengan PlaceholderCards)
- `src/components/dashboard/TopJenisChart.tsx` (replaced dengan PlaceholderCards)

---

## 3. TXT Parser Auto-Detect Delimiter

### Masalah
File DAT Oracle baru dari user pakai delimiter PIPE `|` sedangkan file sebelumnya TAB `\t`. Parser sebelumnya hanya support TAB.

### Solusi
Tambah fungsi `detectDelimiter()` di `txtParser.ts`:
- Hitung jumlah `|` vs `\t` di baris pertama header
- Pakai yang lebih banyak
- Sekarang support kedua format secara otomatis

---

## 4. Live Dashboard - 6 Baris Layout

User minta dashboard yang sesuai dengan core thesis (reconciliation). Layout final:

| Baris | Konten | Status |
|---|---|---|
| 1 | Status Data: DAT Update, DAT Closing, LPP Update, LPP Closing | DAT Update LIVE, lainnya placeholder |
| 2 | DAT vs LPP Comparison (3 cards: CGA1, CGA2, CGA3) | Placeholder |
| 3 | Trend Closing Bulanan (chart 12 bulan) | Placeholder |
| 4 | CGA Summary (3 cards: CGA1 hijau, CGA2 kuning, CGA3 merah) | LIVE |
| 5 | Closing vs Update Comparison (per CGA, naik/turun) | Placeholder |
| 6 | Rekap Pengiriman per Kategori | Placeholder |

### CGA Summary Cards (Baris 4)
Parameter per card: Total Barang, Total Qty, Biaya Perolehan, Jumlah Tercatat.

### Keputusan Teknis
- DAT Update terakhir → `MAX(uploaded_at)` dari `assets_raw` (kolom sudah ada index)
- Index baru: `CREATE INDEX idx_assets_raw_uploaded_at ON assets_raw(uploaded_at DESC)`
- LPP & Closing semuanya null → tampil "Belum ada data"
- Welcome banner dynamic (count unknown asset)
- UploadSection **dihapus dari Dashboard**, dipindah ke `/upload`

### File Baru
- `src/app/api/dashboard/stats/route.ts`
- `src/hooks/useDashboardStats.ts`
- `src/components/dashboard/DataStatusCards.tsx` (Baris 1)
- `src/components/dashboard/CGASummaryCards.tsx` (Baris 4)
- `src/components/dashboard/PlaceholderCards.tsx` (Baris 2, 3, 5, 6 — 4 components)

---

## 5. Monitoring Page - 2 Tab

### Konsep
Halaman monitoring untuk awareness reconciliation status. Dua tab terpisah seperti Classification.

**Tab DAT Monitoring:**
- List semua aset DAT yang belum punya SJ di Web Tracking
- Indikasi: aset sudah dikirim fisik tapi belum di-tracking di WT
- Live data dengan tag dummy "Pending" (LPP belum ada)

**Tab LPP Monitoring:**
- List aset LPP yang belum dimutasi secara Oracle DAT
- Empty state (data LPP belum ada)

### Kolom Tabel
Kategori | Jenis | Merk | Cost Center (badge warna) | Kode Aset | Deskripsi | Status

### Cost Center Badge
- CGA1 = hijau (emerald)
- CGA2 = kuning (amber)
- CGA3 = merah (rose)

### Filter & Search
- Filter Cost Center: ALL / CGA1 / CGA2 / CGA3
- Search by kode atau deskripsi
- Pagination client-side

### Summary Cards Per Tab
- **Tab DAT:** Total DAT Aset | Pending SJ WT | Sinkron
- **Tab LPP:** Total LPP | Belum Mutasi DAT | Sinkron (semua "—" karena belum ada data)

### File Baru
- `src/app/api/monitoring/route.ts`
- `src/hooks/useMonitoring.ts`
- `src/app/monitoring/page.tsx`

---

## 6. Upload Data Restructure

### Sebelumnya
Upload DAT di Dashboard (UploadSection component).

### Sekarang
Halaman terpisah `/upload` dengan **4 panel**:
- DAT Update (LIVE — fungsional, pakai UploadSection existing)
- DAT Closing (placeholder)
- LPP Update (placeholder)
- LPP Closing (placeholder)

### Sidebar Rename
"Upload DAT" → "Upload Data"

---

## 7. Classification Page Bug Fixes

- **Hilangkan kolom "Kategori"** dari tabel review (semua Unknown, tidak berguna)
- **Fix "Menampilkan 1–NaN"** karena field `totalCount` undefined → ubah pakai `filtered.length`
- **Hydration warning** dari input search yang di-inject `fdprocessedid` oleh browser extension → fix dengan `suppressHydrationWarning`
- **Toolbar count format:** `a / b aset` dimana a = hasil filter, b = total semua unknown

---

## 8. TypeScript Build Fix (Vercel)

Build error: `'no_merk' is not assignable to type '"jenis" | "merk"'`

### Fix
Di `KeywordRulesTab.tsx`:
- State type include `"no_merk"` di union: `"jenis" | "merk" | "no_merk"`
- `RuleTypeBadge` handle 3 case (jenis/merk/no_merk) dengan warna berbeda (Jenis biru, Merk violet, No Merk slate)

---

## 9. Closing Storage Architecture (KEPUTUSAN, BELUM IMPLEMENTASI)

Diskusi mendalam tentang bagaimana menyimpan data DAT/LPP Closing. **Keputusan strategis:** Tidak simpan row-level data closing, hanya aggregate metrics.

### Schema yang Direncanakan
```sql
CREATE TABLE closing_snapshots (
  id uuid PRIMARY KEY,
  data_type text,           -- 'DAT' | 'LPP'
  period text,              -- '2026-05' (YYYY-MM)
  uploaded_at timestamptz,
  total_items integer,
  total_qty integer,
  total_biaya_perolehan bigint,
  total_jumlah_tercatat bigint,
  breakdown_by_toko jsonb,
  breakdown_by_kategori jsonb,
  breakdown_by_jenis jsonb,
  kode_assets text[]        -- array untuk diff comparison
);
```

### Alasan
- Storage efisien (puluhan ribu rows × N bulan = bengkak kalau row-level)
- Comparison cukup butuh aggregate
- Closing memang sifatnya statis (cuma butuh angka final)

### Mekanisme Upload Closing (Direncanakan)
- User pilih period manual (12 bulan dropdown)
- Parser hitung aggregate in-memory
- Simpan ke `closing_snapshots`
- Data mentah di-discard (tidak masuk `assets_raw`)

### Format Period
- Closing: `2026-05` → display "Mei 2026"
- Update: tanggal upload → display "8 Juni 2026"

---

## 10. Surat Jalan Manual - Sesi 1

### Konteks Bisnis
SJ existing tidak punya autorecap, user harus rekap manual. Kita gantikan dengan sistem yang autorecap.

### Roadmap Multi-Sesi
- **Sesi 1 (selesai):** Schema + Sidebar dropdown + Buat SJ + Master Tujuan
- Sesi 2: List SJ + edit/delete/reschedule
- Sesi 3: Report dashboard + Excel export
- Sesi 4: Monitoring alokasi (checkbox mutasi Oracle)

### Database (3 Tabel Baru)

```sql
-- Master tujuan / cost center penerima
sj_tujuan (id, kode UNIQUE, nama, created_at)

-- Header SJ
surat_jalan (id, no_sj UNIQUE, tanggal, tujuan_id FK,
             pembawa, penerima, status, created_by, approved_by,
             created_at, updated_at)

-- Detail items
surat_jalan_items (id, sj_id FK ON DELETE CASCADE, urutan,
                   jenis, merk, serial_number, qty, satuan,
                   is_baru, is_aktiva, keterangan,
                   mutasi_oracle_status, mutasi_oracle_at, kode_asset)
```

Plus 7 indexes untuk query cepat. RLS allow-all (konsisten dengan pattern existing).

### Sidebar Dropdown
- Parent "Surat Jalan Manual" dengan icon document
- 4 sub-menu: Buat SJ | List SJ | Master Tujuan | Report
- Auto-expand kalau child aktif
- Collapsed mode: klik parent → ke child pertama

### Format No SJ
`SJ-Manual/CGA/YYYY/MM/XXXX`
- Sequence 4 digit, reset per bulan, global unique
- Generated server-side via helper `generateNoSJ()`

### Form Buat SJ — Keputusan UX Final
- Header: Tanggal, Tujuan (searchable dropdown dari `sj_tujuan`), Pembawa
- **Penerima OTOMATIS** = label tujuan (kode + nama), tidak ada input field
- **Approved By HARDCODED** = "SPV/Manager", tidak ada input field
- Items table dengan kolom: No(40) | Jenis(min160) | Merk(min160) | SN(140) | Qty(60) | Satuan(85) | Baru(50) | AT(50) | Keterangan(min150) | Aksi(70)
- Aksi per row: duplicate row (icon arrow down) + delete row (icon trash)
- 2 button submit: "Simpan Draft" (status draft) atau "Submit" (status submitted, redirect `/sj/list`)

### Source Data Dropdown Jenis & Merk
Keputusan setelah analisis trade-off (**tidak buat tabel master baru**):
- Query DISTINCT dari `assets_clean` WHERE jenis/merk != 'Unknown'
- Cache server-side 5 menit TTL (in-memory Node.js)
- Auto-invalidate akan ditambah saat reclassify selesai (Sesi berikutnya)
- Alasan: zero maintenance, always fresh, tidak ada duplikasi data

### Validasi Form
- **Wajib:** Tanggal + Tujuan + minimal 1 baris Jenis terisi
- **Optional:** Pembawa, SN, Merk, Keterangan

### SearchableDropdown Component
- Reusable component dengan search built-in
- Implementasi awal: dropdown clipped oleh `overflow:hidden` parent
- **Fix: pakai React Portal + `position: fixed`** → dropdown render di `document.body`, bebas dari clipping
- Auto-close on scroll/resize/outside-click
- Mode `allowCustom`: izinkan value yang tidak ada di options (untuk jenis/merk baru)

### SatuanSelect Custom
- Native `<select>` di-replace karena styling tidak konsisten dengan tema (font putih di background gelap, tampilan mentah)
- Custom dropdown dengan 5 options (Unit, Set, Pcs, Koli, Pack)
- Styling konsisten dengan SearchableDropdown

### Qty Input
- Awal: `<input type="number">` dengan spinner
- Final: `<input type="text" inputMode="numeric">` + sanitize digit only
- Plus CSS global untuk hilangkan spinner WebKit/Mozilla

### CRUD Master Tujuan
- Halaman `/sj/tujuan` dengan tabel + modals
- Create/Edit modal dengan validasi kode + nama
- Delete modal dengan konfirmasi
- Search by kode atau nama
- Kode auto-uppercase saat save

### Testing Tervalidasi
- Created: 1 master tujuan (XXXX - Toko XXXX)
- Created: 1 surat jalan (SJ-Manual/CGA/2026/06/0001) dengan 4 items
- Validasi: No SJ format benar, penerima otomatis terisi, approved_by hardcoded, items tersimpan dengan urutan benar, mutasi_oracle_status default false

### File Baru
**Backend:**
- `src/app/api/sj/route.ts` (POST create SJ)
- `src/app/api/sj/tujuan/route.ts` (CRUD)
- `src/app/api/sj/master/jenis/route.ts` (5-min cache)
- `src/app/api/sj/master/merk/route.ts` (5-min cache)

**Frontend:**
- `src/app/sj/buat/page.tsx`
- `src/app/sj/tujuan/page.tsx`
- `src/components/sj/SearchableDropdown.tsx`
- `src/components/sj/SJItemsTable.tsx`
- `src/hooks/useSJMaster.ts` (3 hooks)
- `src/lib/sjTypes.ts`

---

## Status Akhir Sesi (7 Juni 2026)

### Major Refactor
- ✅ CGA-only architecture (DB tidak simpan non-CGA)
- ✅ Hapus `buildWarehouseFilter()` dan semua join warehouse
- ✅ Client-side pagination untuk Classification

### Fitur Selesai Hari Ini
- ✅ Live Dashboard 6 baris (DAT Update + CGA Summary live, lainnya placeholder)
- ✅ Monitoring 2-tab page (DAT live, LPP placeholder)
- ✅ Upload Data page (4 panel, DAT Update fungsional)
- ✅ Sidebar dropdown support
- ✅ TXT Parser auto-detect delimiter (pipe/tab)
- ✅ Classification UX polish
- ✅ TypeScript build fix
- ✅ Surat Jalan Manual Sesi 1 (database + Buat SJ + Master Tujuan)

### Next Priority
- Sesi 2 SJ Manual: List SJ + edit/delete/reschedule
- Sesi 3 SJ Manual: Report dashboard + Excel export
- Sesi 4 SJ Manual: Monitoring alokasi (checkbox mutasi Oracle)
- Implementasi Closing snapshots architecture
- LPP Web Tracking integration
- Authentication & Role Management (Supabase Auth)
- DB optimization (materialized view, PostgreSQL function) — deferred sampai semua fitur selesai

---

# Senin, 8 Juni 2026 (Sesi Sore)

## Ringkasan Sesi Pengembangan

Lanjutan sesi Senin pagi. Fokus pada **Surat Jalan Manual Sesi 3** (Report + Excel Export) dan **Fitur Print/PDF SJ** (kritikal karena tanpa print, sistem SJ Manual tidak fungsional end-to-end untuk operasional).

---

## 1. Surat Jalan Manual - Sesi 3 (Report + Excel Export)

### Halaman `/sj/report`

**Filter Panel (4 baris):**
1. Period preset chips: Semua / Hari Ini / Kemarin / 7 Hari / Bulan Ini / Custom
2. Custom date range (muncul saat preset = Custom): Dari - Sampai
3. Multi filter: Tujuan (searchable) | Jenis (searchable) | Status (styled select)
4. Search: Field selector (Semua / No SJ / SN / Pembawa) + input + Reset Filter button

**Hasil info bar:**
> Menampilkan 156 item dari 32 Surat Jalan ke 15 tujuan — Total Qty: 200
> Periode: 1-8 Juni 2026

**Tabel flat (1 row = 1 item barang):**
Tanggal | No SJ | Tujuan | Pembawa | Jenis | Merk | SN | Qty | Satuan | Keterangan | Status

**Layout final tabel** (setelah tweak):
- SN dipersempit 120px → 80px (cuma 6 digit pertama yang relevan)
- Keterangan diperluas 180px → 220px
- min-w table 1280px → 1380px (fix Status column overflow)
- Horizontal scroll otomatis kalau layar sempit

### Excel Export

**Library:** `xlsx` (SheetJS) — ~200KB, paling ringan dan zero server load (generate client-side).

**Format output (single sheet flat, 17 kolom):**
No | Tanggal | No. SJ | Kode Tujuan | Nama Tujuan | Pembawa | Penerima | Jenis | Merk | Serial Number | Qty | Satuan | Baru | AT | Keterangan | Status | Disetujui

**Behavior:**
- Tombol "Export Excel" auto-pakai filter yang sedang aktif
- Filename otomatis: `Laporan-Surat-Jalan-YYYY-MM-DD.xlsx`
- Disabled saat hasil filter kosong
- Column widths auto-set agar readable

### StyledSelect Component

Native `<select>` di Status SJ dan Search Field tidak konsisten dengan tema (font putih di bg gelap, tampilan mentah). Dibuat `StyledSelect` component custom — pattern yang sama dengan `SatuanSelect` di SJItemsTable. Sekarang semua dropdown konsisten.

### Reset Filter Button

Diganti dari text link plain ke button styled amber/jingga (mirip Export Excel button tapi warna amber) + icon refresh. Disabled state (opacity 40%) saat tidak ada filter aktif.

### File Baru
- `src/app/api/sj/report/route.ts` — GET endpoint untuk flat items
- `src/hooks/useSJReport.ts` — fetch wrapper
- `src/lib/excelExporter.ts` — utility export pakai SheetJS
- `src/app/sj/report/page.tsx` — halaman report
- Library `xlsx` ditambahkan ke dependencies

---

## 2. Fitur Print / PDF Surat Jalan

### Konteks
Tanpa print, sistem SJ Manual tidak fungsional secara operasional — user tidak bisa cetak fisik untuk minta TTD. Fitur ini dijadikan prerequisite sebelum Sesi 4.

### PDF Layout — Modern tapi Formal

**Header:** Logo Indomaret + "PT. Indomarco Prismatama / General Affairs Division" + judul "SURAT JALAN" (fresh dengan accent cyan, 2pt border bottom)

**Meta box:** No SJ + Tanggal Pengiriman dalam container slate background

**Tujuan section:** Border-left 3px cyan thick (modern accent style)

**Items table:**
- Header dengan accent biru muda
- Alternating row colors (zebra striping)
- Tag badges inline: hijau "BARU" + biru "AT"
- Kolom: No | Jenis | Merk | Serial No | Qty | Satuan | Tag | Keterangan
- SN pakai font monospace (Courier)

**Total row:** Total Item + Total Qty di bagian bawah tabel

**4 kolom TTD:**
- Dibuat: hardcoded "Admin GA"
- Disetujui: hardcoded "SPV/Manager"
- Pembawa: dari input form
- Penerima: dari label tujuan (auto)

**Footer:**
- Branding "SmartWMS"
- Page number "Halaman X / N" (auto pagination kalau items banyak melebihi 1 halaman A4)

### Library
- `@react-pdf/renderer` — sudah ada di project (sebelumnya dipakai untuk DAT Summary report)
- Tidak perlu library tambahan, sesuai prinsip "tidak menambah dependency tidak perlu"

### Logo Strategy

**Path:** `public/logo-idm.png` (BUKAN `src/assets/` karena Next.js tidak serve dari src ke browser)

**Loading:**
- Logo di-fetch sebagai blob → convert ke base64
- Di-cache di module-level variable (load sekali per session, bukan per generate)
- Fallback ke text "INDOMARET" dengan background cyan kalau file gagal load
- Console.warn kalau gagal (untuk debugging) tapi tidak block proses

**Concern legal:** Logo Indomaret adalah trademark. Untuk demo skripsi (educational) aman. Kalau di-deploy publik atau komersial, perlu ganti.

### Modal Preview (SJPreviewModal)

Modal dengan iframe yang menampilkan PDF preview real-time:
- Generate PDF blob → create object URL → tampilkan di iframe
- 2 button utama: Download PDF (cyan) + Print (emerald)
- Print button buka PDF di tab baru → user tinggal Ctrl+P
- Download button save dengan filename auto: `SJ-Manual-CGA-2026-06-0001.pdf` (slash di-replace dash)
- Loading state dengan spinner saat generate
- Error state dengan retry hint
- Object URL otomatis di-revoke saat modal ditutup (no memory leak)

### Auto-Trigger Modal

Modal preview muncul otomatis di 4 skenario:
1. **Submit Buat SJ baru** → preview → tutup → form reset
2. **Update Edit SJ** → preview → tutup → redirect ke `/sj/list`
3. **Reschedule berhasil** → preview → tutup → refresh list
4. **Klik icon printer hijau** di `/sj/list` row → instant preview anytime

Modal preview SELALU muncul setelah ada perubahan data SJ — user pasti dapat kesempatan print setelah create/edit/reschedule.

### Helper Functions (sjPdfHelpers.ts)

3 utility functions:
- `generateSJPdfBlob(data)` — return Blob untuk preview iframe
- `downloadSJPdf(data)` — trigger browser download
- `openSJPdfForPrint(data)` — buka di tab baru

Semua share logo loader yang sama (cache module-level).

### PreviewWrapper Component

Di list page, ada wrapper component yang handle fetch detail SJ via `useSJDetail`. Saat user klik printer icon, wrapper fetch full data (header + items) lalu pass ke `SJPreviewModal`. Pakai loading state minimalist sambil tunggu fetch.

### File Baru / Diubah
- **NEW** `src/components/sj/SuratJalanPDF.tsx` — PDF document template
- **NEW** `src/lib/sjPdfHelpers.ts` — utility functions
- **NEW** `src/components/sj/SJPreviewModal.tsx` — modal dengan iframe preview
- **UPDATED** `src/app/sj/buat/page.tsx` — replace success state dengan modal trigger
- **UPDATED** `src/app/sj/list/page.tsx` — add print button + auto-preview after reschedule

### Performance Considerations

Sesuai prinsip optimal/enteng:
- Logo cache di memory (1x load per session)
- PDF generate client-side (zero server/DB load)
- Iframe blob URL di-revoke saat tutup modal
- `@react-pdf/renderer` sudah ada di bundle, tidak nambah berat

---

## Status Akhir Sesi (8 Juni 2026, Sore)

### Fitur Selesai
- ✅ Surat Jalan Manual Sesi 3 (Report + Excel Export)
- ✅ Print/PDF feature dengan preview modal
- ✅ Logo Indomaret integration dengan cache strategy

### Next Priority
- Sesi 4 SJ Manual: Monitoring alokasi (checkbox mutasi Oracle)
- Implementasi Closing snapshots architecture
- LPP Web Tracking integration
- Authentication & Role Management

---

# Selasa, 9 Juni 2026

## Ringkasan Sesi Pengembangan

Sesi ini fokus pada 4 hal: Keyword Rule Consistency, SJ Rekap Alokasi refactor, rename sidebar, dan Monitoring DAT overhaul.

---

## 1. Keyword Rule Consistency

### Masalah
Data `keyword_rules` inconsistent — ada value yang sama tapi berbeda casing (misal "CPU" dan "Cpu" dianggap 2 jenis berbeda). Ini menyebabkan Report DAT menampilkan data terfragmentasi padahal merujuk ke jenis yang sama.

### Solusi
Pendekatan UI-level: autocomplete suggestion + disable submit saat terdeteksi casing mismatch. Lebih ringan dari server-side duplicate check (tidak ada network round-trip tambahan).

### Autocomplete Suggestion (AddRuleModal + EditRuleModal)
- Field "Value" (Jenis/Merk) sekarang pakai `AutocompleteInput` component
- Suggestion di-fetch dari `/api/keyword-rules/values?type=jenis|merk`
- Matching case-insensitive saat mengetik — user langsung lihat value yang sudah ada
- Source: `keyword_rules` saja (bukan `assets_clean`) sesuai prinsip "dasar dari keyword rule itu sendiri"

### Disable Submit Saat Mismatch
- Kalau user ketik value yang case-insensitive match dengan existing tapi casing beda (mis. ada "CPU", user ketik "cpu"):
  - Warning hint amber muncul: *Sudah ada value "CPU" — klik untuk pakai casing yang sudah ada*
  - Tombol Simpan **otomatis disabled** (opacity 40%, cursor not-allowed, tooltip on hover)
  - Klik suggestion → value auto-replace ke casing existing → tombol aktif lagi
- Tidak ada server-side check saat submit → hemat 1 Supabase query per save

### Mismatch Detection via Callback
`AutocompleteInput` expose `onMismatchChange` callback:
```ts
onMismatchChange?: (mismatch: { hasMismatch: boolean; existingValue: string | null }) => void
```
Parent (`AddRuleModal` / `EditRuleModal`) track state `valueMismatch` → disable button.

### SQL Migration (One-time)
SQL script `migration-keyword-rules-cleanup.sql` untuk cleanup data existing:
- STEP 1: SELECT duplikat (read-only, aman)
- STEP 2: DELETE duplikat, keep yang `created_at` paling awal
- STEP 3: Verifikasi 0 rows duplikat tersisa
- Setelah cleanup: jalankan Reclassify di `/review`

### File Baru / Diubah
- **NEW** `src/components/review/AutocompleteInput.tsx`
- **NEW** `src/hooks/useKeywordRuleValues.ts`
- **NEW** `src/app/api/keyword-rules/values/route.ts`
- **UPDATED** `src/components/review/AddRuleModal.tsx`
- **UPDATED** `src/components/review/KeywordRulesTab.tsx`
- **UPDATED** `src/hooks/useKeywordRule.ts` (simplified, hapus server-side duplicate check)

---

## 2. SJ Rekap Alokasi — Filter Refactor

### Sebelumnya
Halaman `/sj/report` punya 3 dropdown terpisah: Tujuan (searchable), Jenis Barang (searchable), Status SJ. Terlalu banyak komponen di filter panel, tidak efisien.

### Sesudahnya
Semua filter kolom digabung ke 1 **dropdown CARI** dengan 7 pilihan:
1. Semua Field
2. Tujuan (cari kode/nama)
3. Jenis Barang
4. Status SJ (ketik: Draft / Submitted / Completed)
5. No. SJ
6. Serial Number
7. Pembawa
8. Keterangan ← tambahan baru

Placeholder input dinamis sesuai field yang dipilih (mis. pilih Status → placeholder "Draft / Submitted / Completed").

### Rename Periode
"7 Hari" → **"Minggu Ini"** (lebih natural). Update di label chip + slug untuk filename Excel.

### Dynamic Excel Filename
Nama file Excel sekarang mencerminkan filter aktif:

| Filter Aktif | Nama File |
|---|---|
| Tanpa filter | `Report-Alokasi-Semua-Periode-YYYY-MM-DD.xlsx` |
| Minggu Ini | `Report-Alokasi-Minggu-Ini-YYYY-MM-DD.xlsx` |
| Minggu Ini + Jenis=CPU | `Report-Alokasi-Minggu-Ini-sort-by-Jenis-CPU-YYYY-MM-DD.xlsx` |
| Custom + SN=50185 | `Report-Alokasi-2026-06-01-sd-2026-06-08-sort-by-SN-50185-YYYY-MM-DD.xlsx` |

### File Diubah
- **UPDATED** `src/app/sj/report/page.tsx` — filter refactor + dynamic filename

---

## 3. Rename Sidebar & Headings

Perubahan naming di dropdown "Surat Jalan Manual":
- **"List Surat Jalan"** → **"Daftar Surat Jalan"** (+ heading halaman `/sj/list`)
- **"Report"** → **"Rekap Alokasi"** (+ heading halaman `/sj/report`)

---

## 4. Monitoring DAT — Major Overhaul

### Filter System Baru: Multi-Field Tag Filter

Sebelumnya monitoring hanya punya filter CGA chip + 1 search box sederhana.

Sekarang pakai **multi-field tag filter** dengan AND logic antar tag:
1. Pilih field dari dropdown (Jenis/Merk/Kode Aset/Kategori Oracle/Deskripsi)
2. Ketik value → tekan Enter → jadi tag berwarna
3. Ganti field → ketik lagi → tag baru ditambahkan
4. Logic: AND antar semua tag (Jenis:CPU **AND** Merk:Zyrex)

**Warna tag per field:**
- Jenis → cyan
- Merk → violet
- Kode Aset → blue
- Kategori Oracle → amber
- Deskripsi → slate

**Cost Center chips** tetap single-select (ALL/CGA1/CGA2/CGA3), AND dengan tag filter.

### Fix Cost Center Badge di Tabel

**Masalah:** Data `toko` di DB berisi nama panjang "CGA1 – CADANGAN GENERAL AFFAIRS 1", bukan kode singkat "CGA1". Badge tampil panjang dan merusak layout.

**Fix:** Fungsi `extractCGACode()` dengan regex `/CGA\d/i` — parse nama panjang → kode singkat. Dipakai di CGABadge, filter chip comparison, dan Excel exporter.

```ts
function extractCGACode(toko: string): string {
  const match = toko.match(/CGA\d/i);
  return match ? match[0].toUpperCase() : toko;
}
```

**CGABadge** sekarang tampil kode singkat dengan warna signature:
- CGA1 → emerald
- CGA2 → amber
- CGA3 → rose

### Kolom Tabel Reorder

**Sebelum:** Jenis | Merk | Cost Center | Kategori Oracle | Kode Aset | Qty | Deskripsi | Perolehan

**Sesudah:** Kategori Oracle | Jenis | Merk | Cost Center | Kode Aset | Deskripsi | Qty | Perolehan | **Tercatat** ← tambahan

Data auto-sorted by 5 kolom pertama: Kategori Oracle → Jenis → Merk → Cost Center → Kode Aset.

### Horizontal Scroll
Tabel dibungkus `overflow-x-auto` + `min-w-[1380px]` untuk accommodate 9 kolom.

### Export Excel 2 Sheet

**Sheet 1 — Summary:**
Group per Jenis × Cost Center dengan subtotal per Jenis + Grand Total.
Kolom: Jenis | Cost Center | Total Item | Total Qty | Biaya Perolehan | Jumlah Tercatat

**Sheet 2 — Detail DAT:**
1 row = 1 aset, sorted Jenis → Cost Center.
Kolom: No | Jenis | Merk | Cost Center | Kategori Oracle | Kode Aset | Deskripsi | Qty | Biaya Perolehan | Jumlah Tercatat

**Nama file dinamis:**
- `Monitoring-DAT-Semua-CGA-sort-by-Jenis-CPU-Super-Blender-2026-06-09.xlsx`

### File Baru / Diubah
- **NEW** `src/components/monitoring/TagInput.tsx`
- **NEW** `src/lib/monitoringExporter.ts`
- **UPDATED** `src/app/monitoring/page.tsx`
- **UPDATED** `src/app/api/monitoring/route.ts`
- **UPDATED** `src/hooks/useMonitoring.ts`

---

## Status Akhir Sesi (9 Juni 2026)

### Selesai Hari Ini
- ✅ Keyword Rule Consistency (autocomplete + disable submit on mismatch)
- ✅ SQL migration cleanup duplikat existing
- ✅ SJ Rekap Alokasi filter refactor (7-field unified search)
- ✅ Dynamic Excel filename
- ✅ Rename sidebar: Daftar SJ + Rekap Alokasi
- ✅ Monitoring DAT overhaul (multi-field tag filter + Excel export 2 sheet)
- ✅ extractCGACode fix untuk data DB nama panjang
- ✅ Kolom tabel reorder + sort + Tercatat column

### Next Priority
- Sesi 4 SJ Manual: Monitoring alokasi (checkbox mutasi Oracle)
- Closing snapshots architecture (DAT/LPP Closing upload)
- LPP Web Tracking integration
- Authentication & Role Management

---

# Selasa, 9 Juni 2026 (Sesi Sore — Bug Fixes)

## Ringkasan

Sesi fokus pada berbagai bug fix yang ditemukan saat testing operasional.

---

## 1. SearchableDropdown — Keyboard Navigation & Tab Support

### Masalah
- Arrow Up/Down tidak berfungsi di dropdown Jenis/Merk pada form Buat SJ
- Tidak bisa scroll dropdown list (dropdown hilang saat scroll)
- Setelah pilih item, Tab tidak pindah ke kolom berikutnya

### Root Cause
- Tidak ada handler ArrowUp/ArrowDown di search input
- Event listener `scroll` dengan `capture: true` intercept semua scroll event termasuk scroll di dalam dropdown list sendiri
- Setelah pilih item, fokus kembali ke `document.body` bukan ke trigger button

### Fix
- Tambah keyboard navigation: ArrowUp/Down navigasi highlight, Enter/Tab pilih item
- Mouse hover sync dengan highlight state
- `onMouseDown preventDefault` fix click-before-blur bug
- Auto-focus search input saat dropdown buka
- Auto-scroll highlighted item ke viewport
- Tab: pilih item ter-highlight → fokus ke trigger → Tab natural browser ke elemen berikutnya
- Scroll close guard: cek apakah scroll terjadi di dalam `dropdownRef` sebelum close
- `forwardRef` support untuk external focus control
- Hapus `memo()` wrapper dari `forwardRef` (React 19 compatibility)

### File Diubah
- **UPDATED** `src/components/sj/SearchableDropdown.tsx`

---

## 2. Cache Invalidation Setelah Edit/Delete Keyword Rule

### Masalah
Setelah edit atau delete keyword rule, dropdown Jenis/Merk di form Buat SJ dan suggestion di AddRuleModal masih menampilkan data lama — harus tunggu 5 menit TTL atau refresh manual.

### Root Cause
`KeywordRulesTab.tsx` tidak memanggil invalidate cache setelah `UPDATE` (edit) atau `DELETE` rule. Hanya `useKeywordRule` (add rule) yang sudah invalidate cache.

### Fix
Tambah fungsi `invalidateAllCaches()` di `KeywordRulesTab.tsx` yang dipanggil setelah:
- Edit rule berhasil (setelah `onSaved()`)
- Delete rule berhasil (setelah revert + `onDeleted()`)

```ts
function invalidateAllCaches() {
  fetch("/api/keyword-rules/values", { method: "DELETE" }).catch(() => {});
  fetch("/api/sj/master/jenis",      { method: "DELETE" }).catch(() => {});
  fetch("/api/sj/master/merk",       { method: "DELETE" }).catch(() => {});
}
```

Sekarang semua aksi rule (add/edit/delete) → cache langsung bersih → UI langsung fresh.

### File Diubah
- **UPDATED** `src/components/review/KeywordRulesTab.tsx`

---

## 3. Fix Revert no_merk Rule Saat Delete

### Masalah
Saat rule `no_merk` dihapus via UI, aset yang ter-klasifikasi "Non-Merk" tidak otomatis revert ke Unknown.

### Root Cause
`DeleteConfirmModal` di `KeywordRulesTab` salah kirim body ke `/api/reclassify`:
```ts
// SALAH — no_merk masuk ke else branch
if (rule.rule_type === "merk") body.revert_merk = rule.value;
else body.revert_jenis = rule.value;  // kirim revert_jenis = "Non-Merk" — tidak ada aset dengan jenis "Non-Merk"
```

### Fix
```ts
if (rule.rule_type === "merk")          body.revert_merk  = rule.value;
else if (rule.rule_type === "no_merk")  body.revert_merk  = "Non-Merk";
else                                    body.revert_jenis = rule.value;
```

---

## 4. Classifier 2-Pass Logic

### Masalah
Aset dengan deskripsi mengandung keyword `no_merk` sekaligus keyword `merk` spesifik (mis. "DVR 16 CH Dahua") bisa ter-klasifikasi sebagai Non-Merk kalau rule `no_merk` "DVR" diproses sebelum rule `merk` "DAHUA" di loop.

### Fix
Ganti 1 loop menjadi 2 pass:

**Pass 1:** Loop semua rules, skip `no_merk`, proses jenis + merk spesifik dulu.

**Pass 2:** Hanya dijalankan kalau merk **masih Unknown** setelah Pass 1 — baru cek `no_merk` rules sebagai fallback.

Dengan ini, merk spesifik **selalu menang** atas `no_merk` regardless urutan rules di DB.

### File Diubah
- **UPDATED** `src/lib/classifier.ts`

---

## 5. Fix cellToNumber — Oracle DAT Desimal Format

### Masalah
Nilai `jumlah_tercatat` di DB jauh lebih besar dari yang seharusnya. Contoh: `10164583.33` di file TXT tersimpan sebagai `1016458333` di DB (100x lebih besar).

### Root Cause
Fungsi `cellToNumber` di `txtParser.ts` menggunakan:
```ts
const cleaned = str.replace(/\./g, "").replace(/,/g, ".");
```
Ini hapus **semua titik** tanpa melihat konteks. Padahal Oracle export kadang menggunakan titik sebagai desimal (`10164583.33`) bukan sebagai ribuan — sehingga titik desimal ikut terhapus.

### Fix: Smart dot detection
```ts
if (str.includes(",")) {
  // Format Indonesia: titik=ribuan, koma=desimal
  cleaned = str.replace(/\./g, "").replace(",", ".");
} else {
  const dotParts = str.split(".");
  if (dotParts.length > 2) {
    // Lebih dari 1 titik → semua titik adalah ribuan
    cleaned = str.replace(/\./g, "");
  } else if (dotParts.length === 2 && dotParts[1].length <= 2) {
    // Tepat 1 titik + ≤2 digit → titik adalah desimal
    cleaned = str;
  } else {
    // Tepat 1 titik + 3 digit → titik adalah ribuan
    cleaned = str.replace(/\./g, "");
  }
}
```

Format yang di-handle:
| Input | Output | Konteks |
|---|---|---|
| `2.383.000` | `2383000` | Titik ribuan |
| `10.164.583,33` | `10164583` | Format Indonesia |
| `10164583.33` | `10164583` | Titik desimal |
| `2383000` | `2383000` | Plain integer |

### Tindakan Lanjutan
Setelah deploy fix ini, **upload ulang file DAT** agar data di DB ter-parse ulang dengan benar.

### File Diubah
- **UPDATED** `src/lib/txtParser.ts`

---

## Status Akhir Sesi (9 Juni 2026, Sore)

### Selesai
- ✅ SearchableDropdown keyboard navigation + Tab support + scroll fix
- ✅ Cache invalidation setelah edit/delete keyword rule
- ✅ Fix revert no_merk rule saat delete
- ✅ Classifier 2-pass logic (merk spesifik > no_merk)
- ✅ cellToNumber fix untuk Oracle DAT desimal format

### Action Required
- ⚠ Upload ulang file DAT TXT setelah deploy — data `jumlah_tercatat` di DB perlu di-refresh dengan parser baru

---

# Selasa, 9 Juni 2026 (Sesi Malam)

## Ringkasan Sesi

Sesi fokus pada: bulk insert master tujuan, keputusan arsitektur upload DAT, implementasi delete-then-insert pipeline, perencanaan fitur "Changed" di Classification, dan berbagai bug fix minor.

---

## 1. Bulk Insert 928 Master Tujuan

928 data tujuan di-import dari file Excel (`list-tujuan.xlsx`) via SQL INSERT yang di-generate otomatis dari Python script. Query pakai `ON CONFLICT (kode) DO UPDATE SET nama = EXCLUDED.nama` supaya aman kalau ada kode yang sudah exist (tidak error duplikat).

---

## 2. Rekap Alokasi — Sort by No. SJ Desc

Tabel di halaman `/sj/report` (Rekap Alokasi) sekarang di-sort by **No. SJ descending** (terbaru di atas), lalu urutan item dalam SJ yang sama ascending.

Sort by No. SJ string sudah otomatis sort by tanggal juga karena format `SJ-Manual/CGA/YYYY/MM/XXXX` embed tahun dan bulan di dalam string.

**File Diubah:**
- **UPDATED** `src/app/sj/report/page.tsx`

---

## 3. Keputusan Arsitektur Upload DAT — Full Replace Strategy

### Konteks
Diskusi tentang bagaimana sistem menyikapi 3 skenario saat upload DAT terbaru:
1. Nomor DAT yang masih ada → overwrite dengan data terbaru
2. Nomor DAT yang sudah dimutasi Oracle (hilang dari file) → harus hilang dari DB
3. Nomor DAT baru (mutasi masuk ke CGA) → harus masuk DB

### Keputusan: Delete-then-Insert (Full Replace)

Alasan:
- DAT Oracle adalah **full snapshot** — isinya seluruh DAT di CGA pada hari request
- Aset yang tidak ada di file terbaru = sudah dimutasi keluar CGA
- Upsert lama tidak bisa deteksi aset yang hilang → DB lama-lama nyampah dengan aset stale
- Full replace = DB selalu cermin kondisi gudang hari ini, tidak lebih tidak kurang

History aset yang keluar CGA **tidak disimpan di DB** — akan ditangani nanti via fitur Rekap Alokasi (target fitur masa depan).

### Implementasi
Upload DAT baru
→ DELETE semua assets_raw (assets_clean ikut terhapus via CASCADE)
→ INSERT fresh dari file (batch 500 rows)
→ Classifier jalan otomatis

Keyword rules **tidak tersentuh** — di tabel terpisah, tidak ikut cascade.

**File Diubah:**
- **UPDATED** `src/app/api/process/route.ts` — dari upsert ke delete-then-insert

### Bug Aktif
Setelah implementasi, INSERT hanya masuk **27 dari 4527 rows**. DELETE sudah benar (verified: `COUNT(*) = 0` setelah delete). Berarti masalah di sisi **client** — data yang dikirim dari frontend ke `/api/process` kemungkinan hanya 27 rows bukan 4527. File yang perlu dicek: `UploadSection.tsx` dan `batchProcessor.ts`. Belum resolved saat akhir sesi.

---

## 4. Perencanaan Fitur "Changed" di Classification

### Konsep
Filter baru di halaman Classification (sejajar dengan Semua/Unknown Jenis/Unknown Merk) untuk menampilkan aset yang **Jenis atau Merk berubah** setelah upload DAT terbaru. Filter "Keduanya" akan dihapus karena tidak berguna.

### Keputusan Desain
- Trigger: **hanya** perubahan saat upload DAT baru (bukan karena edit keyword rule)
- Aksi per aset: **ACC** (accept perubahan baru) atau **Revert** (kembalikan ke nilai lama)
- Storage: tambah kolom `prev_jenis` + `prev_merk` di `assets_clean`

### Constraint dengan Delete-then-Insert
Delete-then-insert menghapus `assets_clean` via CASCADE sebelum insert baru → nilai lama hilang sebelum bisa dibandingkan. Solusi: **backup nilai lama ke Map di memory** sebelum DELETE, compare setelah classify ulang.

### Status: BELUM DIKERJAKAN
Dikerjakan setelah delete-then-insert pipeline bug selesai di-fix.

---

## 5. Fix Minor Lainnya

### cellToNumber & Upload Ulang DAT
Setelah fix `cellToNumber` (sesi 9 Juni sore), user perlu upload ulang DAT TXT agar data `jumlah_tercatat` yang salah di DB ter-overwrite dengan nilai yang benar.

### SearchableDropdown — Tab ke Kolom Berikutnya
Setelah pilih item di dropdown (Enter atau klik), Tab key sekarang bisa pindah fokus ke kolom berikutnya di form Buat SJ. Flow: Jenis → Tab → Merk → Tab → SN → Tab → Qty → dst.

---

## Rabu, 10 Juni 2026 (Status Akhir Sesi)

### Selesai
- ✅ Bulk insert 928 master tujuan dari Excel
- ✅ Rekap Alokasi sort by No. SJ desc
- ✅ Keputusan arsitektur: full replace strategy untuk upload DAT
- ✅ Delete-then-insert implemented di `/api/process/route.ts`

### Bug Aktif
- ⚠ **Delete-then-insert: hanya 27/4527 rows masuk DB** — DELETE benar, INSERT bermasalah. Suspect di `UploadSection.tsx` / `batchProcessor.ts`. Belum resolved.

### Next Priority
1. **Fix bug delete-then-insert** (27 rows issue) — PRIORITAS
2. Fitur "Changed" di Classification (prev_jenis/prev_merk + ACC/Revert)
3. Sesi 4 SJ Manual: Monitoring alokasi (checkbox mutasi Oracle)
4. Closing snapshots architecture
5. LPP Web Tracking integration
6. Authentication & Role Management

# Kamis, 11 Juni 2026 (SJ Sesi 4: Alokasi Aset & Mutasi Oracle)

### 1. Latar Belakang & Kebutuhan

Setelah fitur Surat Jalan Manual (Sesi 1–3) selesai, sistem bisa mencatat pengiriman
aset keluar CGA secara digital. Namun tidak ada mekanisme untuk memverifikasi apakah
aset yang sudah dikirim fisik juga sudah diproses mutasi di sistem Oracle ERP perusahaan.
Gap ini menyebabkan potensi discrepancy antara data fisik (sudah dikirim) dan data
Oracle (belum dimutasi), yang berdampak pada akurasi laporan aset CGA.

Kebutuhan bisnis yang melatarbelakangi:
- User perlu tahu barang mana yang sudah dikirim tapi belum dimutasi Oracle
- Aset yang sudah dialokasikan keluar perlu ditandai di database DAT agar monitoring
  akurat (tidak dihitung sebagai aset aktif CGA)
- Dashboard perlu menampilkan warning actionable, bukan sekadar info statis

### 2. Pendekatan Teknis

**A. Penyimpanan tag "Allocated"**
Dipilih kolom `tag TEXT DEFAULT NULL` di `assets_clean` (Opsi persist di DB) dibanding
virtual/computed via JOIN. Alasan: tag harus tetap ada walau data SJ diedit atau dihapus
di masa depan, dan query monitoring tidak perlu JOIN tambahan ke `surat_jalan_items`
setiap fetch — cukup baca kolom `tag` yang sudah ada.

Trade-off: ada risiko orphan tag kalau aset di-upload ulang (DAT full replace akan
hapus assets_clean via CASCADE, otomatis reset tag). Ini diterima karena upload DAT
memang berarti data fresh — alokasi perlu diinput ulang.

**B. Save alokasi onBlur, bukan auto-save per keystroke**
Mengurangi jumlah PATCH request secara signifikan. User mengetik kode aset → blur
(pindah kolom/klik lain) → baru tersimpan. Typo bisa dikoreksi dengan reinput langsung
di kolom yang sama.

**C. Local override state (allocOverride)**
Setelah PATCH berhasil, state lokal diupdate via `allocOverride` Map tanpa refetch
seluruh data dari server. Penting untuk performa di koneksi rendah — data rekap alokasi
bisa ribuan row, refetch setiap save sangat tidak efisien.

**D. Warning count via `count: exact, head: true`**
Supabase mendukung query yang hanya mengembalikan COUNT tanpa transfer row data.
Dipakai untuk 2 warning count di dashboard stats API — jauh lebih ringan dibanding
fetch rows lalu hitung di server/client.

**E. Partial index di assets_clean**
```sql
CREATE INDEX IF NOT EXISTS idx_assets_clean_tag
ON assets_clean (tag) WHERE tag IS NOT NULL;
```
Mayoritas row `tag`-nya NULL (belum dialokasikan). Full index akan menyimpan ~4500
entry NULL yang tidak berguna. Partial index hanya mengindex baris ber-tag, hemat
storage dan lebih cepat untuk filter `WHERE tag = 'Allocated'`.

### 3. Implementasi

**Flow data alokasi (end-to-end):**
```
User input kode aset di Rekap Alokasi (onBlur)
→ AllocationCell.persist() → PATCH /api/sj/report
→ route: fetch kode lama dari DB
→ UPDATE surat_jalan_items SET kode_asset, mutasi_oracle_status, mutasi_oracle_at
→ SELECT assets_raw WHERE kode_asset = newKode (lookup raw_id)
→ UPDATE assets_clean SET tag = 'Allocated' WHERE raw_id = rawId
→ Kalau kode berubah: cek apakah kode lama masih dipakai SJ lain
  → Kalau tidak dipakai: UPDATE assets_clean SET tag = NULL (bersihkan)
→ Response: { success: true, tagged: boolean }
→ Client: setAllocOverride(itemId, next) — update lokal tanpa refetch
```

**File yang dibuat/diubah:**
| File | Jenis | Keterangan |
|------|-------|------------|
| `src/app/api/sj/report/route.ts` | Ubah | Tambah PATCH handler |
| `src/app/api/monitoring/route.ts` | Ubah | Tambah field `tag` di SELECT |
| `src/app/api/dashboard/stats/route.ts` | Ubah | Tambah warning counts |
| `src/app/sj/report/page.tsx` | Ubah | AllocationCell + 2 kolom baru |
| `src/app/monitoring/page.tsx` | Ubah | Badge "Allocated" |
| `src/app/page.tsx` | Ubah | Ganti welcome banner → DashboardWarningCards |
| `src/components/dashboard/DashboardWarningCards.tsx` | Baru | 3 warning card |
| `src/hooks/useSJReport.ts` | Ubah | Tambah `kode_asset` di SJReportItem |
| `src/hooks/useMonitoring.ts` | Ubah | Tambah `tag` di MonitoringAsset |
| `src/lib/monitoringExporter.ts` | Ubah | Kolom "Status Alokasi" di Excel |
| `src/lib/sjTypes.ts` | Ubah | Rapikan komentar field alokasi |

**SQL migration:**
```sql
ALTER TABLE assets_clean ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_clean_tag ON assets_clean (tag) WHERE tag IS NOT NULL;
```

### 4. Hasil dan Validasi

- Input kode aset di Rekap Alokasi → badge "Allocated" muncul di Monitoring DAT
  (dikonfirmasi langsung saat testing sesi ini)
- Tag tersimpan di DB (`assets_clean.tag = 'Allocated'`) — bukan state lokal
- Warning card di dashboard menampilkan count real-time dari DB
- Export Excel Monitoring: kolom "Status Alokasi" muncul di sheet "Detail DAT"
- Checkbox dan input disabled untuk barang non-AT (is_aktiva = false)
- `npx tsc --noEmit` bersih tanpa error setelah fix import path

### 5. Trade-off dan Keterbatasan

| Aspek | Kelebihan | Keterbatasan |
|-------|-----------|--------------|
| Tag persist di DB | Tidak perlu JOIN saat query monitoring | Reset saat DAT di-upload ulang (by design) |
| Save onBlur | Hemat request, UX natural | Tidak ada indikator "unsaved changes" eksplisit |
| Local override | Tidak perlu refetch ribuan row | State hilang kalau user refresh halaman |
| Warning count head:true | Sangat ringan, tidak transfer data | Tidak bisa tahu detail row mana yang bermasalah dari dashboard |
| 2-step tag query | Bersih, tidak ada subquery kompleks | 2 round-trip ke DB per save (masih ringan untuk skala ini) |

## Sesi — 10 Juni 2026 (SJ Sesi 4 Lanjutan: Lock Alokasi + Fix Stale Closure)

### Fitur: Lock Alokasi saat Mutasi Confirmed

**Latar belakang:** Setelah kode aset diinput di Rekap Alokasi, perlu ada mekanisme
yang mencegah data diubah kalau mutasi sudah benar-benar terjadi — agar konsistensi
data terjaga.

**Dua kondisi lock:**
- K1 (Lock by DAT): kode aset diinput tapi hilang dari assets_raw setelah upload DAT
  baru → lock permanen, tidak bisa dibatalkan. DAT adalah sumber kebenaran.
- K2 (Lock manual): checkbox mutasi dicentang tanpa kode aset (skenario user konfirmasi
  tanpa tahu kode) → lock tapi ada tombol "batalkan" untuk koreksi false positive.

**Tampilan locked:** teks statis + badge "✓ Dimutasi" (bukan input disabled).
Lebih ringan dan intent lebih tegas sesuai prinsip optimal.

**Guard berlapis:** UI render teks statis (tidak ada input), server tolak PATCH 409
untuk lock by DAT (cegah bypass request langsung).

### Bug Fix: Stale Closure di handleKodeBlur

**Root cause:** `handleKodeBlur` capture `mutasi` dari closure lama. User ketik kode
(mutasi auto-true) → hapus kode → blur → closure baca mutasi=true → persist
`{kode:"", mutasi:true}` → K2 lock aktif tidak sengaja.

**Fix:** Tambah `mutasiRef` yang selalu sync dengan nilai mutasi terkini. Semua handler
baca dari ref, bukan closure. Kode dikosongkan → mutasi selalu reset false.

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `src/app/api/sj/report/route.ts` | Tambah is_mutated di GET, lock guard di PATCH |
| `src/app/sj/report/page.tsx` | Render kondisional locked/unlocked, fix stale closure |
| `src/hooks/useSJReport.ts` | Tambah field is_mutated di type |

## Sesi — 11 Juni 2026 (SJ Sesi 4 Lanjutan: Mutasi WT + Berbagai Fix)

### Fitur & Fix

**1. Kolom Mutasi WT di Rekap Alokasi**
Checkbox independen per item untuk konfirmasi mutasi Web Tracking. Tidak ada relasi
dengan kode_asset atau mutasi Oracle. Behavior: belum dicentang → checkbox normal;
sudah dicentang → badge ungu "✓ WT" + tombol "batalkan" yang hanya muncul saat hover
(hover-reveal pattern). Dipisah sebagai komponen `MutasiWTCell` terpisah dari
`AllocationCell` agar tidak ada coupling antar kolom.

SQL migration:
```sql
ALTER TABLE surat_jalan_items
ADD COLUMN IF NOT EXISTS mutasi_wt_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mutasi_wt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
```

**2. Fix PATCH overwrite bug**
PATCH handler sebelumnya selalu update semua field (`kode_asset`, `mutasi_oracle_status`,
`mutasi_wt_status`) sekaligus. Akibatnya saat `MutasiWTCell` centang WT tanpa kirim
`kode_asset`, field `kode_asset` ter-overwrite jadi NULL. Fix: conditional update —
hanya update field yang ada di request body.

**3. Hover-reveal "batalkan" di Oracle & WT**
Tombol "batalkan" untuk lock manual Oracle dan WT sebelumnya selalu tampil (jelek secara
UX). Diganti dengan hover-reveal pattern: `opacity-0 group-hover:opacity-100` —
tombol hanya muncul saat user hover di cell. Clean, tidak berantakan.

**4. Rekap Pengiriman Dashboard (dari sesi sebelumnya)**
3 card baru di dashboard menggantikan placeholder:
- Card 1: Progres Mutasi Oracle (progress bar + 3 angka + terlama belum mutasi)
- Card 2: Top 5 Jenis Barang Keluar bulan berjalan (2-step query karena PostgREST
  join filter tidak reliable)
- Card 3: Trend harian item keluar bulan berjalan (bar chart recharts)

**5. Berbagai bugfix Rekap Alokasi**
- Fix stale closure `mutasiRef` di `handleKodeBlur`
- Fix lock bypass reset: izinkan reset `{kode:"", mutasi:false}` bypass K1 lock
- Fix Rules of Hooks: `useMemo` tidak boleh di dalam `.map()`
- Validasi duplikat kode aset client-side (border merah + pesan "kode sudah dipakai")
- Kolom "Baru" (is_baru) ditambah antara SN dan Qty
- Tanggal 2 baris: tanggal + nama hari (derive client-side)

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `src/app/api/sj/report/route.ts` | Fix PATCH conditional update, tambah mutasi_wt |
| `src/app/sj/report/page.tsx` | MutasiWTCell, hover-reveal, kolom Baru, tanggal+hari, duplikat validation |
| `src/hooks/useSJReport.ts` | Tambah `mutasi_wt`, `is_mutated` di type |
| `src/lib/sjTypes.ts` | Tambah `mutasi_wt_status`, `mutasi_wt_at` |
| `src/app/api/dashboard/stats/route.ts` | 3 query rekap pengiriman |
| `src/hooks/useDashboardStats.ts` | Type RekapPengiriman + turunannya |
| `src/components/dashboard/RekapPengirimanCards.tsx` | Baru — 3 card rekap pengiriman |
| `src/app/page.tsx` | Ganti RekapPengirimanPlaceholder → live |
| `src/app/api/process/route.ts` | Re-apply tag Allocated setelah upload DAT |
| `src/lib/excelExporter.ts` | Tambah kolom Kode Aset di export SJ |
| `src/lib/monitoringExporter.ts` | Tambah kolom Status Alokasi di export Monitoring |

# Senin, 15 Juni 2026 (Monitoring v2 + Daftar SJ Arsip)

### Fitur

**1. Daftar SJ — Kolom Arsip**
Checkbox `is_archived` per dokumen SJ (bukan per-item) untuk menandai fisik
kertas sudah diarsipkan. Independen, save via PATCH mode `archive_only`.
Tanggal SJ ditambah baris hari (sama pattern Rekap Alokasi).
Local override (`archiveOverride`) agar state tidak hilang saat pindah pagination.

**2. Monitoring v2 — 3 kolom baru + sortable header**
- **Invoice Number** & **Tanggal Dokumen** — parsed dari DAT TXT (kolom
  "Invoice Number" dan "Tanggal Dokumen"). Tanggal dinormalisasi ke format
  "DD-Mmm-YYYY" dengan heuristic DD vs MM (kalau salah satu bagian >12,
  itu pasti hari; kalau ambigu, default DD/MM standar Indonesia).
- **Catatan** — input bebas per kode_asset, disimpan di tabel baru
  `asset_notes (kode_asset PK, catatan, updated_at)`. Independen dari
  lifecycle DAT — auto-clear hanya saat kode_asset keluar dari CGA (re-evaluasi
  setiap upload DAT, dibandingkan dengan rawIdMap).
- **Kategori Oracle disingkat** — "C - PERALATAN KOMPUTER" → "C" (extract
  sebelum " - " pertama), hemat ruang horizontal untuk 3 kolom baru.
- **Sortable header** — klik kolom: asc → desc → kembali ke default
  (multi-sort Kategori→Jenis→Merk→CGA→Kode). Reset filter juga reset sort.
- **Filter tambahan** — Invoice Number dan Catatan ditambahkan ke filter
  multi-kolom (AND logic), filter Catatan pakai `catatanOverride` sebagai
  source of truth.

### Fix
- RLS policy `asset_notes` belum ada (tabel baru) — replikasi pola
  "Allow all on <table>" (PERMISSIVE, public, ALL, true/true) dari
  `surat_jalan_items`.
- `AssetRecord` type (di `types.ts` dan `xlsxParser.ts`) belum punya
  `invoice_number`/`tanggal_dokumen` — menyebabkan build Vercel gagal
  type-check di 2 file berbeda (`txtParser.ts`, `xlsxParser.ts`).

### Data
- Bulk import 560 baris catatan historis dari Excel ke `asset_notes`
  (filter otomatis: hanya kode_asset yang masih aktif di `assets_raw`).

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `src/app/sj/list/page.tsx` | Kolom Arsip (ArchiveCell) + tanggal+hari |
| `src/app/api/sj/route.ts` | GET tambah is_archived, PATCH mode archive_only |
| `src/hooks/useSJList.ts` | Tambah is_archived di SJListItem |
| `src/lib/txtParser.ts` | parseTanggalDokumen heuristic, mapping invoice_number/tanggal_dokumen |
| `src/lib/types.ts` | AssetRecord +invoice_number +tanggal_dokumen |
| `src/lib/xlsxParser.ts` | Default invoice_number/tanggal_dokumen (legacy parser) |
| `src/app/api/process/route.ts` | Insert field baru + auto-clear asset_notes |
| `src/app/api/monitoring/route.ts` | SELECT field baru, fetch+merge asset_notes, PATCH catatan |
| `src/hooks/useMonitoring.ts` | MonitoringAsset +invoice_number +tanggal_dokumen +catatan |
| `src/app/monitoring/page.tsx` | 3 kolom baru, kategori singkat, sortable header, filter baru |

### Branch
Dikerjakan di branch `fitur-percobaan`, sudah di-merge ke `main`.

# Selasa, 16 Juni 2026 — Fix PDF Signature, Redesign Excel Monitoring & PDF Rekap DAT

### Fix
- **Label & warna signature SJ** — label "Dibawa"/"Diterima" dikonfirmasi
  sudah benar di kode (sempat dikira salah karena versi lama). Warna font
  label signature (Dibuat/Disetujui/Dibawa/Diterima) diubah dari abu-abu
  muted jadi hitam pekat (`#0a0a0a`) + bold — alasan: rawan tertimbun tinta
  stempel/bolpen di kertas fisik. File: `SuratJalanPDF.tsx`.

### Redesign — Excel Export Monitoring (Sheet "Summary")
Diubah total dari flat list (grouping jenis × toko) jadi **3 tabel
side-by-side per CGA** (CGA1 kolom B-G, gap, CGA2 kolom I-N, gap, CGA3
kolom P-U). Masing-masing di-group Kategori Oracle → Jenis dengan kolom
Kategori/Jenis/Item/Qty/Perolehan/Tercatat, ada subtotal per kategori dan
Grand Total per CGA. Kategori tampil lengkap ("C - Peralatan Komputer")
hanya di baris pertama grup. Sheet "Detail DAT" tidak disentuh sama sekali.

Catatan teknis penting: SheetJS community edition (`xlsx` npm package)
TIDAK mendukung cell styling (fill warna, border warna, bold) saat menulis
file — itu eksklusif SheetJS Pro. Keputusan diambil: tetap pakai `xlsx`
tanpa warna (struktur/grouping/merge cell tetap jalan, visual polos).
Sempat ada bug subtotal/grand total label tampil sebagai cell kosong —
root cause: kode baca `row.jenis` (kosong) padahal label disimpan di
`row.kategori`, fixed.

File: `monitoringExporter.ts`.

### Redesign — Export PDF Rekap DAT
- Trigger dipindah dari halaman `/reports` (dihapus) ke tombol baru
  "Export PDF" di halaman Monitoring (sebelah kiri tombol "Export Excel")
- Menu "Reports" dihapus dari Sidebar
- **Page-break per CGA** — setiap CGA render di `<Page>` `@react-pdf/renderer`
  tersendiri (sebelumnya semua CGA digabung jadi 1 halaman panjang)
- **Styling warna per CGA** — header & total toko solid sesuai badge UI
  (CGA1=emerald, CGA2=amber, CGA3=rose), kategori header & subtotal pakai
  versi pudar, row alternate sangat pudar
- API `dat-summary/route.ts` tidak diubah (sudah summary-only by design)

File: `DATSummaryDocument.tsx`, `Sidebar.tsx`, `monitoring/page.tsx`.
Branch: dikerjakan & di-commit mandiri oleh user.

---

# Rabu, 17 Juni 2026 — Fix Kritis asset_notes, Fix Pagination PDF SJ, Fitur Template Item

### Fix Kritis — Auto-clear `asset_notes` menghapus SEMUA catatan
**Laporan bug:** setelah reupload DAT terbaru, seluruh catatan di tabel
Monitoring hilang dan `asset_notes` di DB jadi kosong total.

**Root cause:** `UploadSection.tsx` mengirim `POST /api/process` **per
batch** (500 rows/batch via `batchProcessor.ts`, konfirmasi: 10 batch untuk
4563 row dari Network tab). Step auto-clear `asset_notes` & re-apply tag
"Allocated" di `api/process/route.ts` berjalan **di setiap batch**,
membandingkan terhadap `rawIdMap` yang cuma berisi kode_asset dari batch
itu sendiri (~456 row), bukan keseluruhan upload. Batch pertama datang →
hampir semua `asset_notes` salah dianggap "stale" (aset sudah keluar CGA)
→ terhapus. Berulang tiap batch sampai semua catatan habis.

**Fix:**
- `batchProcessor.ts` — kirim `batchIndex`, `totalBatches`, `isLastBatch`
  di payload setiap request batch
- `api/process/route.ts` — step re-apply tag Allocated & auto-clear
  `asset_notes` **hanya jalan saat `isLastBatch === true`**, dan di titik
  itu query ulang **seluruh** `assets_raw.kode_asset` dari DB (bukan
  `rawIdMap` parsial) — perbandingan "stale" jadi akurat karena semua
  batch sebelumnya sudah commit ke DB
- Bonus: re-apply tag Allocated jadi lebih efisien (1x di akhir dengan
  data lengkap, bukan 10x dengan data parsial yang sebagian besar sia-sia)

**Verifikasi:** user re-import 560 catatan historis (SQL `import-catatan.sql`
lama), lalu reupload DAT — catatan tetap ada, fix dikonfirmasi berhasil.

**Data loss:** semua `asset_notes` (560 bulk import + catatan manual)
terhapus akibat bug ini sebelum fix diterapkan. Bulk import sudah direstore
manual oleh user; catatan manual yang ditambah setelah bulk import dan
sebelum bug terjadi tidak bisa direstore.

### Fix — PDF Surat Jalan Pagination
**Laporan bug:** SJ dengan 23 item, hasil PDF rusak — header & info
pengiriman muncul sendirian di halaman 1, seluruh tabel (23 baris) pindah
ke halaman 2.

**Root cause:** react-pdf gagal melakukan page-break otomatis di tengah
tabel besar — alih-alih memecah tabel di titik yang tepat, seluruh block
tabel "all-or-nothing" dipindah ke halaman berikutnya kalau tidak cukup
ruang di halaman saat ini.

**Fix:** manual pagination — items di-chunk maksimal **15 item per
halaman** (`ITEMS_PER_PAGE = 15`). Tiap chunk di-render sebagai `<Page>`
tersendiri dengan header surat lengkap (logo, No SJ, Tanggal, Kepada Yth,
intro text) dan header tabel diulang di setiap halaman. Total Item/Qty dan
signature (Dibuat/Disetujui/Dibawa/Diterima) hanya dirender di **halaman
terakhir**. Kalau total item ≤15, tetap 1 halaman seperti sebelumnya.

File: `SuratJalanPDF.tsx`.

### Fitur Baru — Template Item Surat Jalan
User bisa menyimpan kombinasi item yang sering berulang (contoh: template
"SDN" isi CPU Zyrex + Printer Thermal Epson + Gun Scanner Honeywell) dan
menerapkannya saat membuat/edit SJ. Item template ditambahkan ke bawah
item yang sudah diisi user (baris kosong di-skip), urutan auto-renumber.

**Skema DB:** single table + JSONB (bukan relasional) — `sj_item_templates
(id, nama UNIQUE, items jsonb, created_at)`. Alasan: template selalu
dipakai utuh, tidak pernah query item individual, jadi 1 baris = 1 query
tanpa join, sesuai prinsip arsitektur (DB ringan, minimize join).
`serial_number` TIDAK disimpan di template (unik per unit fisik),
dikosongkan saat template diterapkan untuk diisi manual. Template bersifat
**shared** — semua user lihat & pakai sama, sesuai konfirmasi user.

**Implementasi:**
- `sjTypes.ts` — tipe `SJTemplateItem`, `SJItemTemplate`, helper
  `toTemplateItem`/`fromTemplateItem`
- `api/sj/templates/route.ts` — GET (list)/POST (create)/DELETE (by id)
- `useSJMaster.ts` — hook baru `useSJTemplates` (pola sama `useMasterTujuan`)
- `sj/templates/page.tsx` — halaman baru kelola template: buat (reuse
  `SJItemsTable` untuk editor item, SN diabaikan saat simpan) + hapus,
  daftar template tampil sebagai cards dengan preview item
- `Sidebar.tsx` — menu baru "Template Item" di dropdown "Surat Jalan Manual"
- `sj/buat/page.tsx` — komponen `TemplatePicker` (dropdown ungu) di header
  "Detail Barang", handler `handleApplyTemplate` (filter baris kosong →
  append item template → renumber urutan)

**Pending (next session):** posisi tombol "Pakai Template" dipindah ke
sebelahan tombol "Tambah Baris" (saat ini di header section, bukan di
footer tabel bersama "Tambah Baris").

### Lain-lain
- Fix environment: error `Cannot find native binding` (`@tailwindcss/oxide`)
  di Codespace baru — resolved via `rm -rf node_modules package-lock.json
  && npm install`. Bug npm dependency, tidak terkait kode SmartWMS.

# Kamis, 18 Juni 2026 — LPP Web Tracking Reconciliation (Tahap 1-3) — THESIS CORE

Mulai implementasi fitur inti skripsi: bandingkan data DAT Oracle dengan
LPP Web Tracking untuk mendeteksi selisih administrasi mutasi aset antar
cost center (CGA1/CGA2/CGA3).

### Konfirmasi scope sebelum eksekusi
- Upload 3 file LPP (.xls per CGA) sekaligus dalam 1 dropzone, CGA
  auto-detect dari nama file (bukan 3 dropzone terpisah)
- Kondisi 3 "Aset Intransit" ditunda — belum ada file "Report Intransit",
  fokus dulu ke kondisi 1, 2, 4, 5 yang bisa dihitung dari DAT+LPP saja
- Strategi upload LPP: full replace (delete-then-insert), sama seperti DAT
- Hasil reconciliation ditampilkan di 2 tempat: tab "LPP Monitoring" (raw
  data) dan halaman baru `/reconciliation` (hasil 4 kondisi)
- Integrasi auto-lock Mutasi WT dari LPP — **ditunda**, dikerjakan di sesi
  terpisah nanti setelah reconciliation core stabil

### Analisis file sample LPP
User upload `LPP_CGA1.xls` — ternyata file ini **HTML table** dengan
ekstensi `.xls` (bukan Excel biner), pola umum sistem reporting web lama.
Strategi parsing jadi lebih simpel dari DAT: cukup `DOMParser`, tidak perlu
SheetJS. Validasi terhadap file asli (via jsdom): 2690/2690 baris terparse
sempurna, 0 skip, tidak ada duplikat `No Aktiva`, kolom `Saldo Awal` selalu
0 dan `Keluar` selalu 0 (representasi snapshot aset yang ADA saat ini di
CGA tersebut — cukup cek presence by kode_asset untuk reconciliation).

### Tahap 1 — Schema, Parser, Upload Pipeline
- `lpp_raw` table: `kode_asset`, `toko` (CGA1/2/3, bersih), `deskripsi`,
  `saldo_awal`/`masuk`/`keluar`/`saldo_akhir`, `uploaded_at` + index
- `lppParser.ts` — parse HTML-table-as-.xls, `detectCGAFromFilename()`
  (regex `CGA[123]` case-insensitive), validasi duplikat CGA antar file
- `lppBatchProcessor.ts` — mirror `batchProcessor.ts` (DAT), termasuk
  pola `batchIndex`/`totalBatches`/`isLastBatch` (pelajaran dari fix
  kritis asset_notes 17 Juni — mencegah kelas bug yang sama)
- API `/api/lpp/clear` (DELETE semua) + `/api/lpp/process` (batch insert)
- UI `UploadLPPSection.tsx` — drag 3 file sekaligus, preview badge CGA per
  file sebelum proses, progress bar, di halaman Upload Data (ganti card
  "Upload LPP Update" yang sebelumnya "Coming Soon")

User test: 3 file (CGA1/2/3) berhasil diupload, **4690 records** masuk
ke `lpp_raw` di Supabase.

### Tahap 2 — LPP Monitoring Tab
- API `GET /api/lpp/monitoring` — fetch semua `lpp_raw` (pagination loop,
  sama pola dengan `dat-summary`)
- Hook `useLPPMonitoring` (di `useMonitoring.ts`)
- Tab "LPP Monitoring" di halaman Monitoring (sebelumnya empty state)
  sekarang fungsional: filter Cost Center (ALL/CGA1/CGA2/CGA3), search
  kode_asset/deskripsi, tabel (No, Kode Aset, Deskripsi, CGA badge, Saldo
  Awal, Masuk, Saldo Akhir), pagination — state terpisah dari tab DAT

User feedback: awalnya minta 4 summary card juga (Total Kode Aset, Total
Saldo Awal, Total Masuk, Total Saldo Akhir) mengikuti pattern tab DAT —
ditambahkan, mengikuti filter yang aktif.

### Tahap 3 — Reconciliation Engine
**Logic 4 kondisi** (kondisi 3 "Aset Intransit" belum aktif):

| # | DAT | LPP | Status | Aksi |
|---|---|---|---|---|
| 1 | Ya | Ya | Fisik di CGA | Normal |
| 2 | Ya | Tidak | Belum Mutasi Oracle | Warning — mutasi Oracle |
| 4 | Tidak | Ya | Belum Mutasi WT | Warning — buat SJ WT |
| 5 | Tidak | Tidak | Fisik Allocated | Normal, sudah keluar CGA |

Universe pembanding untuk kondisi 5 dibatasi ke kode_asset yang PERNAH
tercatat di sistem (union `assets_raw` ∪ `lpp_raw` ∪
`surat_jalan_items.kode_asset`) — bukan literal seluruh kode aset yang
mungkin ada (tidak terbatas kalau diambil mentah). Logic diverifikasi
dengan dummy data sebelum implementasi (4 skenario kode_asset, hasil
sesuai matrix).

- API `GET /api/reconciliation` — fetch `assets_raw` + `lpp_raw` +
  `surat_jalan_items` secara paralel, build Map per sumber, hitung
  kondisi per kode_asset di universe, return summary count + items array
- Hook `useReconciliation`
- Halaman baru `/reconciliation` — 4 summary card (klik untuk filter),
  filter Cost Center + search, tabel hasil dengan badge kondisi
- Menu baru "Reconciliation" di Sidebar (antara Monitoring dan
  Classification)

### Bug ditemukan & fixed — Badge CGA tampil teks panjang
**Laporan bug** (dari screenshot): kolom "CGA" di tabel reconciliation
menampilkan teks panjang "CGA1 – Cadangan General Affairs 1" yang wrap
jadi 3 baris, bukan badge bersih "CGA1".

**Root cause:** `assets_raw.toko` (DAT) menyimpan label lengkap dari
Oracle, BUKAN kode singkat — beda dengan `lpp_raw.toko` yang sudah bersih
("CGA1"/"CGA2"/"CGA3", diekstrak dari nama file saat upload). Pattern ini
sebenarnya sudah pernah ditangani di tempat lain (`monitoringExporter.ts`
punya helper `extractCGACode()`), tapi belum diterapkan di
`reconciliation-route.ts` — toko DAT mentah langsung di-assign ke field
`toko` untuk kondisi 1 & 2, lolos ke `CGA_BADGE` lookup di client (yang
cuma punya key "CGA1"/"CGA2"/"CGA3"), tidak match, fallback nampilin
string mentah.

**Fix:** tambah helper `extractCGACode()` (regex `CGA\d`) di
`reconciliation-route.ts`, diterapkan saat build `datMap` — semua
downstream (kondisi 1 & 2) otomatis pakai kode singkat, konsisten dengan
LPP.

### Git workflow — branch terpisah
User mengerjakan ini di GitHub Codespace, khawatir kehilangan progress
kalau session berakhir sebelum sempat commit. Solusi: buat branch baru
`feature/reconciliation`, commit dengan message sementara ("commit
sementara : proses reconciliation belum selesai..."), push ke remote.
**Belum di-merge ke `main`.**

**Rencana lanjutan** (dikonfirmasi dengan user):
1. Apply fix badge CGA di branch `feature/reconciliation`
2. Amend commit message jadi proper (pakai `git commit --amend`)
3. Force-push dengan `--force-with-lease` (lebih aman dari `--force` polos)
4. Test ulang halaman `/reconciliation`
5. Merge ke `main` (`--ff-only` karena cuma 1 commit di branch)
6. Hapus branch `feature/reconciliation` setelah merge sukses

### Pending untuk sesi berikutnya
- Eksekusi langkah git di atas (amend, force-push, merge ke main)
- Integrasi Mutasi WT otomatis dari LPP (auto-lock checkbox di Rekap Alokasi)
- Kondisi 3 "Aset Intransit" — tunggu file Report Intransit
- Aktivasi Dashboard Baris 2 (DAT vs LPP per CGA), bisa reuse summary count
- Konfirmasi: kondisi 2 (SJ WT dibuat tapi belum BTB) — actionable warning
  atau informational saja (BTB kewenangan toko tujuan)
- Export Excel/PDF untuk hasil reconciliation (belum ada)

## 18 Juni 2026 (lanjutan) — Fix Kritis: Pagination Row-Limit di Auto-clear asset_notes

### Laporan bug
User update beberapa catatan di tabel Monitoring (10 catatan di 10
kode_asset berbeda, hasil pencarian "DVR"), refresh — masih ada (jadi
sudah masuk DB). Reupload DAT — setelah itu cuma 2 dari 10 catatan yang
selamat. Dikonfirmasi kode_asset terkait masih muncul normal di Monitoring
DAT (jadi bukan auto-clear yang benar/legit — asetnya tidak keluar CGA).

### Investigasi
File DAT yang diupload: 4666 baris, 10 batch. Fix kritis 17 Juni (skip
auto-clear kecuali `isLastBatch`, query ulang `assets_raw` saat batch
terakhir) sudah benar diterapkan — dikonfirmasi masih ada di kode saat
file diupload untuk dicek. Jadi ini BUKAN regresi dari fix 17 Juni,
melainkan bug baru yang sebelumnya tidak ketauan.

### Root cause
Step 7 (auto-clear `asset_notes`) di `api/process/route.ts`:
```js
const { data: allRawKodes } = await supabase
  .from('assets_raw')
  .select('kode_asset')
```
Query ini **tidak pakai `.range()` / pagination**. Supabase PostgREST
punya limit default **1000 baris per query** — query tanpa pagination
diam-diam truncate ke 1000 baris pertama TANPA error. Dengan DAT 4666
baris, query ini cuma dapat ~1000 kode_asset (urutan dari Postgres, bukan
urutan tertentu yang predictable), bukan semua 4666. Akibatnya 3666
kode_asset valid lainnya salah dianggap "tidak ada di DAT" — kalau ada
catatan di kode_asset yang kebetulan jatuh di luar 1000 yang ke-fetch,
catatan itu ikut dihapus sebagai "stale".

Simulasi node mengkonfirmasi: query lama dapat 1000/4666 baris (3666
hilang dari pembanding), query dengan pagination loop dapat semua
4666/4666 dalam 5 iterasi (`FETCH_SIZE=1000`).

Step 6 (re-apply tag "Allocated") punya celah serupa secara prinsip —
`.in('kode_asset', allocatedKodes)` bisa kena limit yang sama kalau hasil
match-nya >1000 baris (belum terjadi karena jumlah aset teralokasi masih
di bawah situ, tapi berpotensi seiring data bertambah).

### Fix
- Tambah helper `fetchAllKodeAsset()` — pagination loop (`.range()`,
  `FETCH_SIZE=1000`, sama pola dengan `dat-summary` & `lpp/monitoring`
  yang sudah benar dari awal) — dipakai di step auto-clear `asset_notes`
- Step re-apply tag Allocated: query `.in()` di-chunk per 200 kode_asset
  (bukan 1 query besar) — hasil match per chunk otomatis jauh di bawah
  limit 1000, jadi tidak ada kemungkinan ke-truncate sama sekali
- Update komentar kode supaya jelas KENAPA pagination wajib di sini

File: `api/process/route.ts`.

### Rule baru ditambahkan ke project_context.md
**WAJIB pagination loop untuk query tabel apapun yang potensial >1000
baris.** Ini bukan cuma soal `assets_raw` — berlaku untuk tabel besar
manapun di masa depan. Ditambahkan ke Coding Standards sebagai reminder
permanen, supaya kelas bug ini tidak terulang lagi di kode baru.

### Data loss
8 dari 10 catatan yang hilang sudah terhapus dari DB sebelum fix
diterapkan — tidak ada cara recover otomatis. User perlu input ulang
manual kalau masih ingat isinya.

### Verifikasi
User konfirmasi fix bekerja — test dengan catatan tersebar di halaman
awal/tengah/akhir Monitoring (PAGE_SIZE=30, ±156 halaman untuk 4666 aset),
reupload DAT, semua catatan utuh.

## 18 Juni 2026 (lanjutan) — Aktivasi Dashboard Baris 2 + Deep-link Reconciliation

### Konteks
User menunjukkan screenshot Dashboard, Baris 2 (Rekonsiliasi DAT vs LPP)
masih placeholder "Coming Soon". Karena reconciliation engine sudah ada
(Tahap 3, lihat entry sebelumnya), tinggal diaktivasi pakai data yang sama.

### Penemuan tooling penting: akses repo langsung via git clone
Sebelum mulai, user tanya cara biar Claude bisa baca struktur repo
terupdate tanpa upload manual tiap kali. Dicoba `git clone` ke repo user
(`github.com/iyunn/smart-warehouse-management-system`) — **berhasil**,
karena repo ternyata **public** (dikonfirmasi via GitHub API:
`private: false`). User skeptis ("gimana aku tau kamu clone repo ku?"),
dibuktikan dengan menampilkan `git remote -v` + `git log` — commit
message-nya match persis dengan kerjaan yang sudah didiskusikan
sepanjang sesi (fix pagination, LPP reconciliation, dst), jadi praktis
mustahil itu repo yang salah.

**Implikasi workflow ke depan**: Claude bisa `git clone` repo langsung
(read-only) untuk baca file terbaru tanpa minta upload manual. User tetap
yang jalankan `git add/commit/push` manual (rule lama tidak berubah).
Disimpan ke memory permanen biar sesi berikutnya tidak perlu re-discover.

**Catatan keamanan**: user diberi tahu repo-nya public — kalau ada secret/
API key yang ke-commit, perlu dicek & di-rotate.

### Implementasi Dashboard Baris 2
- Baca `src/app/page.tsx`, `src/hooks/useReconciliation.ts`,
  `src/components/dashboard/CGASummaryCards.tsx` langsung dari clone
  (tidak ada upload manual sama sekali untuk tahap ini)
- Komponen baru `DATvsLPPCards.tsx` — self-contained, panggil
  `useReconciliation()` sendiri (reuse, tidak ada API baru). Breakdown per
  CGA dihitung client-side dari `items`: filter `toko === code`, lalu
  hitung Total DAT (kondisi 1+2), Total LPP (kondisi 1+4)
- `page.tsx` — ganti `<DATvsLPPPlaceholder />` jadi `<DATvsLPPCards />`
- `PlaceholderCards.tsx` — hapus export `DATvsLPPPlaceholder` (dead code)

### Bug konseptual ditemukan oleh user — desain ulang "Selisih"
Versi pertama nampilin 1 angka "Selisih" = `Total DAT - Total LPP`.
User tanya: "2.675 - 2.690 = 15, kok beda sama yang ditampilkan (371)?"

**Root cause bukan bug kode, tapi salah desain konseptual.** Breakdown
sebenarnya:
- Total DAT = Kondisi 1 + Kondisi 2
- Total LPP = Kondisi 1 + Kondisi 4
- "Selisih" yang ditampilkan = Kondisi 2 + Kondisi 4 (gabungan dua
  masalah berbeda), BUKAN `Total DAT - Total LPP` (yang secara matematis
  = Kondisi 2 - Kondisi 4, bisa saling meniadakan kalau kedua angka besar
  dan berdekatan)

Contoh kasus asli (CGA1): Kondisi 2 ≈ 178 (Belum Mutasi Oracle), Kondisi 4
≈ 193 (Belum Mutasi WT). Subtraksi: 178-193 = -15 (kelihatan kecil/tidak
masalah). Penjumlahan (yang benar): 178+193 = 371 aset yang SEBENARNYA
butuh tindakan. Subtraksi naive menyembunyikan ~356 aset bermasalah karena
dua masalah berbeda itu kebetulan saling mendekati secara jumlah.

**Fix**: card di-redesign — tampilkan **4 angka terpisah** (Total DAT,
Total LPP, Belum Mutasi Oracle, Belum Mutasi WT), tidak pernah digabung
jadi 1 angka "selisih" lagi. Ini prinsip desain yang harus diingat untuk
fitur reconciliation manapun ke depan: kondisi yang berlawanan arah JANGAN
dikurangi, harus ditampilkan terpisah atau dijumlah (kalau memang representasi
"total butuh tindakan" yang diinginkan).

### Fitur tambahan — Deep-link Dashboard → Reconciliation
User minta: angka selisih (sekarang 2 angka: Belum Mutasi Oracle/WT) bisa
diklik, langsung ke data detailnya.

**Implementasi:**
- `DATvsLPPCards.tsx` — angka jadi `<Link href="/reconciliation?kondisi=2&cga=CGA1">` (atau `kondisi=4` untuk WT)
- `reconciliation/page.tsx` — tambah `useSearchParams`, baca `kondisi` &
  `cga` dari URL di `useEffect` (sekali saat mount), pre-apply ke state
  filter (`activeKondisi`, `cga`) yang sudah ada
- Karena `useSearchParams` butuh `Suspense` boundary di Next.js App
  Router, komponen utama di-rename `ReconciliationPageContent`, dibungkus
  `<Suspense>` di default export `ReconciliationPage` — pattern yang sama
  dipakai di `sj/buat/page.tsx` (sudah established sebelumnya)

User tanya apakah ini konflik dengan mekanisme existing — dikonfirmasi
tidak, karena pattern Suspense+useSearchParams sudah established
sebelumnya, dan filter state tetap `useState` biasa (cuma diinisialisasi
dari URL sekali di awal, behavior manual filter tidak berubah).

### Update dokumentasi & memory
- `project_context.md`: Dashboard Baris 2 dipindah dari "Known Issues
  placeholder" ke "Completed", lesson learned soal Selisih didokumentasikan
  lengkap (penting supaya tidak terulang di fitur reconciliation lain),
  drill-down limitation diupdate (partial resolved — Dashboard→Reconciliation
  ada, Reconciliation→aksi belum)
- Memory permanen: tambah catatan repo public + cara akses via git clone

### Pending untuk sesi berikutnya (prioritas dikonfirmasi user)
1. **3 gap teknis Reconciliation** (freshness indicator, cross-CGA
   mismatch, aging/durasi tracking) — explicit confirmed sebagai next
2. Integrasi Mutasi WT otomatis (ditunda sejak awal)
3. Kondisi 3 Aset Intransit (butuh file)
4. Drill-down dari tabel Reconciliation ke aksi langsung (Buat SJ WT)

## 18 Juni 2026 (lanjutan) — Freshness Indicator DAT & LPP pindah ke Sidebar

### Konteks
User meminta freshness indicator (kapan DAT & LPP terakhir diupload) dipindah
ke Sidebar supaya terlihat di semua halaman tanpa harus buka halaman Reconciliation.
Sekaligus menghapus DataStatusCards dari Dashboard karena info sudah ada di Sidebar.

### Proses
Sempat diimplementasi sebagai FreshnessBanner di halaman Reconciliation (3 file:
`reconciliation-route.ts` + `useReconciliation.ts` + `reconciliation-page.tsx`)
dalam sesi sebelumnya. User sudah apply ke lokal tapi belum push ke remote.
Keputusan: pindah ke Sidebar supaya lebih persistent. 3 file reconciliation
di-revert ke versi sebelum FreshnessBanner, digantikan pendekatan Sidebar.

### Implementasi
- API baru `/api/freshness` — 2 query ringan (MAX uploaded_at dari `assets_raw`
  dan `lpp_raw`), pakai `.maybeSingle()` bukan `.single()` agar tidak throw
  error kalau tabel kosong (pelajaran dari bug `.single()` sebelumnya)
- `Sidebar.tsx` — hook `useFreshness()` inline, fetch `/api/freshness` sekali
  saat mount. Widget "DAT Update" + "LPP Update" di atas user profile block,
  hanya muncul saat sidebar tidak collapsed. Format: `18 Jun 2026 10:30`
- `src/app/page.tsx` (Dashboard) — hapus import `DataStatusCards` dan blok
  JSX "Baris 1: Status Data" — info sudah ada di Sidebar, jadi redundant

### Catatan teknis
- File reconciliation (route, hook, page) di-revert ke versi remote yang bersih
  (tanpa FreshnessBanner) karena user sudah apply lokal tapi belum push
- `.maybeSingle()` vs `.single()` — penting: `.single()` throw error kalau
  0 baris, `.maybeSingle()` return null dengan aman. Gunakan `.maybeSingle()`
  untuk query yang mungkin return 0 baris (tabel baru/kosong)


# 19 Juni 2026 — Cross-CGA Mismatch (Kondisi 6) + Skip Aging Tracking

### Fitur: Cross-CGA Mismatch Detection (Kondisi 6)

Engine reconciliation sebelumnya hanya cek presence (ada/tidak ada
by kode_asset), tidak cek konsistensi CGA. Aset yang ada di DAT CGA1
tapi di LPP tercatat CGA2 dianggap Kondisi 1 "normal" — padahal itu
selisih administrasi yang perlu investigasi.

**Fix:** Kondisi 1 dipecah jadi 2 kasus:
- CGA sama di DAT dan LPP → tetap Kondisi 1 (normal)
- CGA BEDA → Kondisi 6 "Mismatch CGA" (warning, badge ungu)

**Perubahan teknis:**
- `reconciliation-route.ts` — cek `dat.toko === lpp.toko` saat keduanya ada.
  Field baru `tokoLPP: string | null` di ReconItem, hanya diisi untuk K6.
  Summary tambah `kondisi6: 0`
- `useReconciliation.ts` — update `ReconciliationItem` (tambah `tokoLPP?`,
  `kondisi: 1|2|4|5|6`) dan `ReconciliationSummary` (tambah `kondisi6`)
- `reconciliation-page.tsx` — tambah Kondisi 6 ke KONDISI_CONFIG (label
  "Mismatch CGA", warna ungu), grid summary card jadi `md:grid-cols-5`,
  kolom CGA di tabel untuk K6 tampilkan `[CGA1] → [CGA2]` (DAT → LPP
  via dua badge warna masing-masing + arrow), URL param deep-link support
  `kondisi=6`

Logic diverifikasi via node simulasi — A2 dengan DAT:CGA1/LPP:CGA2
terdeteksi K6 dengan `tokoLPP:"CGA2"`, semua kondisi lain tidak terpengaruh.

### Keputusan: Skip Aging/Durasi Tracking

Gap teknis terakhir (aging = catat sejak kapan aset stuck di K2/K4)
diputuskan **tidak perlu diimplementasi** setelah diskusi:
- Tim pengguna kecil (1-2 admin GA) yang tau konteks sendiri
- Upload DAT & LPP tidak terjadwal rutin (ad-hoc), jadi angka aging
  misleading dan tidak actionable
- Yang penting untuk admin GA: ada/tidaknya selisih, bukan berapa hari
- Untuk laporan TA: bisa disebutkan sebagai "future enhancement" tanpa
  diimplementasi — tidak mempengaruhi kelengkapan core feature

### Known Limitations Reconciliation — Status Final
- ✅ Freshness indicator → di Sidebar
- ✅ Cross-CGA mismatch → Kondisi 6
- ~~Aging/durasi tracking~~ → SKIP (keputusan final)
- ⏳ Drill-down tabel → aksi langsung (belum dikerjakan)

### Catatan Workflow
Ditemukan bahwa Codespace URL 404 sering terjadi karena port forwarding
timeout (bukan error kode). Solusi: klik kanan port 3000 di tab "Ports"
VS Code → "Open in Browser". Memory dan `chat-rule.md` diupdate untuk
catat bahwa Fillian SELALU bekerja di Codespace (bukan mesin lokal),
sehingga perubahan yang di-apply di Codespace tidak terlihat Claude
sampai di-push ke remote.

# 19 Juni 2026 (lanjutan) — Import SJ WT dari PDF + Storage Analysis + chat-rule.md

### Fitur: Import Surat Jalan Web Tracking dari PDF

User meminta fitur agar PDF SJ WT bisa di-upload → SmartWMS otomatis buat
SJ record + isi kode_asset di Rekap Alokasi (WT tidak punya fitur autorecap).

**Tantangan parsing PDF:**
pdfjs-dist mengekstrak teks per "text run" PDF. Setiap kolom tabel dan label
field menjadi item terpisah. "1 Baik" tersplit jadi "1" dan "Baik". Header
tabel tersplit per kolom (bukan 1 baris utuh). Debugging dilakukan dengan
console.log raw text di browser untuk lihat struktur asli.

**Solusi parser (dual-mode):**
- `fullText` (join spasi) untuk header regex — Tujuan, Tanggal, Pembawa, No SJ
- `lines` (join newline) untuk deteksi kode_asset — TIDAK pakai header tabel,
  langsung cari kode_asset pertama (`/^[A-Z]\d{2}\.\d+$/`) sebagai anchor
- Kondisi: cari baris `/^\d{1,2}$/` (angka saja), bukan "1 Baik" satu baris

**pdfjs-dist version saga:**
- v6 (latest): gagal dengan `Promise.withResolvers` dan `Promise.try` (ES2024,
  belum ada di Codespace Node.js)
- v3.11.174: error `canvas` module karena Next.js SSR coba bundle Node.js code
- Fix canvas: `dynamic({ ssr: false })` di upload page — cukup, tidak perlu
  webpack externals (yang malah konflik dengan Turbopack Next.js 16)
- Worker: copy ke `public/pdf.worker.min.js` (CDN tidak reliable di Codespace)

**Files:**
- `src/lib/wtSJParser.ts` — parser dengan dual-mode
- `src/app/api/sj/import-wt/route.ts` — lookup/auto-create tujuan, generate
  No SJ SmartWMS, insert surat_jalan + items (kode_asset + mutasi_wt_status=true)
- `src/components/UploadWTSJSection.tsx` — drag PDF → preview modal → submit
- `src/app/upload/page.tsx` — section baru "Surat Jalan Web Tracking"
- `public/pdf.worker.min.js` — worker file pdfjs-dist

**Pending:** card "Import SJ WT Bulk" (Coming Soon) perlu dipindah ke bawah
supaya card Import SJ WT bisa full-width (keterangan overflow card saat ini).

### Supabase Storage Analysis

Dilakukan karena user khawatir soal limit 500MB Supabase free plan.
Total saat ini: ~4MB (0.8%). Tabel full-replace tidak bertumbuh. Tabel
akumulasi (sj*, asset_notes, keyword_rules) tumbuh ~117KB/bulan.
Risiko nyata: pause proyek setelah 7 hari tidak aktif — lebih kritis untuk
demo TA daripada storage limit. Future re-struktur: fokus ke surat_jalan*
kalau data sudah ribuan (archiving/soft-delete strategy).
Disimpan ke memory Claude dan didokumentasikan di Known Issues.

### docs/chat-rule.md

File baru ditambahkan ke repo: panduan cara kerja antara Fillian & Claude/AI
lain, berisi: session startup protocol (baca project_context.md dulu), cara
baca repo via curl (hemat token vs git clone), Codespace workflow notes (bukan
mesin lokal, port timeout bukan code error), Supabase row-limit reminder, dan
checklist sebelum present file ke user.

# 20 Juni 2026 — Export Excel Reconciliation + Fitur Barang Masuk/Penerimaan Barang

### Export Excel Hasil Reconciliation

Melengkapi fitur reconciliation yang sudah ada — satu-satunya yang kurang
adalah output file untuk dibawa ke luar sistem (laporan ke atasan, dll).

**Implementasi:**
- `src/lib/reconciliationExporter.ts` (new) — 3 sheet:
  - Ringkasan: count + persentase per kondisi, breakdown Total DAT/LPP/Selisih
    per CGA dari SEMUA data (tidak dipengaruhi filter aktif di layar)
  - Detail: item sesuai filter aktif di layar (kondisi + CGA yang dipilih),
    termasuk info filter di header sheet
  - Perlu Tindakan: khusus Kondisi 2/4/6 dari seluruh data + kolom "Aksi
    Diperlukan" yang eksplisit per kondisi
- `src/app/reconciliation/page.tsx` — tambah tombol "Export Excel" (emerald)
  di kanan atas, `handleExport` useCallback diletakkan SETELAH `filtered` dan
  `paginated` declaration (bug awal: diletakkan sebelum — `filtered used before
  declaration` error TypeScript)

---

### Fitur Barang Masuk / Penerimaan Barang

Mekanisme baru untuk mencatat barang yang kembali dari toko ke CGA (return/
tarikan). Menghasilkan dokumen "Surat Penerimaan Barang".

**Keputusan desain:**
- Extend `surat_jalan` (bukan tabel baru) karena ditampilkan dalam 1 tabel
  rekap alokasi yang sama
- Kolom `jenis` ('keluar'|'masuk', DEFAULT 'keluar') — backward compatible
  100%, semua SJ existing otomatis jadi 'keluar' tanpa update data
- Barang gaib (tidak diketahui kode_asset): kode_asset dikosongkan, keterangan
  diisi manual — tidak butuh flag khusus
- Nomor dokumen: tetap format `SJ-Manual/CGA/...` (beda di jenis field)

**Tahap 1 — Fondasi:**
- SQL migration: `ALTER TABLE surat_jalan ADD COLUMN jenis TEXT NOT NULL
  DEFAULT 'keluar' CHECK (jenis IN ('keluar', 'masuk'))`
- `sjTypes.ts`: tambah `JenisSJ` type + field `jenis` ke `SuratJalan`,
  tambah `kode_asset?` ke `SJItemForPDF` (dibutuhkan `SuratPenerimaanPDF`)
- `useSJList.ts`: tambah `jenis` ke `SJListItem`
- `api/sj/route.ts`: handle `jenis` di POST/PATCH/GET (select `jenis` di list)

**Tahap 2 — Form Penerimaan:**
- `src/app/sj/masuk/page.tsx`: form mirip `/sj/buat` tapi semantik berbeda —
  "Asal Toko" (bukan Tujuan), "Pengirim" (bukan Pembawa), penerima auto
  "Admin GA", tidak ada mode Draft, POST dengan `jenis: 'masuk'`. Aksen
  warna emerald (beda dari SJ keluar yang cyan)
- `Sidebar.tsx`: tambah menu "Penerimaan Barang" di group "Surat Jalan Manual"

**Tahap 3 — PDF + UI:**
- `SuratPenerimaanPDF.tsx`: PDF portrait (bukan landscape seperti SJ keluar),
  aksen emerald, kolom Kode Aset di tabel, tanda tangan pengirim = nama yang
  diinput (bukan placeholder)
- `sjPdfHelpers.ts`: semua fungsi (generate/download/print) terima parameter
  `jenis` opsional, auto-pilih PDF yang tepat. Backward compatible — default
  'keluar'
- `SJPreviewModal.tsx`: prop `jenis` opsional (default 'keluar'), diteruskan
  ke helpers
- `sj/list/page.tsx`: badge `↑ Keluar` (cyan) / `↓ Masuk` (emerald) di
  kolom baru, header "Tujuan / Asal"
- `hooks/useSJReport.ts`: tambah `jenis_sj: 'keluar'|'masuk'`
- `api/sj/report/route.ts`: select `jenis` dari surat_jalan, return sebagai
  `jenis_sj`
- `sj/report/page.tsx` (Rekap Alokasi): no_sj emerald kalau masuk, cyan
  kalau keluar
- `excelExporter.ts`: kolom baru "Masuk/Keluar" setelah No. SJ di export Excel

**Revisi setelah test:**
1. PDF portrait (bukan landscape)
2. Nama pengirim di tanda tangan = `data.pembawa` (nama yang diinput)
3. Teks: "Barang di atas telah diterima oleh pihak kami" (bukan "kondisi baik
   oleh pihak CGA/GA")
4. Warna no_sj hijau di Rekap Alokasi untuk jenis masuk
5. Kolom Masuk/Keluar di Excel export Rekap Alokasi

**Bug fix selama development:**
- `SuratPenerimaanPDF.tsx`: error `Property 'kode_asset' does not exist on
  type 'SJItemForPDF'` — fix dengan menambah `kode_asset?: string` ke
  `SJItemForPDF` di `SuratJalanPDF.tsx` (proper typed, bukan cast `as any`)

# 25 Juni 2026 — DAT Closing Snapshot + Dashboard Trend CGA

### Fitur: DAT Closing Snapshot Bulanan

Upload DAT closing per bulan → simpan hanya agregasi per CGA ke DB.
4666 baris raw data → 3 rows di DB (1 per CGA per bulan). Sangat ringan.

**Keputusan desain:**
- Tabel baru `dat_closing` terpisah dari `assets_raw` (bukan di-reuse)
  karena data closing adalah snapshot historis, bukan current state
- UNIQUE(bulan, cga) → upload ulang bulan yang sama = timpa (upsert)
- Hanya 4 metric: total_items, total_qty, total_nilai, total_tercatat
  (sama persis dengan yang ditampilkan di Monitoring — akurat)
- Raw data di-discard setelah kalkulasi client-side → DB tetap ringan

**Bug fix:** `parseTxtFile` menerima `File` bukan string, dan return
`Promise<ParseResult>` bukan synchronous — perlu `await` dan destructure
dari result, bukan langsung dari return value.

### Fitur: Dashboard Baris 3 — Trend CGA

Line chart 3 garis (CGA1 emerald, CGA2 amber, CGA3 rose) dari data
dat_closing. Toggle 4 metric tanpa reload. Export Excel 1 sheet semua
metric sekaligus (12 kolom: 3 CGA × 4 metric).

### Upload Page Revisi

- UploadClosingSection replace placeholder "DAT Closing" yang sudah ada
  di grid DAT section (bukan tambah section baru)
- LPP Closing placeholder dihapus (tidak akan diimplementasi)
- Style fix: semua upload card (`UploadLPPSection`, `UploadWTSJSection`,
  `UploadClosingSection`) disamakan ke `bg-[#111827]` agar lebih visible
  di atas background halaman `bg-[#080e18]`

### Diskusi arsitektur LAN offline

User bertanya soal kemungkinan self-hosted LAN di kantor PT. Indomarco.
Kesimpulan: perubahan terbesar adalah Supabase → PostgreSQL lokal (ratusan
query perlu dimigasi). Frontend tidak berubah. Untuk saat ini tetap pakai
Supabase (lebih dari cukup untuk skala SmartWMS). LAN implementation bisa
jadi "rencana implementasi" di Bab 5 laporan TA.

### Diskusi fitur Live Stock / Budget Stok

User mengusulkan fitur perbandingan aktual aset vs budget/target per jenis
per CGA dengan flag over/under. Formula budget belum fix (CGA1: toko baru/
upgrade/peremajaan; CGA2: toko tutup + 5% total cabang; CGA3: belum ada).
Keputusan: masuk sebagai planned feature, budget diinput manual user dulu,
formula dinamis ditambahkan setelah formula dikonfirmasi ke stakeholder GA.

### Diskusi dark/light mode

User tanya kemungkinan fitur dark/light toggle. Kesimpulan: perubahan
besar-besaran karena semua styling hardcoded dark mode. Solusi efisien:
Tailwind `dark:` variant + CSS variables. Ditunda sampai fitur core selesai
— dimasukkan ke "saran pengembangan lanjutan".

# 27 Juni 2026 — Sistem Autentikasi Supabase Auth + CRUD User

### Scope & Keputusan Desain

- Provider: Supabase Auth (email+password) — sudah terintegrasi dengan project
- Role: Super Admin + Admin (Viewer dihapus dari scope — tidak perlu untuk internal tool GA)
- Registration: terbuka tapi status default `pending` — Super Admin yang approve
- Forgot password: magic link via Supabase (lebih aman dari kirim password random)
- `@supabase/ssr` untuk SSR-safe session management di Next.js App Router

### Tahap 1 — Fondasi

**SQL migration:**
- Tabel `profiles` (extend auth.users): username, nik, email, role, status
- Trigger `handle_new_user` — auto-create profile saat register
- RLS policy `authenticated_read_own` — user hanya bisa baca profile sendiri

**Supabase helpers:**
- `src/lib/supabase-client/client.ts` — browser client (createBrowserClient)
- `src/lib/supabase-client/server.ts` — server client (createServerClient)
- `src/lib/supabase-client/middleware.ts` — session refresh helper

**Catatan penting:**
- Folder dinamai `supabase-client/` bukan `supabase/` karena Turbopack
  error: "reading file src/lib/supabase — Is a directory (os error 21)".
  Turbopack conflict saat memproses globals.css dengan folder bernama sama
  dengan package name.
- Next.js 16.2.4 rename konvensi `middleware.ts` → `proxy.ts`, dan nama
  fungsi export dari `middleware` → `proxy`.

**Halaman /login:**
- Form email + password
- Cek status profile setelah login — tolak kalau pending/rejected
- Redirect ke dashboard kalau active

### Tahap 2 — Register, Session, Forgot Password

- `/register` — form username/NIK/email/password, status pending, success screen
- `/forgot-password` — kirim magic link via `resetPasswordForEmail`
- `/auth/callback/route.ts` — exchange code untuk session, redirect ke
  reset-password kalau type=recovery
- `/auth/reset-password` — set password baru via `updateUser`
- `SessionContext.tsx` — provider expose user, profile, role, signOut,
  isSuperAdmin, isAdmin ke seluruh app
- `layout.tsx` — wrap dengan SessionProvider
- `Topbar.tsx` — nama + role dinamis dari useSession, klik avatar untuk logout

**Bug ditemui:**
- "Profil tidak ditemukan" setelah login — RLS memblokir query profiles.
  Root cause: session belum ter-set di cookies saat query langsung setelah
  signInWithPassword. Fix: disable RLS untuk testing, lalu buat policy
  `authenticated_read_own` dengan `TO authenticated` yang benar.
- RLS policy rekursif (`super_admin_read_all` yang query profiles dari dalam
  profiles trigger) menyebabkan infinite loop → semua login gagal.
  Fix: DROP policy rekursif, Super Admin operasi via service_role di API route.

**Email rate limit Supabase free tier:**
- Limit ~3 email/jam — terlalu ketat untuk onboarding teman-teman di hari Senin
- Solusi: fitur "Tambah User" oleh Super Admin yang bypass email sama sekali

### Tahap 3 — Role Enforcement + Admin Panel

**Halaman /admin/users:**
- Lihat semua user + status, approve/reject/nonaktifkan/aktifkan
- Naik/turun role (admin ↔ super_admin)
- Tambah User — modal form, langsung active via `auth.admin.createUser` +
  `email_confirm: true` (bypass email confirmation dan rate limit)
- Hapus User — konfirmasi modal, permanent delete via `auth.admin.deleteUser`
  (profiles ikut cascade karena ON DELETE CASCADE)

**API /api/admin/users:**
- Semua operasi via `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS)
- `verifySuperAdmin()` — cek session dari cookie sebelum setiap operasi
- `SUPABASE_SERVICE_ROLE_KEY` perlu diset di Codespace secrets DAN Vercel
  environment variables (dua tempat terpisah)

**Role enforcement:**
- Tombol hapus SJ di Daftar Surat Jalan — hidden untuk non-Super Admin
- Halaman /admin/users — auto-redirect ke / kalau bukan Super Admin
- Menu "Manajemen User" di Sidebar — hanya tampil untuk Super Admin

**Sidebar:**
- Tambah menu Manajemen User (violet, hanya Super Admin)
- Tombol logout di pojok bawah (ikon door-exit)

---

## 19 Juli 2026 — Staging Area (DAT Masuk dari Luar CGA)

### Konteks & Tujuan

Ada kasus di mana DAT dari luar CGA fisiknya dikembalikan ke CGA (via Penerimaan
Barang / SJ jenis 'masuk'). User ingin menambahkan catatan pada DAT tersebut, tapi
kalau DAT terbaru belum di-reupload, item itu belum muncul di Monitoring — jadi
catatan tidak bisa langsung ditambahkan.

Solusi: staging area menampung DAT masuk sampai DAT terbaru di-upload. Kalau
kode_asset staging muncul di DAT baru (lokasi CGA), catatan otomatis pindah ke
Monitoring (asset_notes) dan item dihapus dari staging.

### Keputusan Desain (dari tanya-jawab dengan Fillian)

- DAT masuk staging: otomatis dari fitur Penerimaan Barang (SJ masuk). Ada
  kode_asset → normal. Tidak ada → "AT Lebih" (aktiva tidak beridentitas)
- Match untuk trigger pindah catatan: kode_asset + harus di CGA (toko CGA1/2/3)
- Kapan pindah: keduanya — auto saat upload DAT + tombol manual
- Tampil: tab baru di Monitoring (samping DAT/LPP)

### Tahap 1 — Fondasi

- SQL: tabel `staging_area` (id, kode_asset nullable, jenis, merk, deskripsi,
  catatan, asal_toko, is_at_lebih, sj_id FK→surat_jalan ON DELETE SET NULL,
  tanggal_masuk). RLS allow_all.
- `src/app/api/staging/route.ts` — GET (list), PATCH (edit catatan), DELETE
  (hapus manual), POST action=sync. Sync pakai pagination BATCH 200 untuk cek
  keberadaan kode_asset di assets_raw + validasi toko CGA via extractCGA().
  Catatan: kolom di assets_raw = `kode_asset` (bukan no_seri).
- `src/hooks/useStaging.ts` — hook fetch, return {items, loading, refresh}
- `src/app/api/sj/route.ts` — auto-insert ke staging saat jenis='masuk'.
  asal_toko diambil dari sj_tujuan (kode + nama). is_at_lebih = !kode_asset.
  Best-effort: kalau insert staging gagal, SJ tetap tersimpan (tidak rollback).
- `src/components/sj/SJItemsTableMasuk.tsx` — varian SJItemsTable untuk
  Penerimaan Barang, dengan kolom Kode Aset (badge "AT Lebih" amber kalau kosong)
  dan checkbox AT (is_aktiva). Kolom lengkap: No, Kode Aset, Jenis, Merk,
  Serial Number, Qty, Satuan, Baru, AT, Keterangan, Aksi.
- `src/app/sj/masuk/page.tsx` — ganti SJItemsTable → SJItemsTableMasuk

**Bug tampilan:** grid awalnya pakai Tailwind arbitrary class
`grid-cols-[36px_minmax(140px,1fr)_...]` → kolom stack vertikal (berantakan).
Root cause: Tailwind v4 JIT tidak generate arbitrary class untuk komponen baru.
Fix: pakai inline style `gridTemplateColumns` yang tidak bergantung Tailwind.

### Tahap 2 — Tab Staging di Monitoring

- `src/components/StagingTab.tsx` — tab baru:
  - Tabel: No, Kode Aset (badge AT Lebih), Jenis, Merk, Asal Toko, Catatan, Aksi
  - CatatanCell auto-save on blur via PATCH /api/staging
  - Tombol "Sinkronkan Sekarang" (POST action=sync) + pesan hasil
  - Tombol hapus per row (DELETE)
  - Info panel: total, count Normal vs AT Lebih
- `src/app/monitoring/page.tsx` — integrasi tab. activeTab jadi
  "dat"|"lpp"|"staging". Ternary lpp/dat dibungkus `activeTab !== "staging"`
  agar tidak render DAT block saat staging aktif.

Keputusan: StagingTab dipisah jadi komponen sendiri (bukan inline di monitoring)
supaya monitoring page tidak membengkak.

### Tahap 3 — Auto-sync saat Upload DAT

- `src/app/api/process/route.ts` — di blok isLastBatch (setelah cleanup
  asset_notes, DAT terbaru sudah lengkap):
  - Helper `extractCGA()` — ekstrak kode CGA dari toko
  - Helper `fetchKodeAssetCGASet()` — ambil semua kode_asset lokasi CGA
    (pagination loop, tidak modif fetchAllKodeAsset yang dipakai cleanup notes)
  - Helper `syncStagingToNotes()` — pindahkan catatan staging→asset_notes untuk
    item yang kode_asset-nya di CGA set, lalu hapus dari staging
  - Dipanggil best-effort (try/catch) — kalau gagal, upload DAT tetap sukses

Logika sync diverifikasi via simulasi node: item CGA→sync, item non-CGA→skip,
item tidak ada di DAT→skip, AT Lebih→difilter di query.

**Known issue (ditunda):** kode_asset yang diinput di Penerimaan Barang belum
tampil di PDF Surat Penerimaan Barang. Kemungkinan SuratPenerimaanPDF atau
sjPdfHelpers tidak pass kode_asset ke data.items.

---

## 19 Juli 2026 (lanjutan) — Perbaikan Konflik Logika & Review Mutasi

Sesi lanjutan setelah Staging Area di-merge ke main. Fokus: beberapa masalah kecil
dan konflik logika yang muncul saat pemakaian.

### #2 — Staging: edit catatan tidak lagi refresh seluruh list

Root cause: tiap CatatanCell blur memanggil `refresh()` yang re-fetch seluruh list
staging → re-render penuh (terasa seperti "halaman refresh"). Kalau isi banyak item
berturut-turut, tiap blur trigger re-fetch = menyebalkan.

Fix: tambah `updateItemLocal` di useStaging — update satu item di state lokal tanpa
network call. Catatan sudah tersimpan via PATCH, tidak perlu re-fetch. Refresh penuh
hanya untuk sync & delete (yang mengubah struktur list).

### AT Lebih bisa diisi kode_asset

Gap: item AT Lebih (tanpa kode_asset) tidak pernah ikut sync (query filter
`.not(kode_asset, is, null)`), nyangkut selamanya. Fix: API PATCH /api/staging
sekarang bisa update kode_asset (auto-matikan is_at_lebih). UI: tombol "+" di badge
AT Lebih → input inline → isi kode → badge berubah jadi kode hijau, siap ikut sync.

### #4 — Hapus auto-checklist mutasi Oracle

Root cause: di handleKodeBlur, `nextMutasi = trimmed ? (isAktiva ? true : false)`
— begitu kode_asset diisi pada item aktiva, mutasi Oracle auto-checklist. Padahal
ada case user sudah input kode tapi belum bisa mutasi Oracle (kendala teknis).

Fix: `nextMutasi = trimmed ? currentMutasi : false` — status mutasi dipertahankan,
tidak dipaksa true. User kontrol checkbox manual. Kalau kode dikosongkan, mutasi
reset false (logis — tidak ada kode = tidak mungkin mutasi).

### #5 — Filter Review Mutasi di Rekap Alokasi

Interface untuk review cepat item yang belum dimutasi. 4 chip filter: Semua,
Belum Oracle, Belum WT, Belum Keduanya. Bekerja bersama filter existing (periode,
search). Resolve nilai mutasi dengan allocOverride agar akurat tanpa refetch.
Hanya item is_aktiva yang masuk review (non-AT tidak perlu mutasi).

### #3 — Auto-isi kode_asset dari Penerimaan + logika mutasi masuk terbalik

Root cause utama: kode_asset yang diinput di Penerimaan Barang TIDAK ikut disimpan
ke surat_jalan_items (hanya masuk staging_area). Akibatnya kode tidak muncul di
Rekap Alokasi maupun PDF.

Fix bertahap:
1. sj-route POST & PATCH: tambah kode_asset ke itemsToInsert
2. PDF: mapping items ke pdfData men-drop kode_asset di DUA tempat berbeda —
   sj/list (preview dari daftar) DAN sj/masuk (preview setelah submit). Keduanya
   diperbaiki. Tipe SJItemForPDF & komponen PDF sudah siap render kode_asset.

**Logika mutasi masuk (TERBALIK dari keluar):**
- Barang keluar (TIDAK diubah): kode HILANG dari DAT → "✓ Dimutasi" (barang keluar CGA)
- Barang masuk (reversed K1): kode ADA di DAT → "✓ Dimutasi" (barang kembali ke CGA
  setelah user mutasi oracle & re-upload DAT terbaru)

computeIsMutated di /api/sj/report sekarang sadar jenis SJ. Lock guard PATCH juga
reversed untuk masuk (tolak edit kalau kode sudah ada di DAT). Diverifikasi via
simulasi node — kedua arah benar, barang keluar tidak berubah perilaku.

Alur lengkap barang masuk: penerimaan + input kode → item editable (kode belum di
DAT lama) → user mutasi oracle + re-upload DAT → kode muncul di DAT → lock "✓ Dimutasi".

### Staging: item terhapus saat SJ induknya dihapus

Root cause: staging_area.sj_id pakai ON DELETE SET NULL — saat SJ dihapus,
surat_jalan_items CASCADE tapi item staging cuma di-set sj_id NULL → nyangkut.

Fix: DELETE /api/sj hapus item staging (WHERE sj_id = id) SEBELUM hapus SJ (setelah
SJ dihapus, link sj_id hilang). Item staging yang sudah ke-sync tidak terpengaruh
(sudah tidak ada di tabel) — catatan di Monitoring tetap aman, memang itu tujuannya.

---

## 20 Juli 2026 — Fix Tag Allocated (Transaksi Terakhir) + Perbaikan Dashboard

### Tag Allocated: konflik keluar/masuk

Skenario tabrakan: Barang A keluar dari CGA1 (20 Juli, tag Allocated) → balik ke
CGA2 via penerimaan (29 Juli, tag hilang) → keluar lagi dari CGA2 (2 Agustus,
Allocated lagi).

Root cause: step 6 process route (re-apply Allocated saat upload DAT) ambil SEMUA
kode_asset dari surat_jalan_items tanpa lihat jenis. Kode A muncul 3x (keluar-
masuk-keluar) → selalu ke-tag Allocated, meski fisiknya sudah balik ke CGA.

Fix: query join ke surat_jalan ambil tanggal + jenis. Reduce ke transaksi TERAKHIR
per kode_asset (by tanggal, tie-breaker created_at). Tag Allocated HANYA kalau
transaksi terakhir = 'keluar'. Kalau terakhir 'masuk', tidak di-tag (barang balik).
Diverifikasi via simulasi node: A (terakhir keluar) → Allocated, C (terakhir masuk)
→ tidak di-tag.

### Dashboard — 5 perbaikan + 1 lanjutan

**#1 Hapus card "Belum Input Kode Aset"** dari DashboardWarningCards (grid jadi 2 kolom).

**#2 Hapus card "Perbandingan Closing vs Update"** (ClosingVsUpdatePlaceholder) dari
page.tsx + import-nya.

**#3 Progres Mutasi Oracle mentok 1.000** — root cause: query .limit(50000) dengan
join !inner tetap kena truncate senyap 1000 dari PostgREST. Fix: helper
fetchAllATItems() dengan pagination range loop. Sekalian filter benar: hanya SJ
keluar submitted/completed (SJ masuk & draft tidak masuk progres mutasi keluar —
dikonfirmasi Fillian: hitung yang keluar saja).

**#4 Chart Pengiriman Harian 0 semua** — root cause: bug alignment Promise.all yang
AKU buat sendiri saat fix #3. Waktu hapus atItemsResult dari Promise.all, urutan
query vs destructuring jadi ketukar: assetsCleanJenisResult (Card 2) dapat query
Card 3 (id,tanggal), dan sjBulanResult (Card 3) dapat query Card 2 (id saja, tanpa
tanggal) → sjTanggalMap kosong → dailyMap tidak keisi → semua 0. Fix: tukar urutan
2 query surat_jalan di Promise.all agar match destructuring. Plus pagination item
per SJ. Pelajaran: kalau hapus item dari Promise.all, cek ulang alignment.

**#5 Timestamp DAT tidak sinkron LPP** — root cause: LPP set uploaded_at
new Date().toISOString() eksplisit saat insert, DAT andalkan default DB now() yang
beda per batch. Fix di process route: DAT set uploadedAt eksplisit satu timestamp
untuk semua batch (samakan mekanisme dengan LPP).

**Ringkasan Aset per Gudang tidak akurat** (lanjutan) — 3 root cause: (1) .limit(10000)
tanpa pagination, (2) extract CGA pakai toko.split(' - ')[0] yang fragile (gagal
untuk en-dash/lowercase/CGA-di-tengah) vs monitoring pakai regex match(/CGA\d/i),
(3) sumber assets_raw polos vs monitoring assets_clean join assets_raw!inner. Fix:
helper fetchBreakdownPerCGA() dengan pagination + extractCGACode regex + sumber
assets_clean join assets_raw (SAMA dengan monitoring). Query lama di Promise.all
diganti Promise.resolve({data:null}) placeholder agar posisi destructuring tetap.
Diverifikasi via simulasi: regex benar untuk semua format toko.

Catatan: process-route.ts sudah termasuk fix tag Allocated + uploaded_at eksplisit.
Rencana ke depan (disebut Fillian): pertimbangkan menghilangkan mekanisme
draft/submitted pada Surat Jalan karena sepertinya tidak kepakai — perlu petakan
dampak dulu (halaman buat SJ, filter status, query dashboard submitted/completed).

---

## 21 Juli 2026 — Live Stock + Fondasi Theme System (branch `stock`)

Fitur dikembangkan di branch terpisah `stock` (checkpoint bertahap) sampai stabil,
baru merge ke main. Budget ditunda menunggu Excel dari Fillian.

### Keputusan arsitektur (dikonfirmasi Fillian)
- Live Stock: untuk SEKARANG di dalam auth; publik (tanpa login) menyusul.
- Sumber data: assets_clean join assets_raw!inner (SAMA dengan Monitoring).
- Theme: preferensi disimpan di profiles DB (ikut akun), bukan localStorage saja.
- Stock = akumulasi CGA1 + CGA2 saja. CGA3 dikecualikan (barang akan dimusnahkan).

### Tahap 1 — Fondasi Theme
- Migration kolom theme di profiles (dark/light, default dark).
- ThemeContext: sumber kebenaran DB profile, cache localStorage untuk anti-flash.
  Apply class dark/light ke <html>. Script inline di layout <head> untuk apply
  tema dari cache sebelum React mount (hindari FOUC).
- ThemeToggle: switch ala website konvensional (track + knob + ikon matahari/bulan).
- globals.css: CSS variable tema (--bg, --surface, --text, --accent, --cga1/2/3)
  di-scope ke .dark/.light. Dipakai halaman Stock; bisa diperluas ke seluruh app.
- SessionContext: expose theme dari profile.
- Keputusan: toggle dipasang di dalam halaman Stock dulu (bukan sidebar global),
  karena app existing masih dark-only (warna hardcoded). Kalau toggle global
  dipasang sekarang, halaman lain rusak saat light. Light mode penuh = fitur terpisah.

### Tahap 2 — Menu Sidebar
- Menu "Stock" (icon bar chart) dengan submenu Live Stock & Budget. Pola submenu
  sama dengan "Surat Jalan Manual" yang sudah ada.

### Tahap 3 — Live Stock
- API GET /api/stock/live: pagination range loop, hitung per jenis (CGA1+CGA2,
  CGA3 skip via extractCGA regex). Return total, cga1, cga2, kategori, merkBreakdown
  (urut desc). Verified via simulasi node (cpu 10: Zyrex 5, Wearnes 3, Gear 2).
- Halaman /stock/live:
  - Tabel kiri di-GROUP per kategori (kategori_oracle), kategori & jenis urut A-Z.
    flatOrder untuk auto-cycle mengikuti urutan grouped. Verified via simulasi.
  - Panel kanan: hero (angka besar + pie dengan persen di tengah donut), stat cards
    CGA1/CGA2/Total, List Merk full-height dengan bar proporsi per merk.
  - Revisi dari feedback: layout awal terlalu kosong → dirombak jadi padat.
- Mode idle/screensaver:
  - Auto-cycle antar jenis tiap 6 detik (toggle Auto/Manual), auto-refresh data 60s.
  - Fullscreen (Fullscreen API): sembunyikan Sidebar/Topbar, jam live + tanggal +
    DAT update (ala papan bandara), progress bar auto-cycle (0→100% per 6s, verified),
    auto-scroll ke item aktif. Sync state saat keluar via ESC.
  - Klik manual di tabel kiri → pilih jenis + pause auto-cycle.

### Tahap 4 — Budget (PENDING)
- Menunggu Excel budget dari Fillian (mekanisme/standar over/under). Halaman belum dibuat.

### Catatan
- migration_theme.sql harus dijalankan di Supabase sebelum test.
- Semua file di-syntax-check via esbuild + logika diverifikasi via simulasi node.

---

## 21 Juli 2026 (lanjutan) — Prodsus/Non-Prodsus, Redesign UI, Top 10 + MERGE ke main

Lanjutan fitur Live Stock di branch `stock`, lalu di-MERGE ke main (fast-forward).
Live Stock kini live di production. Budget masih ditunda (menunggu Excel).

### Mekanisme Prodsus / Non-Prodsus (kolom "Sub Coce" / kolom D DAT)
Kebutuhan: Live Stock menampilkan pembagian tiap jenis jadi NON-PRODSUS dan PRODSUS
berdasarkan kolom "Sub Coce" di DAT.txt Oracle.
- Keputusan Fillian: sub_coce '0' (atau semua nol) = non-prodsus; selain itu = prodsus
  (produk khusus, mis. FRDCHICKEN, SAYB, PCAFE, YCGOLD). Simpan dua-duanya: nilai
  asli sub_coce + flag is_prodsus.
- List Prodsus = breakdown per nilai sub_coce (prodsus saja). Prodsus/non-prodsus
  dihitung PER JENIS TERPILIH (ikut cycle/klik).

Perubahan data layer:
- migration_sub_coce.sql: kolom sub_coce (TEXT default '0') + is_prodsus (BOOLEAN)
  + index idx_assets_raw_is_prodsus di assets_raw.
- types.ts: AssetRecord tambah sub_coce + is_prodsus.
- txtParser.ts: mapping header "Sub Coce" → sub_coce (nama header persis dari DAT
  Fillian: Cabang, Kelompok Status, Toko, Sub Coce, Kategori, No. Seri, ...).
  Derive is_prodsus.
- process/route.ts: raw object insert tambah sub_coce + is_prodsus.

[CRITICAL FIX] Non-prodsus di DAT Fillian ternyata nilainya "00000000" (8 nol),
BUKAN "0". Cek awal `sub_coce !== '0'` salah menganggap "00000000" sebagai prodsus,
akibatnya semua item lari ke PRODSUS. Fix di 3 tempat (parser, process route, API):
pakai regex `/^0*$/` — semua-nol atau kosong = non-prodsus. Verified via simulasi
node (0, 00000000, 000, "" → non-prodsus; FRDCHICKEN dll → prodsus).

API /api/stock/live:
- Per jenis tambah: nonProdsus (+CGA1/CGA2), prodsus (+CGA1/CGA2), prodsusBreakdown
  (per nilai sub_coce, urut desc). Select tambah sub_coce + is_prodsus.
- Verified via simulasi: Chest Freezer 500 (290) = 200 non-prodsus + 90 prodsus,
  List Prodsus FRDCHICKEN 50 / SAYB 30 / PCAFE 10.

### Redesign UI Live Stock (padat, sesuai mockup Fillian)
Beberapa iterasi dari feedback screenshot Fillian:
- Info bar besar (jam + tanggal UPPERCASE + "DAT update: ...") SELALU tampil (dulu
  cuma saat fullscreen — makanya di screenshot fullscreen headernya kecil).
- Angka Total Stock diperbesar (clamp s/d 12rem), pie 300px dengan persen di tengah.
- "LIVE STOCK" jadi label di ATAS pie (dulu absolute → menumpuk pie; fix jadi in-flow).
- Bawah: dua blok besar NON-PRODSUS & PRODSUS (komponen ProdsusBlock, angka besar +
  card CGA1/CGA2 masing-masing) + LIST PRODSUS (bar proporsi per sub_coce prodsus).
- Kolom kanan dibagi 2: List Merk (atas) + Top 10 Stock (bawah). Top 10 = 10 jenis
  total terbanyak, clickable (lompat ke jenis + pause), highlight jenis terpilih.
  Verified sort desc via simulasi.

### Fix-fix
- [FIX] Tombol play/pause kebalik: autoCycle jalan → PauseIcon (klik untuk pause),
  berhenti → PlayIcon. (Sebelumnya terbalik.)
- [FIX] Pie tidak muncul di awal (cuma angka), baru muncul setelah klik jenis.
  Root cause: ResponsiveContainer butuh ukur parent saat mount; parent belum stabil.
  Fix: ganti dengan PieChart ukuran fixed 300×300 + isAnimationActive=false → render
  sejak awal tanpa perlu klik.
- [FIX] Layout shift (konten "naik/kepotong" saat load, normal setelah refresh).
  Root cause: grid pakai height calc(100vh - Npx) dengan angka tebakan tinggi header;
  header info bar tingginya berubah saat font/data belum load. Fix: main jadi flex
  flex-col, grid pakai flex-1 min-h-0 (isi sisa otomatis, tanpa calc).

### Housekeeping
- File backup lama (bckp*/bckup*) ikut kehapus dari main saat merge (sudah di-git rm
  di branch stock sebelumnya). Disarankan .gitignore pola backup ke depan.
- [FIX build] xlsxParser.ts membuat objek AssetRecord tapi belum punya sub_coce +
  is_prodsus → type error saat deploy Vercel. Fix: tambah dua field + derive
  is_prodsus (konsisten txtParser). batchProcessor.ts aman (hanya pakai tipe param).

### Status
- MERGE ke main SUKSES (fast-forward), deploy Vercel hijau. Live Stock live.
- WAJIB sebelum tampil di TV: jalankan migration_theme.sql + migration_sub_coce.sql
  di Supabase PRODUCTION, lalu re-upload DAT (biar sub_coce/is_prodsus keisi).

---

## 22 Juli 2026 — Dashboard Redesign + Rapikan Sidebar/Topbar + Fondasi Light Mode

### Dashboard redesign (lebih padat, kurangi space kosong)
Iterasi dari feedback Fillian (mockup):
- Perlu Tindakan: dari 2 card memanjang jadi 2 card berdampingan, SEMUA warna
  biru/cyan (bukan kuning+ungu), tiap card ada ikon (database/globe) + angka besar.
- Ringkasan per Gudang: dari 3 card bertumpuk jadi 1 panel list inline (CGA1/2/3
  sebagai baris: kode+label+detail Qty/Perolehan/Tercatat inline, angka barang besar
  di kanan) + tombol "Lihat detail gudang" → /monitoring.
- Layout: Trend CGA 2/3 + Ringkasan per Gudang 1/3 berdampingan; Perlu Tindakan 1/3
  + Rekonsiliasi DAT vs LPP 2/3. Semua pakai items-stretch biar tinggi seragam
  (tidak pincang).
- Fix: header "Rekonsiliasi DAT vs LPP" sempat dobel (komponen DATvsLPPCards sudah
  punya header sendiri) — dihapus dari page.
- Tahap 2 (KPI angka besar + Analitik Prodsus) sempat dibuat lalu DIBATALKAN atas
  permintaan Fillian (tidak suka). API fetchProdsusStats + komponen KPI di-revert.

### Rapikan Sidebar & Topbar
- Sidebar: hapus menu Settings (dummy href #) + kategori SYSTEM. Semua menu jadi
  satu di MAIN MENU. Surat Jalan Manual & Manajemen User pindah ke MAIN MENU
  (Manajemen User pakai flag adminOnly, tetap khusus Super Admin).
- Fix active state: route /stock/* sebelumnya jatuh ke default "dashboard" (getActiveId
  tidak ada handling /stock). Ditambah deteksi /stock/live → stock-live.
- Topbar: hapus search bar + icon notif (belum berfungsi). Sisakan nama user + role
  + logout (ikon logout diperjelas).
- Dropdown "Stock" DIHAPUS → "Live Stock" jadi item tunggal di MAIN MENU (Budget
  dibatalkan).
- User info sidebar bawah → diganti tombol Logout merah estetik (border/bg/teks rose).

### Fondasi Light Mode
- Toggle theme dinaikkan ke Topbar global (kiri user info), pakai ThemeToggle collapsed.
- Pendekatan konversi: CSS override otomatis di scope `.light` (globals.css) yang
  membalik warna hardcoded (bg gelap → terang, text-white/* → slate gelap,
  bg-white/[0.0x] → gelap-transparan, border-white/* → gelap-transparan, hover states).
  Warna aksen (cyan/emerald/amber/rose/violet) tidak diubah. body background ikut token.
- Alasan pendekatan ini: menghindari edit puluhan halaman satu-satu; ~90% warna umum
  langsung ke-handle. Sisa: tuning per halaman untuk warna spesifik (gradient/hex unik).

### Live Stock — perbaikan responsif TV (sesi sebelumnya, tercatat di sini)
- Angka besar pakai vmin (bukan vw) biar skala ikut tinggi layar → tidak kepotong di
  720p. Font list clamp(13px,1vw,16px) → lebih kebaca di 1080p. Margin vertikal +
  padding responsif (vmin/vh). Header & legend flex-wrap.
- Fix active sidebar Live Stock (nyangkut ke Dashboard).
- Pie: ResizeObserver ukur kontainer → pieSize responsif (radius proporsional).

### Housekeeping
- File backup (bckp*) sempat ke-push ke branch stock lalu ke-git-rm. Disarankan
  .gitignore pola backup.

### Catatan
- Budget DIBATALKAN (out of scope TA).
- Fitur direncanakan berikutnya: Pendingan Alokasi (list barang pending per Tujuan,
  sort by Wilayah, checklist kirim, shortcut Buat SJ pre-filled). Perlu kolom wilayah
  di sj_tujuan.

---

## 23 Juli 2026 — Fix PDF Surat Jalan, Perbaikan Buat SJ/Rekap, Fitur Pendingan Alokasi

### Fix output PDF Surat Jalan (hilangkan batas 15 item)
Masalah: dulu dipasang `ITEMS_PER_PAGE = 15` (manual pagination — split item per
chunk 15, tiap chunk satu `<Page>`) karena page-break otomatis di tengah tabel besar
sempat nge-bug (halaman 1 cuma header, tabel pindah ke halaman berikutnya).
Akibatnya: halaman dengan tepat 15 item bawahnya kosong & jelek, dan tanda tangan
selalu di chunk terakhir walau ruang masih banyak.

Solusi — natural flow @react-pdf:
- Manual chunk DIHAPUS (`chunkItems` + `ITEMS_PER_PAGE` dibuang). Satu `<Page>` berisi
  SEMUA item; @react-pdf memecah otomatis kalau tabel kepenuhan.
- Header tabel (`TableHeaderRow`) pakai `fixed` → berulang tiap halaman saat tabel pecah.
- `DocumentHeader` (logo/judul/tujuan) TIDAK fixed → hanya di halaman pertama
  (ini yang dulu bikin bug "halaman 1 header doang").
- Tiap `TableRow` + total row + signature section pakai `wrap={false}` → tidak
  kepotong di batas halaman; blok TTD utuh mengikuti item terakhir.
Hasil: item ≤15 → TTD padat di bawah tabel; item >15 → tabel mengalir, TTD ikut di
halaman terakhir (bukan halaman kosong terpisah).

### Perbaikan halaman Buat SJ & Rekap Alokasi
- **Auto-scroll** (`SJItemsTable`): helper `scrollToBottom` mencari scroll container
  terdekat (main dengan overflow-y-auto) lalu `scrollTo` ke scrollHeight (double rAF
  agar DOM baris baru sudah render). Dipakai di tombol "+ Tambah Baris" DAN tombol
  duplikat baris (ikon panah bawah). Catatan: `scrollIntoView` pada sentinel setinggi
  0 diabaikan browser — itu sebab percobaan awal tidak jalan.
- **Auto-scroll saat fokus**: `onFocusCapture` di container tabel → field yang dapat
  fokus via Tab/Shift+Tab/klik otomatis di-scroll ke viewport (`block: "nearest"`,
  hanya scroll kalau di luar layar).
- **Dropdown Satuan keyboard nav**: `SatuanSelect` kini support ArrowDown/Up (navigasi),
  Enter (buka/pilih), Escape (tutup), Space (buka). Highlight ikut keyboard + mouse.
- **Filter Merk di Rekap Alokasi** (`/sj/report`): tambah "merk" ke SearchField type +
  SEARCH_FIELD_LABEL + case di switch filter + case "all" + opsi dropdown + placeholder.

### Light Mode — perbaikan lanjutan
- **Theme tidak persist saat refresh** (balik ke dark). Root cause: useEffect DB-sync di
  `ThemeContext` jalan setiap `profile` berubah dan MENIMPA pilihan terbaru dengan nilai
  DB lama. Fix: DB-sync hanya SEKALI saat profile pertama load (`dbSyncedRef`),
  localStorage jadi prioritas (kalau sudah ada nilai, tidak ditimpa profile),
  `userTouchedRef` mencegah timpa setelah toggle manual, error update DB di-log.
- **Topbar & tombol collapse sidebar tetap dark**: override CSS per-hex ternyata rapuh
  (topbar pakai `bg-[#0d1117]/80` — variant opacity, class-nya beda). Fix: Topbar,
  `aside` Sidebar, dan tombol collapse diubah pakai TOKEN langsung
  (`var(--surface)` / `var(--surface-3)` via inline style), tidak bergantung override.
- globals.css: lengkapi override hex yang terlewat (`#111827`, `#0f1724`, `#0c1421]/95`,
  `#1a2030`, `#1a1a1f`, `#0d1117]/80` & `/95`).

### FITUR BARU — Pendingan Alokasi (`/sj/pendingan`)
Daftar rencana kirim manual per Tujuan (bukan kalkulasi stok) — membantu GA mencatat
barang apa saja yang masih harus dikirim ke tiap toko/tujuan.

**Database:**
- `sj_tujuan` tambah kolom `kota` + `kecamatan` (keduanya nullable).
- Tabel baru `pendingan_items` (flat, 1 tabel): id, tujuan_id (FK → sj_tujuan,
  ON DELETE CASCADE), jenis, qty, keterangan, created_at.
  Dipilih flat (bukan header+detail) karena tidak ada metadata per-tujuan yang perlu
  disimpan — grouping cukup di query/UI, lebih ringan.
- Index: idx_pendingan_items_tujuan, idx_pendingan_items_created, idx_sj_tujuan_kota.
- [PENTING] `pendingan_items` awalnya kena RLS default project → error
  "new row violates row-level security policy". Fix: `DISABLE ROW LEVEL SECURITY`
  (konsisten dengan tabel lain yang diakses via anon key dari API server-side).
- Data kota/kecamatan diisi massal dari file `alamat-toko.xlsx` (828 baris) via satu
  statement `UPDATE ... FROM (VALUES ...) WHERE t.kode = v.kode` — hanya meng-update
  tujuan yang kode-nya ada di file. 7 kota: Batang, Demak, Jepara, Kendal, Kudus,
  Pekalongan, Semarang.

**API & hook:**
- `GET/POST/DELETE /api/pendingan` — GET list (join sj_tujuan untuk kota/kecamatan,
  optional filter ?tujuan_id), POST batch insert, DELETE hard-delete by ids.
- `usePendingan` hook: items + loading + refresh + addItems + clearItems.
- `POST/PATCH /api/sj/tujuan` diupdate agar menerima `kota` & `kecamatan`.

**Halaman (layout 2 kolom):**
- KIRI: tombol "Pendingan Baru" + dropdown filter Kota (default "Semua Kota") +
  list tujuan yang punya pending, di-group **Kota → Kecamatan** (urut A-Z), tiap
  tujuan ada cekbox-tujuan (clear semua item tujuan itu) + badge jumlah pending.
- KANAN: item tujuan terpilih (jenis, qty, keterangan) dengan cekbox-item per baris.
  Centang sebagian → tombol "Clear N item tercentang". Kalau SEMUA item tercentang →
  badge "Semua tercentang" muncul. Clear = hard-delete.
- INPUT: lewat MODAL form ala Buat SJ — pilih Tujuan (dropdown searchable) + tabel
  item multi-baris (`PendinganItemsTable`: jenis autocomplete + allowCustom, jumlah,
  keterangan) dengan Tambah Baris, duplikat baris ke bawah, hapus baris, auto-scroll.
  Simpan sekaligus batch.
  [DECISION] Dibuat komponen tabel BARU (bukan reuse SJItemsTable) supaya ramping —
  SJItemsTable bawa kolom merk/satuan/SN/tag yang tidak dipakai di pendingan.
- Menu "Pendingan Alokasi" ditambahkan di submenu Surat Jalan Manual.

**Glass theme (uji coba di halaman ini saja):**
- Glassmorphism: panel semi-transparan + `backdrop-filter: blur()`, background halaman
  diberi radial gradient supaya efek blur kelihatan (glass butuh sesuatu di belakang).
- Light mode: ala iOS — `blur(20px) saturate(160%)`, opacity 0.45, shadow halus.
- Beban performa minim: murni CSS, GPU-accelerated, tanpa perhitungan JS.
- Blur & opacity dibuat sebagai CSS variable terpisah di blok "KONTROL GLASS THEME"
  di atas style, supaya mudah di-tuning manual (tinggal ganti angka).
- Semua warna teks/border/aksen pakai token `--pend-*` yang berbeda per tema:
  dark → cyan terang (#38bdf8) & teks putih; light → cyan gelap (#0369a1),
  teks slate (#1e293b), emerald gelap (#047857) supaya kontras & terbaca.

### Catatan
- Budget tetap DIBATALKAN (out of scope TA).
- Shortcut "Buat SJ" dari pendingan (pre-fill form) TIDAK jadi dibuat — diputuskan
  fokus ke list + checklist saja.

---

## 24 Juli 2026 — 7 Temuan Revisi, Penutupan Celah SJ Masuk, Checkbox "Keduanya"

### 7 temuan revisi (batch)
1. **Urgensi pendingan** — `pendingan_items` tambah kolom `urgensi`
   ('tinggi'/'sedang'/'rendah', default 'sedang') + index idx_pendingan_items_urgensi.
   Dipilih per item saat input. Filter Urgensi berdampingan dengan filter Kota
   (2 dropdown sejajar), keduanya bertumpuk. Badge urgensi berwarna kontras di
   dark & light; dot kecil di baris tujuan menandai urgensi tertinggi. Item lama
   otomatis dianggap 'sedang'.
2. **Merk pendingan** — `pendingan_items` tambah kolom `merk` (default ''). Kolom
   input baru di form (autocomplete master merk) + tampil di list item.
3. **Cekbox tujuan** — clear langsung hard-delete tanpa dialog konfirmasi.
4. **SJ masuk berubah jadi keluar saat diedit** — root cause: PATCH /api/sj selalu
   set `jenis` (`jenis === 'masuk' ? 'masuk' : 'keluar'`), sedangkan halaman Buat SJ
   tidak mengirim `jenis` saat edit → undefined → jatuh ke 'keluar'. Fix: `jenis`
   hanya di-update kalau body memang mengirimnya (headerPatch kondisional). Plus bug
   lanjutannya: preview/print PDF setelah edit SJ masuk pakai template SJ keluar —
   fix dengan meneruskan prop `jenis` (dari existingSJ.jenis) ke SJPreviewModal;
   generateSJPdfBlob memang sudah memilih SuratPenerimaanPDF saat jenis 'masuk'.
5. **Tanggal Excel Rekap** — dicek ternyata sudah benar (pakai it.tanggal dari input),
   tidak ada perbaikan.
6. **Title tab browser** — semua halaman client component (tidak bisa export metadata),
   tapi semua sudah pakai <Topbar title="...">. Solusi: Topbar set document.title =
   `${title} — SmartWMS` via useEffect, plus cleanup ke default saat unmount (halaman
   auth tanpa Topbar). Satu perubahan, 14 halaman otomatis benar.
7. **Master Tujuan** — form tambah input Kota & Kecamatan (opsional), tabel tampilkan
   kedua kolom, search ikut mencakup keduanya. API tujuan POST/PATCH sudah menerima
   kota/kecamatan dari sprint sebelumnya.

Migration: `migration-pendingan-merk-urgensi.sql` (kolom merk + urgensi + index).

### Penutupan celah alur SJ masuk (arsitektur)
Diskusi arsitektur: `surat_jalan` menampung 2 jenis dokumen (keluar/masuk) dibedakan
kolom `jenis`. Kolom `tujuan_id` bermakna ganda (tujuan untuk keluar, ASAL untuk masuk)
— tidak merusak data, hanya penamaan. Yang berbahaya: satu jalur edit (`/sj/buat`)
memperlakukan dua jenis dokumen seragam. Ditutup 3 celah:

- **Staging tidak sinkron saat edit** — POST SJ masuk auto-insert ke `staging_area`,
  DELETE membersihkannya, tapi PATCH dulu tidak menyentuhnya. Akibat: barang yang
  dihapus nyangkut di staging, barang baru tidak masuk staging (tidak bisa diberi
  catatan sebelum sync ke asset_notes). Fix: PATCH sinkronkan staging_area untuk SJ
  masuk (replace penuh, pola sama dengan surat_jalan_items). Catatan lama dipertahankan
  via pencocokan kode_asset.
- **Barang sudah di CGA muncul lagi di staging** — fix lanjutan: item yang kode asetnya
  sudah ada di assets_raw dengan toko CGA di-skip dari staging (aturan sama dengan
  syncStagingToNotes()). Cek cuma untuk kode aset di SJ itu (bukan seluruh DAT), ringan.
- **Jalur edit salah** — tombol Edit di Daftar SJ dulu selalu ke /sj/buat. Fix: baca
  `sj.jenis` → SJ masuk ke `/sj/masuk?edit=`, keluar ke `/sj/buat?edit=`. Halaman
  Penerimaan Barang (`/sj/masuk`) kini dukung mode edit: hydrate form dari existingSJ,
  submit PATCH (bukan POST), judul & tombol menyesuaikan ("Edit/Update Penerimaan
  Barang"), setelah simpan kembali ke /sj/list (bukan reset form).

Hasil: kolom `tujuan_id` tetap bermakna ganda di DB (tidak masalah), tapi tiap jenis
dokumen kini punya halaman editnya sendiri sehingga tidak ada lagi perlakuan seragam
yang salah.

### Checkbox "Keduanya" di Rekap Alokasi
Masalah: mutasi Oracle & WT dikerjakan di 2 program berbeda, tidak bisa bersamaan.
Kalau user centang salah satu duluan, baris langsung hilang dari filter "Belum Keduanya"
padahal belum selesai. Fix: kolom baru "Keduanya" (paling kanan tabel) — satu klik
set/batalkan mutasi Oracle + WT sekaligus. Satu request PATCH (API /api/sj/report sudah
dukung conditional update dua field). kode_asset ikut dikirim agar tidak terhapus jadi
null saat mutasi_oracle_status diset. Disabled untuk baris non-aktiva.

---

## 25 Juli 2026 — Arah Tarik/Kirim, Fix Staging Non-AT, Edit Item Pendingan

### Mekanisme Arah (Tarik / Kirim) di Pendingan Alokasi
Kebutuhan riil: satu toko bisa punya dua jenis kebutuhan sekaligus —
- `kirim` = barang baru dari gudang DIKIRIM ke toko
- `tarik` = barang bekas / ex-peremajaan DITARIK dari toko ke gudang

Implementasi:
- `pendingan_items` tambah kolom `arah` (TEXT, default 'kirim') + index
  idx_pendingan_items_arah. Migration: `migration-pendingan-arah.sql`.
- API POST validasi VALID_ARAH = ['kirim','tarik'], fallback 'kirim' kalau nilai
  tidak sah. GET ikut select kolom arah.
- `PendinganItemsTable`: kolom Arah baru (SearchableDropdown, sebelum Urgensi).
  Karena per ITEM, dalam satu entri tujuan bisa dicampur kirim & tarik.
- Halaman: badge Arah di list item (Kirim = biru, Tarik = ungu; versi gelap saat
  light mode agar kontras). Filter Arah di panel kiri ("Kirim & Tarik"/Kirim/Tarik),
  bertumpuk dengan filter Kota & Urgensi.
- Item lama tanpa arah otomatis dianggap 'kirim'.

### [BUG FIX] Non-AT tidak boleh masuk staging
Root cause: POST /api/sj memasukkan SEMUA item SJ masuk ke `staging_area` tanpa cek
`is_aktiva`. Barang non-AT (consumable, sparepart) tidak akan pernah muncul di DAT,
sehingga `syncStagingToNotes()` tidak pernah membersihkannya → NYANGKUT SELAMANYA
di Staging Area.

Fix: filter `is_aktiva` di POST **dan** PATCH sebelum insert ke staging_area.
Item AT tanpa kode_asset TETAP masuk sebagai AT Lebih (itu memang tujuan fitur —
beda kasus dengan non-AT).

Data non-AT lama yang sudah terlanjur nyangkut dibersihkan manual oleh Fillian
lewat halaman Staging (hapus).

### Fitur Edit Item Pendingan
Tanpa migration (semua kolom sudah ada).
- Endpoint baru `PATCH /api/pendingan` — pola conditional update (sama dengan
  /api/sj): hanya field yang dikirim yang di-update, agar tidak menimpa field lain
  dengan nilai kosong. Validasi: jenis tidak boleh kosong (ditolak 400), qty < 1
  dinormalkan jadi 1, nilai urgensi/arah di luar daftar sah DIABAIKAN (bukan
  ditimpa) sehingga nilai lama dipertahankan.
- Hook `usePendingan` tambah `updateItem(id, patch)`.
- UI: tombol edit (ikon pensil) di kolom paling kanan tiap baris item → modal edit
  berisi Jenis, Merk, Jumlah, Arah, Urgensi, Keterangan (Jumlah/Arah/Urgensi
  disusun 3 kolom agar ringkas). Tombol edit sengaja TIDAK di-disable saat item
  tercentang — koreksi masih boleh selama belum di-clear.

---

## 26 Juli 2026 — Refactor UI ke Design Token Tailwind (branch `style`, BERJALAN)

> Dikerjakan di branch terpisah `style`, BELUM di-merge ke main.
> Alasan branch terpisah: menyentuh seluruh tampilan, sementara main dipakai
> operasional harian divisi GA.

### Latar belakang
Fillian ingin bisa mengubah warna, ukuran font, dan jenis font dengan mudah.
Awalnya dibuat lapisan CSS override, tapi Fillian menilai itu bukan "cara asli
Tailwind" (Tailwind bekerja lewat class di komponen). Diputuskan refactor ke
mekanisme resmi Tailwind v4, dicicil per halaman.

### Temuan setup (hasil verifikasi)
- Instalasi = **npm proper Tailwind v4** (`tailwindcss ^4` + `@tailwindcss/postcss`),
  BUKAN Play CDN. `postcss` tidak tercantum eksplisit — normal, dibawa Next.js.
- Tidak ada `build.css` karena memakai jalur PostCSS plugin + Next.js: kompilasi
  otomatis saat `next dev`/`next build`, hasil masuk `.next/static/css/` (gitignored).
  `build.css` hanya ada di jalur Tailwind CLI (proyek tanpa bundler).

### Struktur globals.css (3 lapis)
1. **Panel kustomisasi** — semua knob di satu blok `:root`: font family, 9 tingkat
   ukuran font (8–16px), 4 radius, warna dark & light, + warna aksen khusus light
   untuk kontras. Nilai default DISAMAKAN PERSIS dengan tampilan sebelumnya.
2. **`@theme inline`** — menghasilkan utility class semantik resmi Tailwind:
   `bg-canvas/surface/panel/field`, `border-line`, `text-heading/body/muted/dim`,
   `text-accent/success/warning/danger/info`, `text-nano/mini/tiny/small/base2/
   lead/sub/title/display`. Pakai `inline` supaya class menunjuk langsung ke
   `--surface`/`--text` sehingga ikut berganti saat toggle tema.
3. **Lapisan kompatibilitas** — memetakan ~1.500 class hardcoded lama
   (`text-white/40`, `bg-[#0d1117]`, `text-[12px]`) ke token, dengan `!important`,
   supaya halaman yang BELUM dimigrasi tetap ikut tema. Dihapus bertahap seiring
   migrasi selesai.

### [BUG FIX] Kontras light mode
Root cause: aplikasi memakai warna terang khas dark mode (`text-cyan-400` 62×,
`text-rose-400` 49×, `text-amber-300` 31×). Di latar terang jadi pudar.
Diukur dengan rasio kontras WCAG (minimal 4.5): warna lama berada di **1.44–2.69**
(amber-300 = 1.44, praktis tak terbaca). Setelah dipetakan ke versi gelap
(`--ui-light-cyan` #0369a1 dst): **5.01–7.10**, semua lolos AA.

### [BUG FIX] `dark:` tidak ikut toggle
Tailwind v4 secara bawaan mengaitkan `dark:` ke `prefers-color-scheme` (setelan OS),
bukan class `.dark` aplikasi. Ditambahkan:
```
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant light (&:where(.light, .light *));
```
[GOTCHA] Sempat error `@custom-variant dark has no selector or body` karena ditulis
dengan DUA SPASI setelah nama variant (untuk perataan kolom). Parser Tailwind
menolak. Harus tepat satu spasi.

### [GOTCHA] Dua class warna tidak boleh ditumpuk
`className="text-heading text-gray-100"` → `text-gray-100` diabaikan. Pemenang
ditentukan urutan di CSS hasil build, BUKAN urutan penulisan di className.
Untuk menimpa: pakai satu class saja, atau varian `text-gray-900 dark:text-cyan-400`.
Hindari nama class yang ada di lapisan kompatibilitas (dipaksa `!important`).

### Keputusan: apa yang jadi token, apa yang tetap arbitrary
Penyaring: **berulang & bermakna → token; sekali-pakai & spesifik → arbitrary.**
- Token: warna, ukuran font, radius, (rencana) lebar sidebar.
- Tetap arbitrary: `grid-cols-[...]` tabel (dipakai sekali, angkanya menggambarkan
  kolom tabel itu sendiri — dijadikan token justru menurunkan keterbacaan),
  tinggi panel sekali-pakai, posisi absolut. Dokumentasi resmi Tailwind memang
  menganjurkan arbitrary value untuk kasus sekali-pakai.
- Class layout (`flex`, `gap-2`, `px-4`) SUDAH idiomatis — tidak ada yang diubah.

### Prosedur migrasi per halaman (dipakai konsisten)
Hanya class warna & ukuran font yang diganti. Setiap halaman diverifikasi 3 hal:
1. Syntax lolos esbuild
2. Kode di luar `className` **identik byte-per-byte** (bukti nol perubahan logika)
3. Jumlah class layout tidak berubah (bukti layout tidak bergeser)

[GOTCHA] Verifikasi #2 sempat menandai "berubah" di Manajemen User — ternyata class
yang disimpan di konstanta (`const STATUS_BADGE: Record<string,string>`) lalu dipakai
via `${STATUS_BADGE[u.status]}`. Itu tetap class UI, cuma tidak literal di className.
Halaman lain dengan badge status (Daftar SJ, Rekap Alokasi) kemungkinan sama.

### Progres migrasi
| # | Halaman | Status |
|---|---------|--------|
| 1 | Template Item (`/sj/templates`) | ✅ selesai |
| 2 | Master Tujuan (`/sj/tujuan`) | ✅ selesai |
| 3 | Manajemen User (`/admin/users`) | ✅ selesai |
| 4 | Pendingan Alokasi | ⏳ berikutnya (hati-hati: punya blok glass `--pend-*` sendiri) |
| 5 | Upload | belum |
| 6 | Rekap Alokasi | belum |
| 7 | Daftar SJ | belum |
| 8 | Buat SJ | belum |
| 9 | Monitoring | belum |
| 10 | Dashboard | belum |
| — | Live Stock | **DILEWATI** — ukuran TV (`vmin`/`clamp`) sudah disetel, mudah rusak |

Urutan sengaja dari halaman paling jarang dipakai supaya kalau ada yang meleset
dampaknya kecil.

### Dokumentasi
`docs/UI-CUSTOMIZATION.md` — panduan lengkap: tabel "mau ubah apa", pemetaan class
lama→baru, contoh migrasi, resep cepat (tampilan lega, nuansa hijau, kontras tinggi),
aturan menimpa warna, dan daftar nilai bawaan untuk balik ke awal.

---

## 27 Juli 2026 — Merge Refactor UI ke main, Fix Duplikat Kode Aset, Filter Kategori, Fix Kop PDF

### Branch `style` di-merge ke main lalu dihapus
Refactor UI (3 dari 10 halaman) digabungkan ke `main` dan branch `style` dihapus.
Pekerjaan migrasi berikutnya dilanjutkan langsung di `main`.
Branch lama `stock` juga dihapus (0 commit yang belum ada di main).

[CATATAN GIT] Sempat terjadi *diverged* di branch `style`: commit docs di-push dari
Codespace, sementara repo lokal (yang belum menarik commit itu) melakukan
`git merge origin/main`. Kedua sisi maju ke arah berbeda. Diselesaikan dengan
`git pull` biasa — merge bersih karena file yang disentuh berbeda
(docs vs `report/page.tsx`).

### [BUG FIX] Kode aset yang sudah dimutasi memblokir input duplikat
Gejala: input `C06.000001` di Rekap Alokasi ditolak "kode sudah dipakai", padahal
kode itu ada di SJ Penerimaan yang SUDAH terkonfirmasi mutasi.

Root cause: `usedKodes` (di `sj/report/page.tsx`, bukan API) dibangun dari SELURUH
item tabel tanpa memandang status mutasi.

Alasan kenapa itu salah: satu aset punya siklus hidup berulang — masuk ke gudang
lewat SJ Penerimaan, lalu dikirim lagi ke toko lewat SJ Keluar dengan kode yang
sama. Baris yang sudah dimutasi adalah CATATAN RIWAYAT, bukan pemakaian aktif.

Fix: item ber-`is_mutated` dikeluarkan dari `usedKodes`. Status mutasi diresolusi
lewat `allocOverride` supaya akurat tanpa perlu refresh. Fungsi asli (mencegah salah
ketik kode kembar pada dua baris yang sama-sama belum diproses) tetap jalan.

### [BUG FIX] Kop surat hilang di halaman lanjutan PDF
Gejala: kalau blok tanda tangan terdorong ke halaman 2, halaman itu cuma berisi
kolom TTD tanpa identitas surat.

Root cause: `DocumentHeader` sengaja TIDAK `fixed` (warisan dari perbaikan
23 Juli, karena dulu dikira `fixed` yang menyebabkan bug "halaman 1 header doang").

Fix: `DocumentHeader` menerima prop `fixed`, diteruskan ke 3 blok teratasnya
(header, metaContainer, tujuanSection).

[VERIFIKASI] Diuji dengan MERENDER PDF SUNGGUHAN (`@react-pdf/renderer` v4.5.1
dipasang di sandbox, hasil dibaca pdfplumber):
- tanpa `fixed`, 36–42 item → hal 2: TTD tanpa kop
- dengan `fixed`, 36–42 item → hal 2: kop + TTD
- posisi hal 2: kop y=37–55, isi mulai y=94 → TIDAK bertabrakan.
  @react-pdf memang menyediakan ruang untuk elemen `fixed` di halaman lanjutan.

### Fitur: filter multi-kategori di Rekap Alokasi
Tombol `[All][C][P][Q][S][T]…` di kanan baris "Review Mutasi", di atas tombol Reset.
Multi-pilih dengan toggle: klik nyala, klik lagi mati. Set kosong = semua tampil.
Tombol dibuat OTOMATIS dari kategori yang ada di data (bukan daftar hardcoded).

Sumber data: item Surat Jalan hanya menyimpan `jenis`, sedangkan kategori ada di
`assets_raw.kategori_oracle`. API report membangun peta jenis→kategori memakai pola
join yang sama dengan Live Stock (`assets_clean` join `assets_raw!inner`), lalu
menempelkan field `kategori` ke tiap item.
[BEBAN] Ini menambah SATU pemindaian tabel saat memuat Rekap. Kalau terasa lambat,
opsi berikutnya: pindahkan ke endpoint master dengan cache 5 menit (pola
`useMasterJenis`).

Filter ikut mempengaruhi ekspor Excel (memakai `filtered` yang sama), bertumpuk
dengan filter lain, dan ikut ter-reset tombol Reset.

[GOTCHA] Saat menyisipkan filter, sempat error runtime `out is not defined` karena
nama variabel akumulator di blok `filtered` ditebak (`out`) padahal aslinya `result`.
Syntax check TIDAK menangkapnya (secara sintaksis sah, cuma tak terdeklarasi).
Pelajaran: baca variabel di sekitar titik sisip, jangan menebak.

# 30 Oktober 2026 — Awal SmartWMS V2 (repo baru, PC lokal) + Tahap 1a & 1b

### Konteks
TA selesai. SmartWMS dipindah dari cloud (Vercel + Supabase) ke PC kantor Fillian sebagai server,
diakses lewat LAN, sekaligus di-improve → **SmartWMS V2**. Repo baru `github.com/iyunn/smart-wmsV2`,
diawali clone repo V1 beserta histori. Development di PC lokal Windows (terminal MSYS2 bash),
Codespace tidak dipakai lagi.

### Keputusan utama (detail & alasan: `docs/v2/ARCHITECTURE.md` D-01 s.d. D-21)
- **PostgreSQL 18**, bukan MySQL/XAMPP: skema V1 sudah PostgreSQL (`uuid`, `timestamptz`, `jsonb`,
  `ON CONFLICT`, `ilike`) → pindah lewat `pg_dump`; XAMPP membawa Apache + PHP yang tidak terpakai.
- **Kysely + `pg`** (bukan PostgREST), atas permintaan "pakai yang scalable": SQL penuh untuk
  agregasi di DB, tipe di-generate dari skema, tanpa limit 1.000 baris. Kontrak API V1 tetap (D-08).
- **Auth sendiri** (app_users + user_sessions + bcryptjs); lupa password via email diganti reset
  oleh Super Admin.
- **Windows Service via WinSW**, bukan PM2.
- Dev & prod sama-sama **native Windows**; DB & port dipisah (`smartwms_dev`/3001 vs `smartwms`/3000).
- **Light theme** diadaptasi dari STYLEGUIDE AYAMSMART → `docs/v2/STYLEGUIDE.md`; dark tetap.

### [SECURITY] Temuan V1 — hotfix DILEWATI
`src/lib/supabaseClient.ts` berisi anon key di repo publik, dan semua policy RLS allow-all → data
Supabase bisa dibaca/diubah siapa pun yang membaca repo. 23 route API juga berjalan sebagai `anon`,
sehingga RLS tidak bisa diperketat tanpa mengubah kode dulu.
Rencana hotfix (Tahap 0a kode + 0b RLS) disusun, tapi **dilewati atas keputusan Fillian** karena V1
akan ditinggalkan. Konsekuensi yang dicatat: celah tetap terbuka sampai cutover → Tahap 7 wajib
mem-pause project Supabase / mencabut akses anon di hari cutover (PRD §7, §8).

### Tahap 1a — setup repo
Dokumen baru: `docs/v2/PRD.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `STYLEGUIDE.md`; `docs/chat-rule.md`
ditulis ulang untuk V2 (dua repo, PC lokal, perintah bash MSYS2); `README.md`; `.gitattributes` (LF).
Saat setup pertama: `Expand-Archive` gagal karena terminal bash, bukan PowerShell; commit gagal karena
identitas git belum diset; push 403 karena kredensial GitHub tersimpan milik akun lain → solusi:
`git config --global user.*` dan username `iyunn` di URL remote.

### Tahap 1b — fondasi database
- `deploy/windows/setup-db.sql`: role `smartwms_owner` (migrasi) + `smartwms_app` (hanya DML),
  database UTF8, default privileges (D-20). Idempotent — aman dijalankan ulang.
- `src/server/db/create.ts` (pabrik koneksi + parser tipe), `index.ts` (instance `db`, server-only,
  singleton saat hot reload), `migrate.ts` (`latest`/`down`/`status`/`check`), `types.ts` (codegen).
- Parser tipe disamakan dengan V1 (D-21): int8 & numeric → number, date → string.
- `.kysely-codegenrc.json` (opsi codegen di file, bukan argumen, supaya aman di cmd.exe & bash).
- Script npm: `dev` (3001), `db:migrate`, `db:codegen`, `test`. `@types/node` naik ke 24 karena
  peer dependency Vitest 5.

[GOTCHA] Kysely 0.29 memindahkan `Migrator` & `FileMigrationProvider` ke `kysely/migration`.
[GOTCHA] Paket `server-only` melempar error bila diimpor di luar Next.js → skrip CLI memakai
`create.ts`, bukan `index.ts`.
[GOTCHA] `--url env(...)` di npm script rusak di shell (tanda kurung) → opsi dipindah ke file config.

[VERIFIKASI] Diuji pada PostgreSQL 16 di sandbox (perilaku role & privileges sama di 18):
setup-db.sql dijalankan 2× tanpa error (idempotent, password berisi tanda kutip aman);
migrasi contoh up → status → down berhasil; codegen menghasilkan tipe benar (int8 → number);
role app bisa INSERT/SELECT/DELETE tapi ditolak CREATE TABLE; `tsc --noEmit` 0 error.

# 30 Oktober 2026 — Tahap 1 selesai, Tahap 2a (snapshot V1)

### Tahap 1 ✅
Fillian: PostgreSQL 18 terpasang di PC dev, `setup-db.sql` jalan, commit Tahap 1a+1b ter-push ke
`smart-wmsV2`. Terverifikasi dari GitHub: `package.json` (smart-wms-v2), lockfile memuat Kysely,
`src/server/db/*`, dokumen V2.
[GOTCHA] Awalnya `psql.exe` tidak ditemukan karena PostgreSQL belum ter-install — skrip sekarang
mengecek lokasi `pg_dump` dan bisa diarahkan lewat variabel `PGBIN`.

### Tahap 2 dipecah tiga
Baseline skema harus ditulis dari skema production asli: dokumentasi `project_context.md` tidak
memuat semua index/constraint/default, dan beberapa SQL migrasi V1 dijalankan manual di Supabase
tanpa tercatat di repo. Maka: **2a** snapshot (dijalankan Fillian, read-only) → **2b** baseline
ditulis dari snapshot → **2c** impor data.

### Tahap 2a
- `scripts/v1/snapshot.sh` — membaca `SUPABASE_DB_URL` dari `.env.local` tanpa men-source seluruh file
  (password bisa berisi karakter shell; `\r` dibuang bila file CRLF), menjalankan `pg_dump --schema-only
  --schema=public --no-owner --no-privileges` dan `snapshot-counts.sql`.
- `scripts/v1/snapshot-counts.sql` — jumlah baris exact per tabel (`query_to_xml`), prefix hash
  `auth.users` (4 karakter, bukan hash), FK public → schema lain, trigger `auth.users`, extension.
- Koneksi wajib lewat **Session pooler** Supabase (port 5432): koneksi direct Supabase umumnya IPv6.

[VERIFIKASI] Diuji terhadap PostgreSQL 16 tiruan (schema `auth` + `profiles` ber-FK ke `auth.users`,
trigger `handle_new_user`, `surat_jalan` dengan RLS & policy, `.env.local` CRLF): snapshot berhasil,
FK & trigger ke `auth` terdeteksi, jumlah baris benar (645).

# 30 Oktober 2026 — Tahap 2a selesai, Tahap 2b (migrasi baseline)

### Tahap 2a ✅
Snapshot ter-push setelah dua kali gagal login (`password authentication failed`) — diselesaikan
Fillian. `snapshot.sh` sekarang menolak baris `SUPABASE_DB_URL` ganda dan placeholder
`[YOUR-PASSWORD]`, serta membuang tanda kutip pembungkus.

Isi snapshot (Supabase production, PostgreSQL 17.6):
- 14 tabel, total ±33 ribu baris: surat_jalan 1.925, surat_jalan_items 7.389, assets_raw/clean 5.173,
  lpp_raw 5.443, sj_tujuan 973, keyword_rules 728, asset_notes 450, staging_area 63,
  pendingan_items 45, dat_closing 18, profiles 4, sj_item_templates 4, classification_logs 0.
- 4 akun, semua hash bcrypt `$2a$` → bisa diverifikasi `bcryptjs`, user tidak perlu ganti password.
- 1 FK ke luar public (`profiles.id → auth.users`), 1 trigger `auth.users` (`handle_new_user`).
- Extension: pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault — tidak ada yang dibutuhkan V2.

### Tahap 2b — `0001_baseline.ts`
Ditulis dari snapshot, **disamakan persis** dengan V1: 14 tabel, semua kolom/tipe/default/nullable,
30 constraint (14 PK, 6 UNIQUE, 5 FK, 5 CHECK), 30 index. Dibuang: 15 policy + RLS, FK & trigger ke `auth`,
function `rls_auto_enable`. `extensions.uuid_generate_v4()` → `gen_random_uuid()` (bawaan PG ≥ 13).

[BUG YANG DICEGAH] Zona waktu. Tiga kolom V1 bertipe `timestamp` **tanpa** zona
(`assets_raw.uploaded_at`, `assets_clean.created_at`, `classification_logs.processed_at`). Di Supabase
server ber-zona UTC, jadi `now()` menyimpan jam UTC. Installer PostgreSQL Windows memakai zona OS
(WIB) → `now()` akan menyimpan jam WIB, dan driver `pg` membaca kolom tanpa zona sebagai jam lokal
proses Node → "DAT update terakhir" bisa bergeser 7 jam. Solusi: database dikunci UTC (D-22) +
parser `timestamp` mengembalikan string format PostgREST (D-21).

Catatan optimasi untuk nanti (tidak diubah demi paritas): `idx_assets_raw_kode` duplikat dengan
index unik `assets_raw_kode_asset_unique`; `idx_assets_raw_toko` tertutup oleh `idx_assets_raw_toko_id`.

[VERIFIKASI] Di sandbox (PostgreSQL 16, server sengaja diset `Asia/Jakarta` meniru Windows):
- Dump Supabase dimuat ke database pembanding, lalu katalog (kolom, tipe, default, nullable,
  constraint, index) dibandingkan dengan hasil migrasi → **identik**, selain tabel `kysely_migration*`.
- Migrasi up → down → up berhasil; codegen menghasilkan 14 tabel; `tsc --noEmit` 0 error.
- Koneksi app: `show timezone` = UTC; `uploaded_at` default = jam UTC (string); int8 → number;
  date → string; role `smartwms_app` bisa INSERT ke tabel baru (default privileges jalan).

[BUG FIX — Windows] `npm run db:migrate` gagal di PC Fillian: "Only URLs with a scheme in: file, data,
and node are supported... Received protocol 'd:'". Root cause: `FileMigrationProvider` bawaan Kysely
memanggil `import()` dengan path absolut Windows (`D:\...`), padahal loader ESM Node.js di Windows
mewajibkan `file:///D:/...`. Di Linux path absolut sah, jadi lolos uji sandbox.
Fix: `FileUrlMigrationProvider` sendiri di `migrate.ts` (path → `pathToFileURL`). Nama migrasi tetap
nama file tanpa ekstensi, jadi riwayat di tabel `kysely_migration` tetap cocok (diuji: status yang
dicatat provider lama terbaca ✓ oleh provider baru).
Pelajaran: kode yang menyentuh path file harus memakai `pathToFileURL` / `path.resolve`, jangan
mengandalkan format path Linux — pengembangan & produksi V2 sama-sama Windows.
Catatan: `show timezone` di PC dev sebelum migrasi = `Asia/Bangkok` (zona OS) — konfirmasi bahwa
penguncian UTC (D-22) memang diperlukan.
