// ═══════════════════════════════════════════════════════════════════════════
// FILE : src/components/UploadSection.tsx
// GUNA : tampilan kotak unggah file DAT sekaligus PEMICU seluruh proses.
//        Semua yang terjadi setelah tombol Proses ditekan bermula dari sini.
//
// FILE INI MEMANGGIL:
//   - parseTxtFile()   dari src/lib/txtParser.ts     (membaca isi file)
//   - processBatches() dari src/lib/batchProcessor.ts (mengirim per kelompok)
//   - fetch ke /api/process/clear                     (mengosongkan data lama)
//
// DIPAKAI DI: src/app/upload/page.tsx
//
// TIGA TAHAP yang dijalankan startPipeline() di bawah:
//   Tahap 1 — baca dan urai file
//   Tahap 2 — kosongkan data lama
//   Tahap 3 — kirim data baru per kelompok 500 baris
// ═══════════════════════════════════════════════════════════════════════════
"use client";

/**
 * UploadSection.tsx
 * Full DAT Excel upload pipeline:
 *   1. Drag-and-drop / file picker
 *   2. XLSX parse with column validation
 *   3. Batch processing → POST /api/process (500 rows/batch)
 *   4. Live progress UI for every phase
 *   5. Detailed success / error summary
 */

import { useState, useCallback, useRef, useReducer } from "react";
import { parseTxtFile } from "@/lib/txtParser";
import { processBatches } from "@/lib/batchProcessor";
import type { PipelineState, PipelinePhase, ProcessSummary } from "@/lib/types";

// ═══ LOGIC PENGATUR TAHAPAN LAYAR — MULAI (baris 20-~199) ══════════════════
// Halaman ini punya banyak tahap yang berurutan: menunggu file, sedang mengurai,
// sedang mengirim, berhasil, gagal. Tiap tahap mengubah beberapa nilai sekaligus.
//
// Kalau memakai useState terpisah-pisah, akan ada enam sampai tujuh pemanggilan
// setState yang harus dijaga supaya tidak saling bertabrakan. Dengan useReducer,
// semua perubahan itu dikumpulkan di satu tempat dan dipanggil cukup dengan
// dispatch({ type: "PARSE_START" }).
//
// Daftar di bawah ini adalah semua "kejadian" yang mungkin terjadi di layar ini.
// ─── State management ─────────────────────────────────────────────────────────

type Action =
  | { type: "DRAG_ENTER" }
  | { type: "DRAG_LEAVE" }
  | { type: "FILE_SELECTED"; file: File; fileName: string; fileSize: string }
  | { type: "PARSE_START" }
  | { type: "PARSE_PROGRESS"; value: number }
  | { type: "PROCESS_START"; totalBatches: number }
  | { type: "BATCH_DONE"; current: number; total: number; progress: number }
  | { type: "SUCCESS"; summary: ProcessSummary }
  | { type: "ERROR"; message: string; detail: string }
  | { type: "RESET" };

const initialState: PipelineState = {
  phase: "idle",
  file: null,
  fileName: "",
  fileSize: "",
  parseProgress: 0,
  batchProgress: 0,
  currentBatch: 0,
  totalBatches: 0,
  summary: null,
  errorMessage: "",
  errorDetail: "",
};

// Fungsi reducer menerima keadaan sekarang dan sebuah kejadian, lalu
// mengembalikan keadaan baru. Ini satu-satunya tempat yang boleh mengubah
// keadaan layar, sehingga alurnya mudah ditelusuri saat ada yang aneh.
function reducer(state: PipelineState, action: Action): PipelineState {
  switch (action.type) {
    case "DRAG_ENTER":
      return state.phase === "idle" ? { ...state, phase: "dragging" } : state;
    case "DRAG_LEAVE":
      return state.phase === "dragging" ? { ...state, phase: "idle" } : state;
    case "FILE_SELECTED":
      return {
        ...initialState,
        phase: "selected",
        file: action.file,
        fileName: action.fileName,
        fileSize: action.fileSize,
      };
    case "PARSE_START":
      return { ...state, phase: "parsing", parseProgress: 0 };
    case "PARSE_PROGRESS":
      return { ...state, parseProgress: action.value };
    case "PROCESS_START":
      return {
        ...state,
        phase: "processing",
        totalBatches: action.totalBatches,
        currentBatch: 0,
        batchProgress: 0,
      };
    case "BATCH_DONE":
      return {
        ...state,
        currentBatch: action.current + 1,
        totalBatches: action.total,
        batchProgress: action.progress,
      };
    case "SUCCESS":
      return { ...state, phase: "success", summary: action.summary };
    case "ERROR":
      return {
        ...state,
        phase: "error",
        errorMessage: action.message,
        errorDetail: action.detail,
      };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseIcon({ phase }: { phase: PipelinePhase }) {
  const base = "flex-shrink-0 flex items-center justify-center rounded-xl border";

  if (phase === "idle" || phase === "dragging")
    return (
      <div className={`${base} w-12 h-12 bg-white/[0.04] border-white/10`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={phase === "dragging" ? "text-cyan-400" : "text-slate-500"}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
    );

  if (phase === "selected")
    return (
      <div className={`${base} w-12 h-12 bg-cyan-500/10 border-cyan-500/20`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-400">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      </div>
    );

  if (phase === "parsing" || phase === "processing")
    return (
      <div className={`${base} w-12 h-12 bg-blue-500/10 border-blue-500/20`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 animate-spin" style={{ animationDuration: "1.2s" }}>
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      </div>
    );

  if (phase === "success")
    return (
      <div className={`${base} w-12 h-12 bg-emerald-500/10 border-emerald-500/20`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );

  return (
    <div className={`${base} w-12 h-12 bg-rose-500/10 border-rose-500/20`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
  );
}

function ProgressBar({ value, color = "cyan" }: { value: number; color?: "cyan" | "blue" | "emerald" }) {
  const gradients: Record<string, string> = {
    cyan: "from-cyan-500 to-blue-500",
    blue: "from-blue-500 to-violet-500",
    emerald: "from-emerald-500 to-cyan-500",
  };
  return (
    <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradients[color]} rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

function SummaryGrid({ summary }: { summary: ProcessSummary }) {
  const stats = [
    { label: "Total Baris", value: summary.totalRows.toLocaleString(), color: "text-white" },
    { label: "Baris Valid", value: summary.validRows.toLocaleString(), color: "text-emerald-400" },
    { label: "Dilewati", value: summary.skippedRows.toLocaleString(), color: "text-amber-400" },
    { label: "Batch Sukses", value: `${summary.successfulBatches}/${summary.totalBatches}`, color: summary.failedBatches > 0 ? "text-amber-400" : "text-emerald-400" },
    { label: "Batch Gagal", value: summary.failedBatches.toLocaleString(), color: summary.failedBatches > 0 ? "text-rose-400" : "text-slate-500" },
    { label: "Durasi", value: formatDuration(summary.durationMs), color: "text-cyan-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mt-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5">
          <p className={`text-[15px] font-bold font-mono ${s.color}`}>{s.value}</p>
          <p className="text-slate-600 text-[10px] mt-0.5 uppercase tracking-wider">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ═══ KOMPONEN UTAMA — MULAI (baris 203-akhir) ══════════════════════════════
export default function UploadSection() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // inputRef menunjuk ke elemen input file yang disembunyikan. Tombol "Pilih File"
  // sebenarnya mengklik elemen itu dari balik layar.
  const inputRef = useRef<HTMLInputElement>(null);
  // abortRef menyimpan alat pembatalan. Disimpan memakai useRef, bukan useState,
  // karena nilainya perlu bertahan antar-render TAPI perubahannya tidak boleh
  // memicu penggambaran ulang layar.
  const abortRef = useRef<AbortController | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // ── File selection ──────────────────────────────────────────────────────────

  // ─── LOGIC penerima file — MULAI (baris 211-~228) ───────────────────────
  // Dipakai baik saat file dipilih lewat tombol maupun lewat seret-dan-lepas.
  // Ekstensi diperiksa lebih dulu supaya kesalahan file ketahuan sejak awal,
  // sebelum isinya sempat dibaca.
  const handleFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt") {
      dispatch({
        type: "ERROR",
        message: "Format file tidak didukung.",
        detail: `File "${file.name}" bukan .txt. Upload file export DAT Oracle (.txt).`,
      });
      return;
    }
    dispatch({
      type: "FILE_SELECTED",
      file,
      fileName: file.name,
      fileSize: formatFileSize(file.size),
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dispatch({ type: "DRAG_ENTER" });
  };
  const handleDragLeave = () => dispatch({ type: "DRAG_LEAVE" });

  // ═══ LOGIC PEMICU SELURUH PROSES — MULAI (baris 246-349) ════════════════
  // Inilah fungsi yang berjalan saat tombol Proses ditekan.
  // ── Pipeline trigger ────────────────────────────────────────────────────────

  const startPipeline = async () => {
    if (!state.file || state.phase !== "selected") return;

    // AbortController adalah alat bawaan browser untuk membatalkan pekerjaan
    // yang sedang berjalan. Objek signal-nya nanti diteruskan sampai ke fetch
    // di dalam batchProcessor, sehingga tombol Batal benar-benar menghentikan
    // permintaan — bukan sekadar menyembunyikan tampilan.
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    // Phase 1: Parse
    dispatch({ type: "PARSE_START" });

    // Pembacaan file berjalan sekaligus tanpa jeda, jadi tidak ada kemajuan
    // nyata yang bisa dilaporkan. Angka yang bergerak di sini hanya untuk
    // memberi tahu pengguna bahwa aplikasi sedang bekerja, bukan membeku.
    // Batasnya sengaja 88 persen — sisanya diisi setelah pembacaan selesai.
    // Animate parse progress (XLSX.read is sync under the hood)
    let fakeProgress = 0;
    const parseTimer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 18 + 8, 88);
      dispatch({ type: "PARSE_PROGRESS", value: fakeProgress });
    }, 80);

    // ─── TAHAP 1: baca dan urai file ──────────────────────────────────────
    // Di sinilah parseTxtFile() dari src/lib/txtParser.ts dipanggil.
    // Hasilnya berupa records (baris yang berhasil dibaca) dan skippedRows.
    let parseResult;
    try {
      parseResult = await parseTxtFile(state.file);
    } catch (err: unknown) {
      clearInterval(parseTimer);
      dispatch({
        type: "ERROR",
        message: "Gagal membaca file Excel.",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    clearInterval(parseTimer);
    dispatch({ type: "PARSE_PROGRESS", value: 100 });

    if (signal.aborted) return;

    // ─── TAHAP 2: kosongkan data lama ─────────────────────────────────────
    // Alasan strategi hapus-lalu-isi: file DAT adalah potret kondisi pada satu
    // waktu, bukan catatan transaksi. Aset yang sudah dihapus di Oracle harus
    // ikut hilang di sini. Kalau datanya cuma diperbarui, aset lama akan
    // menumpuk selamanya.
    // Phase 2: Clear existing data — sekali sebelum batch pertama
    // Bagian dari Full Replace Strategy: DELETE semua assets_raw dulu,
    // baru INSERT fresh. Dipisah dari /api/process agar tidak terpanggil
    // di setiap batch request.
    try {
      const clearRes = await fetch("/api/process/clear", {
        method: "POST",
        signal,
      });
      const clearJson = await clearRes.json();
      if (!clearJson.success) {
        dispatch({
          type: "ERROR",
          message: "Gagal menghapus data lama.",
          detail: clearJson.error ?? "Unknown error dari /api/process/clear",
        });
        return;
      }
    } catch (err: unknown) {
      // Pembatalan oleh pengguna bukan kesalahan, jadi tidak perlu menampilkan
      // pesan error. Cukup keluar diam-diam.
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({
        type: "ERROR",
        message: "Gagal menghapus data lama.",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (signal.aborted) return;

    // ─── TAHAP 3: kirim data per kelompok ─────────────────────────────────
    // Math.ceil dipakai supaya sisa yang tidak genap tetap dihitung satu kelompok.
    // Contohnya 1.200 baris menjadi 3 kelompok, bukan 2.
    // Phase 3: Batch processing
    const { records, skippedRows } = parseResult;
    const totalBatches = Math.ceil(records.length / 500);
    dispatch({ type: "PROCESS_START", totalBatches });

    let summary;
    try {
      // Perhatikan bentuk pemanggilannya: fungsi di baris 320-327 dikirim
      // sebagai parameter ke processBatches, lalu dipanggil balik dari sana
      // setiap satu kelompok selesai. Inilah yang menggerakkan bar kemajuan.
      // Cara ini membuat batchProcessor tidak perlu tahu apa pun soal React.
      summary = await processBatches(
        records,
        skippedRows,
        (evt) => {
          dispatch({
            type: "BATCH_DONE",
            current: evt.batchIndex,
            total: evt.totalBatches,
            progress: evt.percentComplete,
          });
        },
        signal
      );
    } catch (err: unknown) {
      dispatch({
        type: "ERROR",
        message: "Kesalahan saat pemrosesan batch.",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    // Gagal seluruhnya diperlakukan berbeda dengan gagal sebagian. Kalau hanya
    // sebagian, hasilnya tetap dianggap berhasil dan jumlah kegagalan
    // ditampilkan di ringkasan — sebagian data masuk lebih baik daripada batal.
    // Phase 3: Final state
    if (summary.failedBatches === summary.totalBatches) {
      dispatch({
        type: "ERROR",
        message: "Semua batch gagal diproses.",
        detail: summary.errors[0] ?? "Periksa koneksi jaringan dan coba lagi.",
      });
    } else {
      dispatch({ type: "SUCCESS", summary });
    }
  };
  // ═══ LOGIC PEMICU SELURUH PROSES — SELESAI ══════════════════════════════

  // Membatalkan pekerjaan yang sedang berjalan lalu mengembalikan layar
  // ke keadaan awal. Tanda tanya pada abortRef.current?.abort() menjaga
  // supaya tidak error kalau ternyata belum ada proses yang berjalan.
  const cancelUpload = () => {
    abortRef.current?.abort();
    dispatch({ type: "RESET" });
  };

  const reset = () => {
    abortRef.current?.abort();
    dispatch({ type: "RESET" });
    setShowErrors(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Drop zone border ────────────────────────────────────────────────────────
  const dropBorderClass: Record<PipelinePhase, string> = {
    idle: "border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.015] cursor-pointer",
    dragging: "border-cyan-400/60 bg-cyan-500/[0.06] cursor-copy",
    selected: "border-cyan-500/30 bg-cyan-500/[0.03] cursor-default",
    parsing: "border-blue-500/30 bg-blue-500/[0.03] cursor-default",
    processing: "border-blue-500/30 bg-blue-500/[0.03] cursor-default",
    success: "border-emerald-500/30 bg-emerald-500/[0.03] cursor-default",
    error: "border-rose-500/30 bg-rose-500/[0.03] cursor-default",
  };

  const isProcessing = state.phase === "parsing" || state.phase === "processing";

  return (
    <div className="bg-[#111827] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white text-[14px] font-semibold">Upload File DAT</h3>
          <p className="text-slate-500 text-[11px] mt-0.5">
            Import data aset dari file export DAT Oracle (.txt)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
            DAT Import
          </span>
          {state.phase === "success" && (state.summary?.failedBatches ?? 0) === 0 && (
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
              ✓ Selesai
            </span>
          )}
          {state.phase === "success" && (state.summary?.failedBatches ?? 0) > 0 && (
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
              ⚠ Parsial
            </span>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={!isProcessing ? handleDrop : undefined}
        onDragOver={!isProcessing ? handleDragOver : undefined}
        onDragLeave={!isProcessing ? handleDragLeave : undefined}
        onClick={() => state.phase === "idle" && inputRef.current?.click()}
        className={`
          relative rounded-xl border-2 border-dashed transition-all duration-200
          flex flex-col items-center justify-center gap-3 min-h-[152px] px-6 py-7
          ${dropBorderClass[state.phase]}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* IDLE */}
        {state.phase === "idle" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-500">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-300 text-[13px] font-medium">Drag & drop file di sini</p>
              <p className="text-slate-600 text-[11px] mt-1">atau klik untuk memilih file</p>
            </div>
            <div className="flex gap-2">
              {[".txt"].map((ext) => (
                <span key={ext} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-slate-500 font-mono">{ext}</span>
              ))}
            </div>
          </>
        )}

        {/* DRAGGING */}
        {state.phase === "dragging" && (
          <>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-pulse">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-cyan-400 text-[13px] font-semibold">Lepaskan file di sini</p>
          </>
        )}

        {/* SELECTED */}
        {state.phase === "selected" && (
          <div className="flex items-center gap-4 w-full max-w-md">
            <PhaseIcon phase="selected" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-medium truncate">{state.fileName}</p>
              <p className="text-slate-500 text-[11px] mt-0.5">{state.fileSize} · Siap diproses</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="text-slate-600 hover:text-white transition-colors flex-shrink-0"
              aria-label="Hapus file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* PARSING */}
        {state.phase === "parsing" && (
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center gap-3">
              <PhaseIcon phase="parsing" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-white text-[12px] font-medium truncate">{state.fileName}</p>
                  <p className="text-blue-400 text-[11px] font-semibold ml-2 font-mono">{Math.round(state.parseProgress)}%</p>
                </div>
                <ProgressBar value={state.parseProgress} color="cyan" />
              </div>
            </div>
            <p className="text-slate-600 text-[11px] text-center">Membaca & memvalidasi file DAT Oracle…</p>
          </div>
        )}

        {/* PROCESSING */}
        {state.phase === "processing" && (
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center gap-3">
              <PhaseIcon phase="processing" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-white text-[12px] font-medium truncate">{state.fileName}</p>
                  <p className="text-blue-400 text-[11px] font-semibold ml-2 font-mono">{Math.round(state.batchProgress)}%</p>
                </div>
                <ProgressBar value={state.batchProgress} color="blue" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-slate-600 text-[11px]">
                Batch{" "}
                <span className="text-slate-400 font-mono">{state.currentBatch}</span>
                {" "}/{" "}
                <span className="text-slate-400 font-mono">{state.totalBatches}</span>
              </p>
              <p className="text-slate-600 text-[11px]">500 baris / batch</p>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {state.phase === "success" && state.summary && (
          <div className="w-full max-w-md">
            <div className="flex items-center gap-4">
              <PhaseIcon phase="success" />
              <div>
                <p className="text-emerald-400 text-[13px] font-semibold">
                  {(state.summary.failedBatches ?? 0) > 0
                    ? `Selesai dengan ${state.summary.failedBatches} batch gagal`
                    : "Semua data berhasil diproses!"}
                </p>
                <p className="text-slate-500 text-[11px] mt-0.5">{state.fileName}</p>
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {state.phase === "error" && (
          <div className="w-full max-w-md flex items-start gap-4">
            <PhaseIcon phase="error" />
            <div className="flex-1 min-w-0">
              <p className="text-rose-400 text-[13px] font-semibold">{state.errorMessage}</p>
              <p className="text-slate-500 text-[11px] mt-1 leading-relaxed">{state.errorDetail}</p>
            </div>
          </div>
        )}
      </div>

      {/* Success summary */}
      {state.phase === "success" && state.summary && (
        <div>
          <SummaryGrid summary={state.summary} />
          {state.summary.errors.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowErrors((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {showErrors ? "Sembunyikan" : "Lihat"} {state.summary.errors.length} error batch
              </button>
              {showErrors && (
                <div className="mt-2 rounded-xl bg-rose-500/[0.05] border border-rose-500/20 p-3 max-h-32 overflow-y-auto space-y-1">
                  {state.summary.errors.map((e, i) => (
                    <p key={i} className="text-rose-400 text-[11px] font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Column mapping reference */}
      {(state.phase === "idle" || state.phase === "selected") && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Mapping Kolom DAT</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {[
              ["Toko", "toko"],
              ["Kategori", "kategori_oracle"],
              ["No. Seri", "kode_asset"],
              ["Keterangan", "deskripsi"],
            ].map(([from, to]) => (
              <div key={from} className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded">{from}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-700 flex-shrink-0">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
                <span className="text-cyan-500/80 font-mono">{to}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-700 mt-2">Status default: <span className="font-mono text-slate-500">CGA1</span></p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-3">
        {(state.phase === "idle" || state.phase === "error") && (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 bg-white/[0.05] border border-white/10 text-slate-300 text-[12px] font-medium px-4 py-2 rounded-xl hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Pilih File
          </button>
        )}

        {state.phase === "selected" && (
          <>
            <button
              onClick={startPipeline}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[12px] font-semibold px-5 py-2 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Proses & Upload
            </button>
            <button onClick={reset} className="text-slate-500 text-[12px] hover:text-white transition-colors">
              Batal
            </button>
          </>
        )}

        {isProcessing && (
          <button
            onClick={cancelUpload}
            className="flex items-center gap-2 bg-white/[0.05] border border-rose-500/20 text-rose-400 text-[12px] font-medium px-4 py-2 rounded-xl hover:bg-rose-500/10 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Batalkan
          </button>
        )}

        {state.phase === "success" && (
          <button
            onClick={reset}
            className="flex items-center gap-2 bg-white/[0.05] border border-white/10 text-slate-300 text-[12px] font-medium px-4 py-2 rounded-xl hover:bg-white/[0.08] hover:text-white transition-all"
          >
            Upload File Lain
          </button>
        )}

        {state.phase === "parsing" && (
          <p className="text-slate-500 text-[11px]">Parsing file DAT…</p>
        )}
        {state.phase === "processing" && (
          <p className="text-slate-500 text-[11px]">
            Mengirim <span className="text-slate-400 font-mono">{state.totalBatches}</span> batch ke server…
          </p>
        )}
      </div>
    </div>
  );
}