# STYLEGUIDE — SmartWMS V2

> Panduan tampilan V2. Tailwind CSS v4, token di `src/app/globals.css`, tanpa component library.
> Dibuat: 30 Oktober 2026 · Diterapkan Tahap 5 (30 Okt 2026). Keputusan: `ARCHITECTURE.md` D-15, D-30, D-31.
>
> **Asal:** diadaptasi dari STYLEGUIDE AYAMSMART (23 Okt 2026). Aturan dasarnya dipakai
> (token, kontras, kaca, radius, tipografi, aksesibilitas), tapi disesuaikan karena SmartWMS
> adalah **tool desktop padat data** (tabel ribuan baris, dashboard, layar TV), bukan aplikasi HP.
> Perbedaan dicatat di §11.

---

## 1. Arah Desain

**Tenang, hangat, dan mudah dipindai.** Admin GA membuka SmartWMS untuk menemukan angka atau
baris tertentu dengan cepat. Data adalah isinya; tampilan tidak boleh bersaing dengan data.

1. **Satu sorotan per halaman.** Satu angka/elemen utama (mis. total stok CGA di Dashboard);
   sisanya tenang. Jangan banyak badge warna-warni atau banyak angka raksasa.
2. **Kaca hanya untuk bingkai aplikasi** (Topbar, Sidebar, modal, toast) di atas latar
   hangat-ke-biru. **Tabel dan kartu data selalu solid** agar teks tajam dan ringan dirender.
3. **Netral hangat**, bukan abu dingin; aksen biru untuk aksi, hijau/kuning/merah untuk status CGA.
4. **Padat tapi terbaca.** Tabel boleh rapat; teks tidak boleh lebih kecil dari batas §5.
5. **Jujur secara visual.** Status tidak hanya dibedakan warna; data lama/simulasi diberi label.
6. **Dua tema, satu bahasa visual.** Light = panduan ini; dark = versi gelap yang nyaman di mata (§2.4).

**Hindari:** semua konten dijadikan kartu identik, label HURUF KAPITAL dengan tracking lebar,
panah "→" di tombol, animasi masuk di setiap bagian, kaca di atas kaca.

---

## 2. Warna

### 2.1 Token yang sudah dipakai (nama TIDAK berubah)

Class ini sudah dipakai di kode (`bg-surface`, `text-muted`, dst.). V2 hanya mengganti **nilai**
light-nya, sehingga halaman yang sudah memakai token otomatis ikut.

| Class Tailwind | Variabel | Light V1 | **Light V2** | Kontras |
|---|---|---|---|---|
| `bg-canvas` | `--bg` | `#f1f5f9` | `#FFF8F0` (Nasi) + `.app-backdrop` | — |
| `bg-surface` | `--surface` | `#ffffff` | `#FFFFFF` | — |
| `bg-panel` | `--surface-2` | slate 2% | `#F7F2EC` | — |
| `bg-field` | `--surface-3` | slate 5% | `#FFFFFF` + border `line-strong` | — |
| `border-line` | `--border` | slate 10% | `#E9E1D8` | dekoratif |
| `text-heading` | `--text-strong` | `#0f172a` | `#2A2420` (Arang) | 15,3:1 di putih |
| `text-body` | `--text` | `#1e293b` | `#2A2420` | 14,5:1 di Nasi |
| `text-muted` | `--text-muted` | `#475569` | `#6E625A` (Arang lembut) | 5,9:1 putih · 5,2:1 Langit |
| `text-dim` | `--text-dim` | `#94a3b8` ❌ 2,3:1 | `#6E625A` | 5,9:1 |
| `text-accent` | `--accent` | `#0284c7` ❌ 3,7:1 | `#1F4FD1` (brand-700) | 6,8:1 |
| `text-success` | `--cga1` | `#059669` | `#256647` | 6,8:1 · 6,0:1 di tint hijau |
| `text-warning` | `--cga2` | `#d97706` | `#8F5716` | 5,9:1 |
| `text-danger` | `--cga3` | `#e11d48` | `#A7312A` | 6,7:1 |
| `text-info` | `--info` | — | `#2660DC` (brand-600) | 5,5:1 |

> `text-dim` sengaja disamakan dengan `text-muted`: di V1 `text-dim` dipakai untuk label nyata,
> dan warna pudar (`#A2968C`, 2,7:1) gagal AA. Warna pudar hanya untuk ikon dekoratif (`text-faint`).

### 2.2 Token baru V2

| Token | Hex | Dipakai untuk |
|---|---|---|
| `langit` | `#EAF1FB` | Ujung bawah latar |
| `faint` | `#A2968C` | **Dekoratif saja** (chevron, ikon kosong) — bukan teks |
| `line-strong` | `#948779` | Border input/checkbox (3,5:1, memenuhi kontras non-teks 3:1) |
| `brand-50` / `100` / `200` | `#EEF4FF` / `#DCE8FF` / `#BCD3FF` | Latar ikon, baris terpilih, area kisaran grafik |
| `brand-500` | `#2F6FE8` | Ujung terang gradasi tombol (teks putih 4,6:1) |
| `brand-600` | `#2660DC` | Garis grafik, info |
| `brand-700` | `#1F4FD1` | Ujung gelap gradasi, teks tautan (6,8:1) |
| `brand-800` | `#1E3FA6` | Angka bergradasi (`text-brand-gradient`) |
| `success-50` / `600` / `700` | `#EAF6EF` / `#2E7D55` / `#256647` | CGA1, berhasil. Teks kecil pakai `700` |
| `plum-50` / `500` / `700` | `#F4EFFB` / `#7650BD` / `#5A3A98` | Aksen sekunder (LPP, arah "tarik") — pengganti violet V1 |
| `faint` · `line-strong` · `langit` | lihat atas | Juga tersedia sebagai class `text-faint`, `border-line-strong`, `bg-langit` |
| `warning-50` / `100` / `500` / `700` | `#FDF4E3` / `#FAE6C2` / `#E39B2D` / `#8F5716` | CGA2, peringatan. **`500` hanya untuk titik/bar** (2,3:1) |
| `danger-50` / `500` / `700` | `#FCECE9` / `#D4483B` / `#A7312A` | CGA3, hapus, error. Teks kecil pakai `700` |

> Nama AYAMSMART → SmartWMS: kriuk → `warning`, sambal → `danger`, daun → `success`.
> Kebetulan cocok dengan warna semantik CGA V1 (CGA1 hijau, CGA2 kuning, CGA3 merah) — pertahankan.

### 2.3 Aturan

- Teks < 18px wajib ≥ 4,5:1 terhadap latarnya; teks ≥ 18px (atau ≥ 14px bold) ≥ 3:1.
- Border yang menandai kontrol (input, checkbox) ≥ 3:1. Garis pemisah baris boleh `line`.
- Cek kontras sebelum menambah warna baru; catat rasionya di tabel ini.
- Tombol utama: `bg-linear-to-br from-brand-500 to-brand-700 text-white`.

### 2.4 Dark mode (Tahap 5)

Bahasa visual sama dengan light (netral hangat, aksen biru, status hijau/kuning/merah), digelapkan
supaya **nyaman dilihat lama**: latar arang hangat (bukan hitam pekat atau biru-dongker), teks putih
gading (bukan `#fff`, kontras ±12:1 — cukup tajam tanpa silau), warna aksen diredam (bukan neon V1).

| Token | Dark V1 | **Dark V2** | Kontras di `surface` |
|---|---|---|---|
| `--bg` (canvas) | `#080e18` | `#161412` + gradasi sangat tipis | — |
| `--surface` | `#0d1524` | `#1E1B18` | — |
| `--surface-2` (panel) / `--surface-3` (field) | putih 3% / 6% | `#25211E` / `#2A2622` | — |
| `--border` / `--line-strong` | putih 8% | `#34302B` / `#7D7268` | dekoratif / 3,7:1 |
| `text-heading` / `text-body` | `#ffffff` / `#e2e8f0` | `#F1EAE2` / `#E4DCD2` | 14,4:1 / 12,6:1 |
| `text-muted` = `text-dim` | `#94a3b8` / `#64748b` ❌ | `#ABA095` | 6,7:1 |
| `text-accent` · `brand-700` | `#38bdf8` | `#96B4F4` | 8,3:1 |
| `text-success` (CGA1) | `#34d399` | `#86C9A2` | 8,9:1 |
| `text-warning` (CGA2) | `#fbbf24` | `#E2B26A` | 8,8:1 |
| `text-danger` (CGA3) | `#fb7185` | `#EE9A90` | 7,9:1 |
| `plum-700` | — | `#C2A8EB` | 8,2:1 |
| Tombol utama (gradasi `brand-500` → deep) | cyan → biru | `#3F6FD8` → `#3560C8` | teks putih 4,7–5,7:1 |

Skala `*-50/100/200` di dark = tint gelap (latar ikon, baris terpilih); `*-700/800` = teks terang.
Jadi `bg-brand-50 text-brand-700` benar di **kedua** tema.

---

## 3. Kaca (light & dark)

| Utilitas | Dipakai di | Isi |
|---|---|---|
| `glass` | Sidebar, panel mengambang | Putih 58%, `backdrop-blur 22px` + saturasi 170%, border putih tipis, bayangan hangat |
| `glass-bar` | Topbar, modal, toast, bar aksi bawah tabel | Lebih pekat (72%) |

- Fallback `@supports not (backdrop-filter: ...)` → putih hampir solid.
- **Dilarang** untuk: tabel, baris daftar, kartu statistik, layar Live Stock.
- Maksimal satu lapis kaca; isi di dalamnya solid.
- Bayangan selalu hangat: `rgb(74 52 30 / 0.08)`, bukan hitam.

**Latar aplikasi** `app-backdrop` (fixed, statis): light = cahaya peach kiri-atas + biru kanan-bawah
di atas gradasi Nasi `#FFF8F0` → Langit `#EAF1FB`; dark = versi yang sama dengan intensitas ±7%.
Tidak dianimasikan. Dark memakai kaca arang (`#1E1B18` 58%/72%).

---

## 4. Radius

Mengganti nilai token radius V1 (`--ui-radius-*`), class lama otomatis ikut.

| Token | Nilai | Class V1 yang terpetakan | Dipakai untuk |
|---|---|---|---|
| `rounded-hero` | 24px | — (baru) | Satu elemen utama per halaman |
| `rounded-panel` | 18px | `rounded-2xl` | Kartu, panel, modal |
| `rounded-row` | 12px | `rounded-xl` | Tombol kotak, input besar, item sidebar |
| `--ui-radius-md` | 10px | `rounded-lg` | Input, dropdown |
| `--ui-radius-sm` | 8px | `rounded-md` | Badge kecil, sel tabel |
| `rounded-full` | — | — | Tombol pil, segmented, chip |

> Lebih kecil dari AYAMSMART (28/22/14) karena layar desktop memuat banyak panel sekaligus.

---

## 5. Tipografi

Font: **Plus Jakarta Sans Variable** (`@fontsource-variable/plus-jakarta-sans`) untuk semua teks;
**JetBrains Mono Variable** (`@fontsource-variable/jetbrains-mono`) **hanya** untuk kode aset,
nomor seri, dan No SJ. Keduanya di-host sendiri.

| Peran | Ukuran | Kelas contoh |
|---|---|---|
| Angka utama (hero) | 48–64px | `text-[48px] lg:text-[64px] font-extrabold tracking-tight tabular-nums text-brand-gradient` |
| Judul halaman | 22–24px | `text-[22px] lg:text-[24px] font-bold tracking-tight` |
| Judul panel | 16px | `text-[16px] font-semibold` |
| Isi / form | 14px | `text-[14px]` |
| Sel tabel | 13px | `text-[13px] tabular-nums` |
| Keterangan, header kolom | **12px (minimum)** | `text-[12px] text-muted` |
| Angka statistik | 20–28px | `font-bold tabular-nums` |

- **Batas bawah 12px.** Token `--ui-fs-8` s.d. `--ui-fs-11` (294 class di V1) dinaikkan bertahap
  per halaman di Tahap 8 — bukan sekaligus, karena bisa merusak layout tabel.
- Input minimal 16px **hanya di layar sentuh** (`pointer: coarse`) agar iOS tidak auto-zoom.
- Sentence case. Header kolom tabel juga sentence case ("Kode aset", bukan "KODE ASET").
  Pengecualian: judul dokumen resmi di PDF ("SURAT JALAN").
- Angka & tanggal format Indonesia: `1.250`, `9,8%`, `Jum, 23 Okt 2026`.

---

## 6. Layout & Navigasi

Struktur V1 dipertahankan: **Sidebar kiri + Topbar**, konten utama di kanan.

| Elemen | Light V2 |
|---|---|
| Sidebar | `glass`, item aktif `bg-brand-50 text-brand-700` + `aria-current="page"` |
| Topbar | `glass-bar`, sticky |
| Konten | Latar `.app-backdrop`, kartu/tabel `bg-surface border border-line rounded-panel` |
| Tabel | Header `bg-panel text-muted text-[12px]`, baris hover `bg-brand-50/50`, garis `border-line` |
| Live Stock (TV) | Tanpa kaca & tanpa backdrop; ukuran `vmin`/`clamp` V1 dipertahankan |

---

## 7. Komponen (target V2)

Status: **akan dibuat** di Tahap 8 — belum ada di V1 kecuali disebut. Semua menerima `className`.

| Komponen | Catatan |
|---|---|
| `Button` | Varian `primary` (gradasi), `secondary` (putih + ring `brand-200`), `danger` (`danger-700`), `dangerSoft` (`danger-50` + teks `danger-700`), `plain`. Tinggi 40px desktop, 44px di `pointer: coarse` |
| `Panel` | `variant="hero"` untuk satu elemen utama per halaman |
| `Badge` | Selalu ada teks, tidak hanya warna. Badge CGA: titik warna + "CGA1" |
| `ConfirmDialog` | `<dialog>` bawaan (fokus terkunci, Esc = batal), `glass-bar`. Wajib untuk aksi tak bisa dibatalkan (hapus SJ, clear data) |
| `DialogError` | Error yang terjadi saat dialog terbuka ditampilkan **di dalam** dialog, bukan toast |
| `Toast` | Sukses / error saat tidak ada dialog; hilang 3,5 detik |
| `useLeaveGuard` | Wajib di form dengan status "belum disimpan" (Buat SJ, Rekap Alokasi) |
| Ikon | `lucide-react` (sudah dipakai V1), 16–20px, `currentColor` |

---

## 8. Grafik (Recharts)

- Garis/bar utama `brand-600`; per CGA pakai `success-600` / `warning-500` / `danger-500` + label teks.
- Grid `line`; teks sumbu 12px `text-muted`.
- Legenda ditulis manual di atas grafik. Animasi dimatikan (`isAnimationActive={false}`).

---

## 9. Aksesibilitas & Gerak

- `:focus-visible` global: outline 2px `brand-600`, offset 2px.
- Tombol ikon wajib `aria-label`.
- Status tidak hanya warna ("Naik 5%", "Belum dimutasi").
- Status **belum disimpan**: `danger-700` tebal + titik penanda.
- Tidak ada animasi otomatis. Gerak hanya respons aksi (`active:scale-[.97]`, toast muncul).
  Auto-cycle Live Stock adalah fungsi, bukan dekorasi — tetap boleh.

---

## 10. Gaya Bahasa UI

- Bahasa Indonesia sederhana, kalimat pendek, sentence case.
- Tombol menyebut hasilnya: "Simpan surat jalan", "Upload DAT", "Ekspor Excel".
- Pesan error/kosong memberi langkah berikutnya, tidak meminta maaf.
- Error DB diterjemahkan: unique → "Nama ini sudah dipakai"; masih dipakai → tawarkan "Nonaktifkan saja".

---

## 11. Perbedaan dari STYLEGUIDE AYAMSMART

| AYAMSMART | SmartWMS V2 | Alasan |
|---|---|---|
| Mode terang saja | Light + dark | Dark sudah dipakai pengguna V1 |
| Tab bar bawah (HP) | Sidebar + Topbar | Dipakai di PC kantor |
| Target sentuh 44px di semua elemen | 40px tombol desktop, 44px di layar sentuh; baris tabel boleh lebih rapat | Kepadatan tabel; WCAG 2.2 AA minimum 24px |
| Satu font | + JetBrains Mono untuk kode aset/serial | Kode aset harus mudah dibandingkan karakter per karakter |
| Body 16px, keterangan 13px | Body 14px, tabel 13px, minimum 12px | Data padat di layar desktop |
| Radius 28/22/14 | 24/18/12 | Banyak panel per layar |
| Kaca untuk panel & daftar | Kaca hanya bingkai; tabel solid | Ribuan baris + `backdrop-filter` berat di PC kantor |
| Nama kriuk / sambal / daun | `warning` / `danger` / `success` | Semantik sesuai domain gudang |

---

## 12. Implementasi (Tahap 5)

Semua di `src/app/globals.css`, urutan bagian 1–6 (komentar di file).

- **Token tema** di `:root, .light` dan `.dark` — satu-satunya tempat mengganti warna.
- **Palet lama dipetakan ke token.** Kode V1 memakai warna Tailwind untuk latar gelap
  (`text-cyan-300`, `bg-emerald-500/10`, `text-white/40`, `border-white/[0.06]`, …). Variabel
  palet Tailwind (`--color-cyan-*`, `--color-emerald-*`, `--color-slate-*`, `--color-white`, …)
  diarahkan ke peran token: cyan/sky/blue → brand, emerald/green/teal → success, amber/yellow/orange
  → warning, rose/red/pink → danger, violet/purple/indigo → plum, slate/gray → teks/muted,
  `white` → tinta (teks & garis), `black` → bayangan. ±1.500 class lama ikut tema tanpa disentuh.
- **Lapisan kompatibilitas** (bagian 5) menangani yang tidak bisa lewat variabel: latar hex gelap
  (`bg-[#0d1117]` → surface), `text-white/20…/50` → muted (opacity membuat teks gagal AA), kartu
  `bg-white/[0.02]` + border + rounded → kartu solid, border input → `line-strong`, overlay modal,
  dan teks putih di atas isi solid (tombol gradasi).
- **Kode baru**: pakai token (`bg-surface`, `text-muted`, `bg-brand-50 text-brand-700`,
  `rounded-panel`, `glass-bar`), bukan nama palet Tailwind, dan tanpa opacity pada teks.
- Bila sebuah halaman selesai dipindahkan ke token (Tahap 8), aturan kompatibilitas yang hanya
  dipakai halaman itu boleh dihapus — cek dengan `grep` dulu.
- **Audit kontras otomatis** (Tahap 5): 14 halaman × 2 tema, area layar 1440×900 — 0 teks di bawah
  ambang AA (V1: ±600 di light, ±290 di dark). Tombol bergradasi dicek manual (teks putih ≥ 4,6:1).

---

## 13. Warna custom per user (Tahap 9a, ARCHITECTURE D-37)

User bisa mengganti warna di **Warna tampilan** (`/pengaturan/tema`). Yang bisa diubah = token
dasar di §2 (latar, kartu, panel, isian, kaca, garis, judul, teks, keterangan, ikon samar, aksen,
tombol utama, CGA1/2/3, ungu). Turunan dihitung otomatis di `:root.theme-custom` (globals.css):

| Turunan | Rumus |
|---|---|
| `brand-50/100/200` | aksen 12% / 22% / 38% di atas `surface` |
| `brand-500` / `brand-700` | tombol utama / aksen |
| `*-50` status | warna status 12% di atas `surface` |
| Palet lama `solid`/`deep` | warna dasar dicampur hitam 75% / 60% |
| Gradasi latar | aksen 9% (kiri atas) + `langit` (kanan bawah) di atas `bg` |

Aturan untuk kode baru tetap sama (§12): pakai token, bukan warna hardcoded — warna hardcoded
tidak ikut tema custom. Kontras tidak dipaksa (pilihan user), tapi tema **bawaan** tetap wajib AA.
