// ═══════════════════════════════════════════════════════════════════════════
// FILE: src/lib/batchProcessor.ts
// GUNA: memecah ribuan baris DAT jadi kelompok 500, lalu mengirimnya
//       satu per satu ke server.
//
// DIPANGGIL OLEH : startPipeline() di src/components/UploadSection.tsx
// MEMANGGIL      : fetch POST ke /api/process
//                  → src/app/api/process/route.ts  fungsi POST()
// KONSTANTA      : BATCH_SIZE = 500, diambil dari src/lib/types.ts
//
// KENAPA HARUS DIPECAH: file DAT bisa berisi 5.000 baris. Dikirim sekaligus
// akan kena batas ukuran permintaan HTTP dan berisiko timeout.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * batchProcessor.ts
 * Membagi array AssetRecords menjadi beberapa bagian sebanyak BATCH_SIZE dan mengirimkan setiap bagiannya
 * sebagian data akan dikirim melalui POST ke /api/process secara berurutan.
 *
 * Design decisions:
 * - Berurutan (bukan paralel) untuk menghindari membebani server API.
 * - Caller menerima live progres melalui callback onProgress.
 * - Kegagalan setiap batch dicatat tetapi TIDAK menghentikan seluruh proses —
 *   Pemanggil dapat memeriksa failedBatches di ringkasan.
 * - Percobaan ulang per batch (1 percobaan ulang otomatis pada 5xx) mengurangi ketidakstabilan.
 */

import {
  BATCH_SIZE,
  type AssetRecord,
  type BatchResult,
  type ProcessSummary,
} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BatchProgressEvent {
  batchIndex: number;       // Indeks berbasis 0 dari batch yang baru saja selesai
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  percentComplete: number;  // 0–100
}

export type OnProgressCallback = (event: BatchProgressEvent) => void;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── LOGIC pemotong array — MULAI (baris 36-42) ────────────────────────────
// Memotong array jadi beberapa bagian berisi maksimal `size` elemen.
//   5.000 baris dengan size 500  →  10 kelompok
//
// <T> = generic TypeScript: fungsi ini bisa memotong array berisi tipe APA PUN,
//       dan TypeScript tetap tahu tipe hasilnya.
// i += size = lompat 500 langkah tiap putaran, bukan satu-satu.
// .slice()  = mengambil sebagian TANPA mengubah array asli (beda dari .splice()).
/** Pisahkan array menjadi beberapa bagian yang masing-masing berisi maksimal `size` elemen. */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
// ─── LOGIC pemotong array — SELESAI ────────────────────────────────────────

// ═══ LOGIC PENGIRIMAN SATU KELOMPOK — MULAI (baris 48-~120) ════════════════
// Mengirim satu kelompok ke /api/process, dengan SATU kali percobaan ulang
// otomatis kalau server membalas error 5xx.

async function sendBatch(
  batch: AssetRecord[],
  batchIndex: number,
  totalBatches: number,
  signal: AbortSignal
): Promise<BatchResult> {
  // Fungsi attempt() dibungkus terpisah supaya bisa dipanggil DUA KALI
  // (percobaan pertama + percobaan ulang) tanpa menulis ulang kodenya.
  const attempt = async (): Promise<Response> => {
    return fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: batch,
        batchIndex,
        totalBatches,
      // isLastBatch dihitung DI SINI lalu dikirim ke server. Server memakainya
      // untuk tahu kapan menjalankan syncStagingToNotes() — hanya sekali,
      // di kelompok terakhir. (lihat api/process/route.ts fungsi POST)
        isLastBatch: batchIndex === totalBatches - 1,
      }),
      // signal diteruskan ke fetch supaya tombol Batal benar-benar
      // menghentikan permintaan yang sedang berjalan, bukan sekadar
      // menyembunyikan tampilan.
      signal,
    });
  };

  try {
    let res = await attempt();

    // Satu kali percobaan ulang untuk 5xx eror sementara.
    if (res.status >= 500 && res.status < 600) {
      await new Promise((r) => setTimeout(r, 800)); // brief back-off
      res = await attempt();
    }

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        detail = body?.message ?? body?.error ?? detail;
      } catch {
        // abaikan kegagalan penguraian JSON
      }
      return {
        batchIndex,
        totalBatches,
        rowsInBatch: batch.length,
        success: false,
        error: `Batch ${batchIndex + 1}: ${detail}`,
      };
    }

    return {
      batchIndex,
      totalBatches,
      rowsInBatch: batch.length,
      success: true,
    };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        batchIndex,
        totalBatches,
        rowsInBatch: batch.length,
        success: false,
        error: "Upload dibatalkan oleh pengguna.",
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return {
      batchIndex,
      totalBatches,
      rowsInBatch: batch.length,
      success: false,
      error: `Batch ${batchIndex + 1}: ${msg}`,
    };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
// ═══ LOGIC PENGENDALI SELURUH PENGIRIMAN — MULAI (baris 131-182) ═══════════
// Inilah fungsi yang dipanggil UploadSection. Mengatur seluruh proses:
// potong → kirim berurutan → laporkan kemajuan → kembalikan ringkasan.
 * Proses semua AssetRecords dalam batch dengan ukuran BATCH_SIZE.
 *
 * @param records      Data yang divalidasi dari parser.
 * @param onProgress   Fungsi callback dijalankan setelah setiap batch selesai..
 * @param signal       AbortSignal to cancel mid-flight.
 * @returns            Ringkasan Proses Lengkap.
 */
export async function processBatches(
  records: AssetRecord[],
  skippedRows: number,
  onProgress: OnProgressCallback,
  signal: AbortSignal
): Promise<ProcessSummary> {
  const startTime = Date.now();
  // Potong data jadi kelompok 500 (BATCH_SIZE dari src/lib/types.ts)
  const batches = chunkArray(records, BATCH_SIZE);
  const totalBatches = batches.length;

  const errors: string[] = [];
  let successfulBatches = 0;
  let failedBatches = 0;

  // ─── PERULANGAN pengiriman berurutan — MULAI (baris 145-171) ─────────────
  // PENTING: `await` ada DI DALAM perulangan, sehingga kelompok berikutnya
  // MENUNGGU yang sekarang selesai. Ini disengaja.
  // Kalau ingin bersamaan polanya Promise.all(), tapi itu berisiko membanjiri
  // server dan database dengan 10 permintaan berat sekaligus.
  for (let i = 0; i < batches.length; i++) {
    // Bail early if cancelled
    if (signal.aborted) {
      errors.push("Upload dibatalkan oleh pengguna.");
      break;
    }

    const result = await sendBatch(batches[i], i, totalBatches, signal);

    // Kegagalan hanya MENAMBAH PENGHITUNG — tidak ada throw di sini.
    // Jadi kalau kelompok ke-3 gagal, kelompok 4-10 TETAP JALAN.
    // Alasannya: lebih baik 90% data masuk daripada semuanya batal.
    if (result.success) {
      successfulBatches++;
    } else {
      failedBatches++;
      if (result.error) errors.push(result.error);
    }

    // onProgress adalah CALLBACK: fungsi milik UploadSection yang dikirim
    // sebagai parameter, lalu dipanggil balik dari sini setiap kelompok selesai.
    // Inilah yang menggerakkan bar kemajuan di layar — tanpa file ini perlu
    // tahu apa pun tentang React.
    onProgress({
      batchIndex: i,
      totalBatches,
      successfulBatches,
      failedBatches,
      percentComplete: Math.round(((i + 1) / totalBatches) * 100),
    });

    // setTimeout(r, 0) memberi jeda sesaat kepada browser untuk menggambar ulang
    // layar. Tanpa ini, bar kemajuan bisa tampak membeku selama proses.
    // Berikan jeda kepada browser di antara setiap pemrosesan data agar antarmuka pengguna tetap responsif.
    await new Promise((r) => setTimeout(r, 0));
  }
  // ─── PERULANGAN pengiriman berurutan — SELESAI ──────────────────────────

  // Ringkasan dikembalikan ke UploadSection untuk ditampilkan sebagai hasil akhir
  // (berapa baris valid, berapa dilewati, berapa kelompok gagal, berapa lama).
  return {
    totalRows: records.length + skippedRows,
    validRows: records.length,
    skippedRows,
    totalBatches,
    successfulBatches,
    failedBatches,
    errors,
    durationMs: Date.now() - startTime,
  };
// ═══ LOGIC PENGENDALI SELURUH PENGIRIMAN — SELESAI ═════════════════════════
}