// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/lib/classifier.ts
// GUNA: menebak JENIS dan MERK barang dari kolom deskripsi file DAT Oracle.
//
// DIPANGGIL OLEH : classifyAsset() dipakai di src/app/api/process/route.ts
//                 (fungsi POST, saat upload DAT diproses per 500 baris)
// MEMANGGIL      : tidak memanggil file lain — murni logika, tanpa database.
// SUMBER ATURAN : parameter keywordRules, diambil pemanggil dari tabel
//                 keyword_rules di Supabase. Jadi aturan bisa ditambah user
//                 lewat halaman Classification TANPA mengubah kode ini.
// ═══════════════════════════════════════════════════════════════════════════
import type { KeywordRule } from './reviewTypes'

export const NO_MERK_VALUE = 'Non-Merk'

// ─── LOGIC normalisasi teks — MULAI (baris 5-11) ───────────────────────────
// Menyeragamkan deskripsi sebelum dicocokkan, supaya beda penulisan tetap cocok.
//   "DVR-16/CH  Dahua"  →  "dvr 16 ch dahua"
// Rantai .replace() berurutan: hasil satu jadi masukan berikutnya.
//   /[-/.,]/g  → semua tanda hubung, garis miring, titik, koma jadi spasi
//   /\s+/g     → spasi berturut-turut dijadikan satu ("\s+" = 1 atau lebih spasi)
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[-/.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
// ─── LOGIC normalisasi teks — SELESAI ──────────────────────────────────────

// ═══ LOGIC KLASIFIKASI DUA TAHAP — MULAI (baris 13-72) ═════════════════════
// Masukan : description = kolom "Keterangan" dari DAT, mis. "DVR 16 CH DAHUA"
//           keywordRules = daftar aturan dari tabel keyword_rules
// Keluaran: objek berisi jenis, merk, dan confidence (high/medium/low)
export function classifyAsset(description: string, keywordRules: KeywordRule[] = []) {
  const normalized = normalizeText(description)

  let jenis = 'Unknown'
  let merk  = 'Unknown'
  const kategori = 'Unknown'

// ─── TAHAP 1: cari jenis & merk spesifik — MULAI (baris 22-37) ─────────────
// Aturan bertipe no_merk SENGAJA dilewati di tahap ini (lihat baris 23).
  // ── Pass 1: jenis + merk spesifik dulu (skip no_merk) ──────────────────
  // Priority: rule merk spesifik selalu menang atas no_merk
  for (const rule of keywordRules) {
    if (rule.rule_type === 'no_merk') continue

    const normalizedKeyword = normalizeText(rule.keyword)
    // Spasi pembungkus di kiri-kanan adalah KUNCI ketepatan pencocokan.
    // Tanpa spasi: "ac" akan cocok dengan "rack" dan "vacuum" → salah.
    // Dengan spasi: yang dicari " ac " → hanya cocok kalau berdiri sebagai kata.
    const toSearch = ` ${normalized} `
    const toFind   = ` ${normalizedKeyword} `
    if (!toSearch.includes(toFind)) continue

    // Syarat "&& jenis === Unknown" membuat ATURAN PERTAMA YANG COCOK MENANG.
    // Kalau sudah terisi, aturan berikutnya tidak menimpanya.
    if (rule.rule_type === 'jenis' && jenis === 'Unknown') {
      jenis = rule.value
    } else if (rule.rule_type === 'merk' && merk === 'Unknown') {
      merk = rule.value
    }

    // Berhenti lebih awal begitu jenis DAN merk sama-sama ketemu —
    // tidak perlu memeriksa ratusan aturan sisanya.
    if (jenis !== 'Unknown' && merk !== 'Unknown') break
  }
  // ─── TAHAP 1 — SELESAI ───────────────────────────────────────────────────

  // ─── TAHAP 2: cadangan no_merk — MULAI (baris 42-54) ─────────────────────
  // Hanya berjalan kalau merk MASIH kosong setelah Tahap 1.
  //
  // INI ALASAN KENAPA HARUS DUA TAHAP:
  //   "DVR"            → Tahap 1 tidak dapat merk → Tahap 2 jalan → Non-Merk  ✓
  //   "DVR 16 CH Dahua"→ Tahap 1 dapat merk Dahua → Tahap 2 DILEWATI   ✓
  // Kalau semua aturan diperiksa dalam SATU putaran, urutan data bisa membuat
  // "DVR" (no_merk) menang duluan dan merk Dahua terlewat.
  // ── Pass 2: no_merk sebagai fallback — hanya kalau merk masih Unknown ──
  // Contoh: "DVR" → no_merk. "DVR 16 CH Dahua" → merk Dahua menang di Pass 1,
  // Pass 2 tidak dieksekusi karena merk sudah resolved.
  if (merk === 'Unknown') {
    for (const rule of keywordRules) {
      if (rule.rule_type !== 'no_merk') continue

      const normalizedKeyword = normalizeText(rule.keyword)
      const toSearch = ` ${normalized} `
      const toFind   = ` ${normalizedKeyword} `
      if (toSearch.includes(toFind)) {
        merk = NO_MERK_VALUE
        break
      }
    }
  }
  // ─── TAHAP 2 — SELESAI ───────────────────────────────────────────────────

  // ─── LOGIC tingkat keyakinan — MULAI (baris 56-61) ───────────────────────
  // high   = jenis & merk ketemu dua-duanya
  // medium = hanya jenis yang ketemu
  // low    = dua-duanya gagal → baris ini muncul di halaman Classification
  //          (src/app/review/page.tsx) untuk dikoreksi manual oleh user.
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (jenis !== 'Unknown' && merk !== 'Unknown') {
    confidence = 'high'
  } else if (jenis !== 'Unknown') {
    confidence = 'medium'
  }
  // ─── LOGIC tingkat keyakinan — SELESAI ───────────────────────────────────

  // Hasil ini dipakai pemanggil (api/process/route.ts) untuk mengisi kolom
  // jenis, merk, dan confidence di tabel assets_clean.
  return {
    original_description: description,
    normalized_description: normalized,
    jenis,
    merk,
    kategori,
    kategori_nama: 'Unknown',
    confidence,
  }
}
// ═══ LOGIC KLASIFIKASI DUA TAHAP — SELESAI ═════════════════════════════════
