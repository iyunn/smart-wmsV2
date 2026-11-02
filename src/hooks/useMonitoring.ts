"use client";

import { useState, useEffect, useCallback } from "react";

export interface MonitoringAsset {
  clean_id:        string;
  jenis:           string;
  merk:            string;
  confidence:      string;
  kode_asset:      string;
  deskripsi:       string;
  toko:            string;
  kategori_oracle: string;
  kuantitas:       number;
  biaya_perolehan: number;
  jumlah_tercatat: number;
  tag:             string | null;
  invoice_number:  string;
  tanggal_dokumen: string;
  catatan:         string;
  /** Toko tujuan dari SJ keluar terakhir yang memakai kode aset ini (Rekap Alokasi); "" = belum */
  kode_tujuan:     string;
  nama_tujuan:     string;
  tujuan_no_sj:    string;
  tujuan_tanggal:  string;
}

export function useMonitoring() {
  const [assets, setAssets]   = useState<MonitoringAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/monitoring');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setAssets(json.assets ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat data monitoring');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  return { assets, loading, error, refresh };
}

// ─── LPP Monitoring ─────────────────────────────────────────────────────
export interface LPPRawItem {
  id:          string;
  kode_asset:  string;
  toko:        string;
  deskripsi:   string;
  saldo_awal:  number;
  masuk:       number;
  keluar:      number;
  saldo_akhir: number;
  uploaded_at: string;
}

export function useLPPMonitoring() {
  const [items, setItems]     = useState<LPPRawItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/lpp/monitoring');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setItems(json.items ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat data LPP');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);

  return { items, loading, error, refresh };
}
