// ═══════════════════════════════════════════════════════════════════════════
// FILE : src/hooks/useReconciliation.ts
// GUNA : jembatan antara halaman Rekonsiliasi dan servernya. Halaman tidak
//        bicara langsung ke database — semua lewat sini.
//
// MENGAMBIL DARI : /api/reconciliation
//                  → src/app/api/reconciliation/route.ts, fungsi GET()
// DIPAKAI DI     : src/app/reconciliation/page.tsx
//
// POLA YANG SAMA dipakai hampir semua hook di folder ini —
// useMonitoring, useSJReport, useDashboardStats, useStaging.
// Kalau sudah paham satu, sisanya tinggal mengikuti.
// ═══════════════════════════════════════════════════════════════════════════
"use client";

// "use client" di baris atas menandakan berkas ini berjalan di browser,
// bukan di server. Wajib ada karena memakai useState dan useEffect.

import { useState, useEffect, useCallback } from "react";

// ─── BENTUK DATA yang diterima dari server ─────────────────────────────────
// Ini bukan logika, hanya kesepakatan bentuk data supaya TypeScript bisa
// mengingatkan kalau ada salah ketik nama kolom saat dipakai di halaman.
export interface ReconciliationItem {
  kode_asset: string;
  toko: string;
  tokoLPP: string | null; // hanya diisi untuk kondisi 6 (mismatch CGA)
  deskripsi: string;
  kondisi: 1 | 2 | 4 | 5 | 6;
  inDAT: boolean;
  inLPP: boolean;
}

export interface ReconciliationSummary {
  kondisi1: number;
  kondisi2: number;
  kondisi4: number;
  kondisi5: number;
  kondisi6: number;
}

// ═══ LOGIC PENGAMBIL DATA — MULAI (baris 23-56) ════════════════════════════
// Tiga keadaan yang selalu disediakan hook seperti ini:
//   items / summary → datanya
//   loading         → sedang memuat? (halaman menampilkan kerangka tampilan)
//   error           → pesan kalau gagal
export function useReconciliation() {
  const [items, setItems]     = useState<ReconciliationItem[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  // refreshTick cuma angka biasa. Setiap kali refresh() dipanggil, angkanya
  // naik satu — dan karena angka ini terdaftar sebagai pemicu useEffect
  // di baris 51, perubahannya membuat data diambil ulang.
  const [refreshTick, setRefreshTick] = useState(0);

  // ─── Pengambilan data saat halaman dibuka — MULAI (baris 30-51) ─────────
  useEffect(() => {
    // Penanda cancelled ini penting. Kalau pengguna berpindah halaman
    // sementara data masih dalam perjalanan, penandanya jadi true sehingga
    // hasil yang datang belakangan tidak dipasang ke halaman yang sudah
    // tidak ada. Tanpa ini React akan memberi peringatan kebocoran memori.
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/reconciliation');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setItems(json.items ?? []);
          setSummary(json.summary ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat data reconciliation');
      // finally selalu dijalankan, baik berhasil maupun gagal — jadi tanda
      // "sedang memuat" pasti dimatikan dan halaman tidak macet di kerangka.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    // Baris ini dijalankan React saat halaman ditinggalkan. Inilah yang
    // menyalakan penanda cancelled tadi.
    return () => { cancelled = true; };
  }, [refreshTick]);
  // ─── Pengambilan data saat halaman dibuka — SELESAI ─────────────────────

  // Bentuk penulisan t => t + 1 dipakai supaya selalu memakai nilai terbaru.
  // Kalau ditulis setRefreshTick(refreshTick + 1), ada kemungkinan memakai
  // nilai lama saat beberapa perubahan terjadi berdekatan.
  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  // Semua ini diserahkan ke halaman. Halaman tinggal memakainya tanpa perlu
  // tahu bagaimana datanya diambil.
  return { items, summary, loading, error, refresh };
}
// ═══ LOGIC PENGAMBIL DATA — SELESAI ════════════════════════════════════════
