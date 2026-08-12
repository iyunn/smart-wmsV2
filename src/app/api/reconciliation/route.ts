// ═══════════════════════════════════════════════════════════════════════════
// FILE : src/app/api/reconciliation/route.ts
// GUNA : membandingkan dua sumber data yang seharusnya berisi hal yang sama,
//        lalu menandai di mana keduanya tidak cocok.
//
// DUA SUMBER YANG DIBANDINGKAN:
//   assets_raw (DAT) = catatan resmi dari Oracle, sisi akuntansi
//   lpp_raw    (LPP) = catatan lapangan dari Web Tracking
// Keduanya dicocokkan lewat kode_asset sebagai penghubung.
//
// SIAPA YANG MEMANGGIL:
//   useReconciliation() di src/hooks/useReconciliation.ts,
//   yang dipakai halaman src/app/reconciliation/page.tsx
//
// KENAPA PERLU DIBANDINGKAN:
//   kalau sebuah barang tercatat di Oracle tapi tidak ada di Web Tracking
//   (atau sebaliknya), berarti ada mutasi yang belum dikerjakan di salah satu
//   sistem. Halaman ini yang memunculkan selisih itu supaya bisa ditindaklanjuti.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Reconciliation Engine — bandingkan DAT (assets_raw) vs LPP (lpp_raw) by
 * kode_asset, hasilkan 5 kondisi aktif (kondisi 3 "Aset Intransit" belum
 * diimplementasi, butuh data Report Intransit yang belum tersedia):
 *
 *   1. Ada di DAT & Ada di LPP & CGA sama    → Fisik di CGA (normal)
 *   2. Ada di DAT & Tidak di LPP             → Belum Mutasi Oracle (warning)
 *   4. Tidak di DAT & Ada di LPP             → Belum Mutasi WT (warning)
 *   5. Tidak di DAT & Tidak LPP              → Fisik Allocated (normal)
 *   6. Ada di DAT & Ada di LPP & CGA BEDA   → Mismatch CGA (warning)
 *
 * Universe pembanding untuk kondisi 5 dibatasi ke kode_asset yang PERNAH
 * tercatat di sistem (union DAT ∪ LPP ∪ surat_jalan_items.kode_asset).
 */

// ─── LOGIC pengambilan data bertahap — MULAI (baris 19-40) ─────────────────
// Pola yang sama persis dipakai di src/app/api/process/route.ts
// (fungsi fetchAllKodeAsset). Alasannya juga sama: Supabase hanya
// mengembalikan 1000 baris per permintaan, dan tidak memberi peringatan
// apa pun saat memotong. Tabel di sini bisa berisi ribuan baris.
//
// Bedanya dengan yang di api/process: fungsi ini dibuat lebih umum —
// nama tabel dan kolomnya dikirim sebagai parameter, jadi satu fungsi
// bisa dipakai untuk tiga tabel sekaligus.
async function fetchAll(table: string, columns: string) {
  let allData: any[] = [];
  let from = 0;
  const FETCH_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + FETCH_SIZE - 1);

    if (error) throw new Error(`${table}: ${error.message}`);

    const batch = data ?? [];
    allData = [...allData, ...batch];

    if (batch.length < FETCH_SIZE) break;
    from += FETCH_SIZE;
    if (from > 200000) break;
  }
  return allData;
}
// ─── LOGIC pengambilan data bertahap — SELESAI ─────────────────────────────

// assets_raw.toko menyimpan label panjang ("CGA1 - Cadangan General Affairs
// 1"), bukan kode singkat. lpp_raw.toko SUDAH bersih (diekstrak dari nama
// file saat upload). Extract kode singkat dari toko DAT supaya konsisten
// dengan LPP & badge UI (CGA_BADGE di halaman reconciliation hanya punya
// key "CGA1"/"CGA2"/"CGA3").
// ─── LOGIC penyeragam kode gudang — MULAI (baris 47-50) ────────────────────
// Catatan di atas menjelaskan masalahnya. Intinya: dua sumber menulis nama
// gudang dengan cara berbeda, jadi harus diseragamkan dulu sebelum
// dibandingkan. Tanpa ini, barang yang sebenarnya ada di gudang yang sama
// akan salah dianggap berbeda lokasi.
function extractCGACode(toko: string): string {
  const match = toko.match(/CGA\s*\d/i);
  return match ? match[0].replace(/\s+/g, "").toUpperCase() : toko;
}
// ─── LOGIC penyeragam kode gudang — SELESAI ────────────────────────────────

// ═══ LOGIC UTAMA PEMBANDING — MULAI (baris 52-144) ═════════════════════════
// Dipanggil browser lewat fetch GET ke /api/reconciliation.
export async function GET() {
  try {
    // ─── LANGKAH 1: ambil ketiga sumber SEKALIGUS ─────────────────────────
    // Promise.all menjalankan ketiga pengambilan data BERSAMAAN, bukan
    // bergantian. Kalau ditulis await satu per satu, waktunya berurutan
    // (misalnya 3 + 3 + 3 = 9 detik). Dengan cara ini cukup selama yang
    // paling lama saja (3 detik). Aman dilakukan karena ketiganya tidak
    // saling membutuhkan hasil satu sama lain.
    const [datRows, lppRows, sjRows] = await Promise.all([
      fetchAll("assets_raw", "kode_asset, toko, deskripsi"),
      fetchAll("lpp_raw", "kode_asset, toko, deskripsi"),
      fetchAll("surat_jalan_items", "kode_asset, jenis, merk"),
    ]);

    // ─── LANGKAH 2: susun data ke dalam Map ───────────────────────────────
    // INI BAGIAN YANG PALING MENENTUKAN KECEPATAN HALAMAN INI.
    //
    // Cara yang lambat — untuk tiap kode di DAT, telusuri seluruh isi LPP:
    //     datRows.forEach(d => lppRows.find(l => l.kode_asset === d.kode_asset))
    //   5.000 baris berarti 5.000 x 5.000 = 25 juta perbandingan.
    //
    // Cara yang dipakai di sini — data disusun dulu ke dalam Map,
    // lalu pencariannya cukup lppMap.get(kode) yang hampir seketika:
    //   5.000 baris cukup 5.000 langkah.
    //
    // Dalam istilah kuliah: dari O(n kuadrat) menjadi O(n).
    const datMap = new Map<string, { toko: string; deskripsi: string }>();
    for (const r of datRows) {
      if (r.kode_asset) datMap.set(r.kode_asset, { toko: extractCGACode(r.toko ?? ""), deskripsi: r.deskripsi ?? "" });
    }

    const lppMap = new Map<string, { toko: string; deskripsi: string }>();
    for (const r of lppRows) {
      if (r.kode_asset) lppMap.set(r.kode_asset, { toko: r.toko ?? "", deskripsi: r.deskripsi ?? "" });
    }

    // Barang yang pernah keluar lewat Surat Jalan juga ikut dikumpulkan.
    // Gunanya untuk memberi keterangan pada barang yang sudah tidak ada
    // di DAT maupun LPP — tanpa ini, keterangannya kosong dan pengguna
    // tidak tahu barang apa yang dimaksud.
    //
    // Syarat !sjDeskripsiMap.has() membuat hanya catatan PERTAMA yang dipakai,
    // karena satu barang bisa muncul di banyak Surat Jalan.
    const sjDeskripsiMap = new Map<string, string>();
    for (const r of sjRows) {
      if (r.kode_asset && !sjDeskripsiMap.has(r.kode_asset)) {
        const label = [r.jenis, r.merk].filter(Boolean).join(" - ");
        sjDeskripsiMap.set(r.kode_asset, label || "-");
      }
    }

    // ─── LANGKAH 3: kumpulkan semua kode yang pernah tercatat ─────────────
    // Tanda ... (spread) menggabungkan isi ketiga sumber jadi satu daftar.
    // Set otomatis membuang yang kembar, jadi tiap kode hanya muncul sekali.
    //
    // Daftar inilah yang nanti diperiksa satu per satu. Batasnya sengaja
    // hanya kode yang PERNAH tercatat di salah satu sumber — bukan seluruh
    // kemungkinan kode aset yang ada.
    // Universe: semua kode_asset yang pernah tercatat di salah satu sumber
    const universe = new Set<string>([
      ...datMap.keys(),
      ...lppMap.keys(),
      ...sjDeskripsiMap.keys(),
    ]);

    type ReconItem = {
      kode_asset: string;
      toko: string;      // CGA dari DAT (kondisi 1,2,6) atau LPP (kondisi 4) atau "-" (kondisi 5)
      tokoLPP: string | null; // CGA dari LPP, hanya diisi untuk kondisi 6 (mismatch)
      deskripsi: string;
      kondisi: 1 | 2 | 4 | 5 | 6;
      inDAT: boolean;
      inLPP: boolean;
    };

    const items: ReconItem[] = [];
    const summary = { kondisi1: 0, kondisi2: 0, kondisi4: 0, kondisi5: 0, kondisi6: 0 };

    // ─── LANGKAH 4: periksa tiap kode, tentukan kondisinya — MULAI ────────
    // Untuk tiap kode, pertanyaannya cuma dua: ada di DAT? ada di LPP?
    // Dari dua pertanyaan itu muncul empat kemungkinan, dan salah satunya
    // (ada di dua-duanya) masih dipecah lagi berdasarkan lokasi gudangnya.
    //
    // Ringkasan kondisinya ada di keterangan paling atas file ini.
    for (const kode of universe) {
      const dat = datMap.get(kode);
      const lpp = lppMap.get(kode);
      const inDAT = !!dat;
      const inLPP = !!lpp;

      let kondisi: 1 | 2 | 4 | 5 | 6;
      let toko = "";
      let tokoLPP: string | null = null;
      let deskripsi = "";

      // Ada di dua-duanya. Masih perlu dicek: gudangnya sama atau tidak?
      if (inDAT && inLPP) {
        toko = dat!.toko;
        deskripsi = dat!.deskripsi;
        if (dat!.toko === lpp!.toko) {
          // CGA sama di DAT dan LPP — normal
          kondisi = 1;
          summary.kondisi1++;
        } else {
          // CGA BEDA antara DAT dan LPP — mismatch, perlu investigasi
          kondisi = 6;
          tokoLPP = lpp!.toko; // simpan CGA sisi LPP untuk ditampilkan di UI
          summary.kondisi6++;
        }
      // Ada di Oracle tapi tidak ada di Web Tracking → mutasi WT belum dikerjakan.
      } else if (inDAT && !inLPP) {
        kondisi = 2; toko = dat!.toko; deskripsi = dat!.deskripsi;
        summary.kondisi2++;
      // Ada di Web Tracking tapi tidak ada di Oracle → mutasi Oracle belum dikerjakan.
      } else if (!inDAT && inLPP) {
        kondisi = 4; toko = lpp!.toko; deskripsi = lpp!.deskripsi;
        summary.kondisi4++;
      // Tidak ada di dua-duanya, tapi kodenya pernah muncul di Surat Jalan.
      // Artinya barang sudah keluar dari gudang — ini kondisi normal,
      // bukan masalah. Keterangannya diambil dari catatan Surat Jalan tadi.
      } else {
        kondisi = 5; toko = "-"; deskripsi = sjDeskripsiMap.get(kode) ?? "-";
        summary.kondisi5++;
      }

      items.push({ kode_asset: kode, toko, tokoLPP, deskripsi, kondisi, inDAT, inLPP });
    }
    // ─── LANGKAH 4 — SELESAI ──────────────────────────────────────────────

    // summary berisi jumlah tiap kondisi, dipakai untuk kartu ringkasan di layar.
    // items berisi rincian tiap barang, dipakai untuk tabelnya.
    return NextResponse.json({ summary, items, totalUniverse: universe.size });
  } catch (err) {
    console.error("[reconciliation]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
// ═══ LOGIC UTAMA PEMBANDING — SELESAI ══════════════════════════════════════
