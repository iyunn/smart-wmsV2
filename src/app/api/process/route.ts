// ═══════════════════════════════════════════════════════════════════════════
// FILE : src/app/api/process/route.ts
// GUNA : upload DAT. Semua yang benar-benar menulis database terjadi di sini, di sisi server.
//
// SIAPA YANG MEMANGGIL:
//   sendBatch() di src/lib/batchProcessor.ts, lewat fetch POST ke /api/process.
//   Dipanggil berulang — satu kali untuk tiap kelompok 500 baris.
//
// FILE INI MEMANGGIL:
//   - classifyAsset()  dari src/lib/classifier.ts  (menebak jenis & merk)
//   - supabase         dari src/lib/supabaseClient.ts (koneksi database)
//
// KENAPA DIKERJAKAN DI SERVER, BUKAN DI BROWSER:
//   kunci database tidak boleh sampai ke browser. Semua yang menyentuh
//   database dikerjakan di sini; halaman hanya bicara lewat fetch.
//
// URUTAN KERJANYA (lihat penanda angka 1-7 di dalam fungsi POST):
//   1. ambil aturan klasifikasi   5. simpan hasil klasifikasi
//   2. klasifikasi tiap baris     6. kembalikan tanda "Allocated"
//   3. simpan data mentah         7. bersihkan catatan usang + sinkron staging
//   4. petakan kode ke id
// Langkah 6 dan 7 hanya dijalankan pada kelompok TERAKHIR.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server'
import { classifyAsset } from '@/lib/classifier'
import { supabase } from '@/lib/supabaseClient'

// Supabase PostgREST membatasi default 1000 baris per query. Untuk tabel
// yang bisa lebih besar dari itu (assets_raw bisa 4000-5000+ baris), WAJIB
// pakai pagination loop — query tanpa .range() akan diam-diam truncate ke
// 1000 baris pertama tanpa error, menyebabkan data parsial dianggap lengkap.
// (Root cause bug 18 Juni: auto-clear asset_notes salah hapus 8/10 catatan
// karena query assets_raw.kode_asset cuma dapat ~1000 dari 4666 baris.)
// ─── LOGIC pengambilan data bertahap (pagination) — MULAI (baris 11-34) ────
// Catatan di atas sudah menjelaskan alasannya. Yang perlu diingat saat membaca:
// pola while + .range() ini muncul di beberapa file lain juga —
// fetchKodeAssetCGASet() di bawah, fetchAll() di api/reconciliation/route.ts,
// dan perulangan serupa di api/stock/live serta api/dashboard/stats.
// Semua memakai batas 1000 baris per putaran, berhenti kalau hasilnya kurang
// dari 1000 (berarti sudah habis).
async function fetchAllKodeAsset(): Promise<Set<string>> {
  let allKodes: string[] = []
  let from = 0
  const FETCH_SIZE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('assets_raw')
      .select('kode_asset')
      .range(from, from + FETCH_SIZE - 1)

    if (error) throw new Error(error.message)

    const batch = data ?? []
    allKodes = [...allKodes, ...batch.map((r: any) => r.kode_asset)]

    if (batch.length < FETCH_SIZE) break
    from += FETCH_SIZE
    if (from > 200000) break // safety guard
  }

  return new Set(allKodes)
}

// ─── LOGIC pengambilan data bertahap — SELESAI ─────────────────────────────
// Ekstrak kode CGA dari field toko: "CGA1 – ..." → "CGA1"
// ─── LOGIC pembaca kode gudang — MULAI (baris 36-39) ───────────────────────
// Mengambil kode gudang dari nama toko, apa pun cara penulisannya:
//   "CGA1 GUDANG UTAMA" → "CGA1"
//   "cga2"             → "CGA2"
// Pola /CGA\d/i artinya: huruf CGA diikuti satu angka, tanpa peduli
// huruf besar atau kecil (itu guna penanda "i" di akhir).
function extractCGA(toko: string): string {
  const m = (toko ?? "").match(/CGA\d/i)
  return m ? m[0].toUpperCase() : ""
}
// ─── LOGIC pembaca kode gudang — SELESAI ───────────────────────────────────

// Ambil semua kode_asset yang berlokasi di CGA (toko mengandung CGA1/2/3).
// Dipakai untuk auto-sync staging → asset_notes saat upload DAT.
// Pakai pagination loop (assets_raw bisa >1000 baris, jangan pakai select polos).
async function fetchKodeAssetCGASet(): Promise<Set<string>> {
  const cgaKodes = new Set<string>()
  let from = 0
  const FETCH_SIZE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('assets_raw')
      .select('kode_asset, toko')
      .range(from, from + FETCH_SIZE - 1)

    if (error) throw new Error(error.message)

    const batch = data ?? []
    for (const r of batch) {
      if ((r as any).kode_asset && extractCGA((r as any).toko)) {
        cgaKodes.add((r as any).kode_asset)
      }
    }

    if (batch.length < FETCH_SIZE) break
    from += FETCH_SIZE
    if (from > 200000) break
  }

  return cgaKodes
}

// Auto-sync staging_area → asset_notes.
// Untuk tiap item staging yang punya kode_asset & ada di CGA (DAT terbaru):
// pindahkan catatan ke asset_notes, lalu hapus item dari staging.
// ═══ LOGIC PEMINDAH CATATAN DARI RUANG TUNGGU — MULAI (baris 75-109) ═══════
// Bagian ini menghubungkan dua alur yang kelihatannya terpisah:
//
//   Barang dikembalikan dari toko
//      → dicatat lewat Surat Jalan Penerimaan (halaman /sj/masuk)
//      → masuk ke Staging Area, petugas menulis catatan kondisi barangnya
//      → saat DAT baru diunggah dan kode asetnya sudah muncul di sana:
//           catatannya dipindahkan ke tabel asset_notes (tampil di Monitoring)
//           barisnya dihapus dari Staging Area
//
// Jadi Staging Area itu semacam ruang tunggu: untuk barang yang secara fisik
// sudah kembali, tapi belum tercatat di Oracle.
async function syncStagingToNotes(): Promise<number> {
  const { data: stagingItems } = await supabase
    .from('staging_area')
    .select('id, kode_asset, catatan')
    .not('kode_asset', 'is', null)
    .neq('kode_asset', '')

  if (!stagingItems || stagingItems.length === 0) return 0

  const cgaSet = await fetchKodeAssetCGASet()
  const idsToDelete: string[] = []

  for (const item of stagingItems) {
    if (!cgaSet.has((item as any).kode_asset)) continue

    // Catatan yang kosong tidak perlu dipindahkan — barisnya tetap dihapus
    // dari ruang tunggu karena barangnya memang sudah tercatat di DAT.
    if ((item as any).catatan && (item as any).catatan.trim()) {
      await supabase
        .from('asset_notes')
      // .upsert() = perbarui kalau kode asetnya sudah ada, buat baru kalau belum.
      // onConflict menentukan kolom mana yang dipakai untuk mengecek "sudah ada".
        .upsert(
          { kode_asset: (item as any).kode_asset, catatan: (item as any).catatan, updated_at: new Date().toISOString() },
          { onConflict: 'kode_asset' }
        )
    }
    idsToDelete.push((item as any).id)
  }

  // Penghapusan dilakukan per 500 id sekaligus, bukan satu per satu.
  // .in() menerima daftar id — satu perintah untuk banyak baris.
  if (idsToDelete.length > 0) {
    for (let i = 0; i < idsToDelete.length; i += 500) {
      const batch = idsToDelete.slice(i, i + 500)
      await supabase.from('staging_area').delete().in('id', batch)
    }
  }

  return idsToDelete.length
}
// ═══ LOGIC PEMINDAH CATATAN DARI RUANG TUNGGU — SELESAI ════════════════════

// ═══ TITIK MASUK PERMINTAAN DARI BROWSER — MULAI (baris 111-344) ═══════════
// Nama fungsi POST dikenali otomatis oleh Next.js sebagai penangan permintaan
// HTTP POST ke alamat /api/process. Tidak perlu daftar rute secara manual.
//
// Yang dikirim pengirim (batchProcessor.ts):
//   data        = 500 baris hasil urai file
//   isLastBatch = penanda kelompok terakhir, untuk langkah 6 dan 7
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { data, isLastBatch } = body

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'No data provided' })
    }

    // Aturan diambil SEKALI untuk seluruh kelompok, bukan per baris.
    // Kalau diambil per baris, satu kelompok berarti 500 kali query ke database.
    // ── 1. Fetch keyword_rules sekali ─────────────────────────────────────────
    const { data: keywordRules, error: rulesError } = await supabase
      .from('keyword_rules')
      .select('keyword, rule_type, value')

    if (rulesError) {
      return NextResponse.json({ success: false, error: 'Failed to fetch keyword rules' })
    }

    // Semua pengolahan di langkah ini terjadi di memori, belum menyentuh database.
    // Tiap baris menghasilkan dua bagian:
    //   raw    = data mentah apa adanya   → nanti masuk tabel assets_raw
    //   result = hasil tebakan classifier → nanti masuk tabel assets_clean
    // ── 2. Classify semua data di memory ──────────────────────────────────────
    const classifiedData = data.map((item: any) => ({
      raw: {
        kode_asset:      item.kode_asset,
        deskripsi:       item.deskripsi,
        toko:            item.toko,
        kategori_oracle: item.kategori_oracle,
        status:          item.status,
        kuantitas:       item.kuantitas       ?? 1,
        biaya_perolehan: item.biaya_perolehan ?? 0,
        jumlah_tercatat: item.jumlah_tercatat ?? 0,
        invoice_number:  item.invoice_number  ?? null,
        tanggal_dokumen: item.tanggal_dokumen ?? null,
        // Penentu produk khusus (prodsus), sama seperti di txtParser.
        // Diulang di sini sebagai pengaman, kalau-kalau data datang dari
        // sumber lain yang belum melewati parser.
        sub_coce:        (item.sub_coce ?? '0').toString().trim() || '0',
        is_prodsus:      !/^0*$/.test((item.sub_coce ?? '0').toString().trim() || '0'),
      },
      result: classifyAsset(item.deskripsi, keywordRules ?? []),
    }))

    // ─── LANGKAH 3: simpan data mentah — MULAI ──────────────────────────
    // Dua tabel dipakai, dan ini disengaja:
    //   assets_raw   = salinan asli dari Oracle, tidak pernah diubah
    //   assets_clean = hasil klasifikasi, boleh dihitung ulang kapan saja
    // Dengan begitu, kalau aturan klasifikasi diperbaiki, hasilnya bisa disusun
    // ulang dari assets_raw tanpa perlu mengunggah file lagi.
    // ── 3. Batch insert assets_raw (500 rows per batch) ─────────────────────
    // DELETE sudah dilakukan sekali via POST /api/process/clear
    // sebelum batch pertama dikirim dari UploadSection.tsx.
    const BATCH_SIZE = 500
    // Set uploaded_at eksplisit dengan SATU timestamp untuk semua batch —
    // samakan mekanisme dengan LPP (yang set new Date().toISOString() saat
    // insert). Tanpa ini, DAT mengandalkan default DB now() yang beda per
    // batch → timestamp freshness DAT tidak akurat/tidak sinkron dengan LPP.
    const uploadedAt = new Date().toISOString()
    const rawRows = classifiedData.map(({ raw }: any) => ({ ...raw, uploaded_at: uploadedAt }))

    let allInsertedRaw: { id: string; kode_asset: string }[] = []

    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
      const batch = rawRows.slice(i, i + BATCH_SIZE)
      const { data: batchResult, error: rawError } = await supabase
        .from('assets_raw')
        .insert(batch)
        .select('id, kode_asset')

      if (rawError) {
        console.error(`[route] assets_raw insert error batch ${i}:`, rawError)
        return NextResponse.json({ success: false, error: rawError.message })
      }

      allInsertedRaw = [...allInsertedRaw, ...(batchResult ?? [])]
    }

    // ─── LANGKAH 4: hubungkan kedua tabel ───────────────────────────────
    // assets_clean perlu tahu baris mentah mana pasangannya. Setelah data
    // mentah tersimpan, database memberi id untuk tiap baris — id itu
    // dikumpulkan ke dalam Map supaya pencarian pasangannya cepat.
    // ── 4. Map kode_asset → raw_id ────────────────────────────────────────────
    const rawIdMap = new Map<string, string>()
    for (const row of allInsertedRaw) {
      rawIdMap.set(row.kode_asset, row.id)
    }

    // ── 5. Batch insert assets_clean (500 rows per batch) ────────────────────
    // .filter(Boolean) di akhir membuang baris yang tidak dapat pasangan.
    // Ini cara ringkas untuk menyaring nilai null dari array.
    const cleanRows = classifiedData
      .map(({ raw, result }: any) => {
        const rawId = rawIdMap.get(raw.kode_asset)
        if (!rawId) return null
        return {
          raw_id:                 rawId,
          original_description:   result.original_description,
          normalized_description: result.normalized_description,
          jenis:                  result.jenis,
          merk:                   result.merk,
          kategori:               result.kategori,
          confidence:             result.confidence,
          status:                 raw.status,
        }
      })
      .filter(Boolean)

    for (let i = 0; i < cleanRows.length; i += BATCH_SIZE) {
      const batch = cleanRows.slice(i, i + BATCH_SIZE)
      const { error: cleanError } = await supabase
        .from('assets_clean')
        .insert(batch)

      // Kegagalan di sini sengaja tidak menghentikan proses. Data mentahnya
      // sudah aman tersimpan, dan hasil klasifikasi bisa disusun ulang nanti
      // lewat halaman Classification.
      if (cleanError) {
        console.error(`[route] assets_clean insert error batch ${i}:`, cleanError)
        // Tidak fatal — raw sudah tersimpan, clean bisa di-reclassify nanti
      }
    }

    // ── 6. Re-apply tag "Allocated" berdasarkan surat_jalan_items ───────────
    // DAT full-replace menghapus assets_clean via CASCADE, sehingga tag
    // "Allocated" ikut hilang. Step ini me-restore tag untuk kode_asset yang
    // sudah pernah diinput di Rekap Alokasi — tanpa ini user harus input ulang
    // setiap kali upload DAT baru.
    // PENTING: hanya jalan di batch TERAKHIR, karena baru di titik itu semua
    // batch sebelumnya sudah commit ke DB — re-apply tag di tengah upload
    // tidak ada gunanya (sebagian besar assets_clean belum ada).
    if (isLastBatch) {
      // Ambil kode_asset + jenis + tanggal via join ke surat_jalan.
      // Satu kode_asset bisa muncul berkali-kali (keluar → masuk → keluar lagi).
      // Yang menentukan tag adalah transaksi TERAKHIR (tanggal terbaru):
      //   - terakhir 'keluar' → barang sedang keluar CGA → tag Allocated
      //   - terakhir 'masuk'  → barang sudah balik ke CGA → JANGAN tag
      // Tanpa ini, barang yang keluar-lalu-balik akan salah ter-tag Allocated
      // padahal fisiknya sudah kembali (bug konflik keluar/masuk).
      const { data: allocRows } = await supabase
        .from('surat_jalan_items')
        .select('kode_asset, sj:surat_jalan!inner(tanggal, jenis, created_at)')
        .not('kode_asset', 'is', null)

      if (allocRows && allocRows.length > 0) {
        // Reduce ke transaksi terakhir per kode_asset.
        // Tie-breaker kalau tanggal sama: created_at (biar deterministik).
        const latestByKode = new Map<string, { tanggal: string; jenis: string; createdAt: string }>()
        for (const row of (allocRows as any[])) {
          const kode = row.kode_asset
          const sj = Array.isArray(row.sj) ? row.sj[0] : row.sj
          if (!kode || !sj) continue
          const tanggal = sj.tanggal ?? ''
          const jenis = sj.jenis ?? 'keluar'
          const createdAt = sj.created_at ?? ''

          const prev = latestByKode.get(kode)
          const isNewer = !prev
            || tanggal > prev.tanggal
            || (tanggal === prev.tanggal && createdAt > prev.createdAt)
          if (isNewer) {
            latestByKode.set(kode, { tanggal, jenis, createdAt })
          }
        }

        // Hanya kode_asset yang transaksi terakhirnya 'keluar' yang di-tag Allocated
        const allocatedKodes = [...latestByKode.entries()]
          .filter(([, v]) => v.jenis === 'keluar')
          .map(([kode]) => kode)

        const MATCH_CHUNK = 200
        let rawIdsToTag: string[] = []

        for (let i = 0; i < allocatedKodes.length; i += MATCH_CHUNK) {
          const kodeChunk = allocatedKodes.slice(i, i + MATCH_CHUNK)
          const { data: matchedRaw } = await supabase
            .from('assets_raw')
            .select('id')
            .in('kode_asset', kodeChunk)

          rawIdsToTag = [...rawIdsToTag, ...(matchedRaw ?? []).map((r: any) => r.id)]
        }

        const uniqueRawIds = [...new Set(rawIdsToTag)]

        // Batch update assets_clean tag = 'Allocated' (500 per batch)
        for (let i = 0; i < uniqueRawIds.length; i += BATCH_SIZE) {
          const batch = uniqueRawIds.slice(i, i + BATCH_SIZE)
          await supabase
            .from('assets_clean')
            .update({ tag: 'Allocated' })
            .in('raw_id', batch)
        }
      }
    }

    // ── 7. Auto-clear asset_notes untuk aset yang sudah keluar CGA ───────────
    // Prinsip: catatan valid SELAMA aset tidak pernah meninggalkan CGA.
    // Kalau kode_asset di asset_notes TIDAK ada di DAT baru, berarti aset
    // sudah keluar/mutasi → catatan dianggap selesai siklusnya → hapus.
    // Kalau aset balik lagi 6 bulan kemudian, itu siklus baru tanpa catatan basi.
    //
    // PENTING: hanya jalan di batch TERAKHIR — di titik ini semua batch
    // sudah commit, assets_raw berisi data lengkap. Pakai fetchAllKodeAsset()
    // (pagination loop) BUKAN query .select() polos — assets_raw bisa
    // >1000 baris dan Supabase diam-diam truncate ke 1000 tanpa error
    // (root cause bug 18 Juni, lihat komentar di definisi fetchAllKodeAsset).
    if (isLastBatch) {
      const currentKodeSet = await fetchAllKodeAsset()

      const { data: allNotes } = await supabase
        .from('asset_notes')
        .select('kode_asset')

      if (allNotes && allNotes.length > 0) {
        const staleKodes = allNotes
          .map((n: any) => n.kode_asset)
          .filter((k: string) => !currentKodeSet.has(k))

        if (staleKodes.length > 0) {
          for (let i = 0; i < staleKodes.length; i += BATCH_SIZE) {
            const batch = staleKodes.slice(i, i + BATCH_SIZE)
            await supabase
              .from('asset_notes')
              .delete()
              .in('kode_asset', batch)
          }
        }
      }

      // ── Auto-sync staging → asset_notes ──────────────────────────────────
      // DAT terbaru sudah lengkap di titik ini. Kalau ada item staging yang
      // kode_asset-nya sekarang muncul di DAT (lokasi CGA), pindahkan catatan
      // ke asset_notes lalu hapus dari staging. Best-effort — kalau gagal,
      // upload DAT tetap sukses (item staging tetap aman untuk sync manual).
      try {
        await syncStagingToNotes()
      } catch (e) {
        console.error('[route] auto-sync staging gagal:', e)
      }
    }

    // Jawaban dikirim balik ke sendBatch() di batchProcessor.ts.
    // preview berisi 5 contoh hasil klasifikasi, ditampilkan di layar upload
    // supaya pengguna bisa langsung melihat apakah tebakannya masuk akal.
    return NextResponse.json({
      success:  true,
      inserted: allInsertedRaw.length,
      preview:  classifiedData.slice(0, 5).map(({ result }: any) => result),
    })

  // Semua kesalahan tak terduga ditangkap di sini dan dibalas sebagai 500.
  // Ini yang membuat sendBatch() mencoba ulang sekali — sesuai aturannya,
  // hanya kesalahan 5xx yang layak diulang.
  } catch (error) {
    console.error('[route] error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
// ═══ TITIK MASUK PERMINTAAN DARI BROWSER — SELESAI ═════════════════════════
