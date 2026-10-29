# STYLEGUIDE — SmartWMS V2

> Panduan tampilan V2. Tailwind CSS v4, token di `src/app/globals.css`, tanpa component library.
> Dibuat: 30 Oktober 2026. Keputusan: `ARCHITECTURE.md` D-15, D-16.
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
6. **Dua tema.** Light memakai panduan ini; dark tetap memakai palet V1 (§2.4).

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
| `text-success` | `--cga1` | `#059669` | `#2E7D55` | 5,0:1 |
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
| `success-50` / `600` | `#EAF6EF` / `#2E7D55` | CGA1, berhasil |
| `warning-50` / `100` / `500` / `700` | `#FDF4E3` / `#FAE6C2` / `#E39B2D` / `#8F5716` | CGA2, peringatan. **`500` hanya untuk titik/bar** (2,3:1) |
| `danger-50` / `500` / `700` | `#FCECE9` / `#D4483B` / `#A7312A` | CGA3, hapus, error. Teks kecil pakai `700` |

> Nama AYAMSMART → SmartWMS: kriuk → `warning`, sambal → `danger`, daun → `success`.
> Kebetulan cocok dengan warna semantik CGA V1 (CGA1 hijau, CGA2 kuning, CGA3 merah) — pertahankan.

### 2.3 Aturan

- Teks < 18px wajib ≥ 4,5:1 terhadap latarnya; teks ≥ 18px (atau ≥ 14px bold) ≥ 3:1.
- Border yang menandai kontrol (input, checkbox) ≥ 3:1. Garis pemisah baris boleh `line`.
- Cek kontras sebelum menambah warna baru; catat rasionya di tabel ini.
- Tombol utama: `bg-linear-to-br from-brand-500 to-brand-700 text-white`.

### 2.4 Dark mode

Nilai dark **tetap seperti V1** (`--ui-dark-*` di `globals.css`): bg `#080e18`, surface `#0d1524`,
aksen `#38bdf8`, CGA1 `#34d399`, CGA2 `#fbbf24`, CGA3 `#fb7185`. Kaca & latar gradasi **hanya di light**.

---

## 3. Kaca (Light saja)

| Utilitas | Dipakai di | Isi |
|---|---|---|
| `glass` | Sidebar, panel mengambang | Putih 58%, `backdrop-blur 22px` + saturasi 170%, border putih tipis, bayangan hangat |
| `glass-bar` | Topbar, modal, toast, bar aksi bawah tabel | Lebih pekat (72%) |

- Fallback `@supports not (backdrop-filter: ...)` → putih hampir solid.
- **Dilarang** untuk: tabel, baris daftar, kartu statistik, layar Live Stock.
- Maksimal satu lapis kaca; isi di dalamnya solid.
- Bayangan selalu hangat: `rgb(74 52 30 / 0.08)`, bukan hitam.

**Latar aplikasi** `.app-backdrop` (fixed, statis, light saja): cahaya peach kiri-atas + biru
kanan-bawah di atas gradasi Nasi `#FFF8F0` → Langit `#EAF1FB`. Tidak dianimasikan.

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

Status: **akan dibuat** di Tahap 5/8 — belum ada di V1 kecuali disebut. Semua menerima `className`.

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
