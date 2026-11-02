"use client";

import { useCallback, useEffect, useState } from "react";

// Data halaman Bounty Hunter (GET /api/bounty) + helper kirim perubahan.

export interface BountyEvent { aksi: "buat" | "ubah" | "selesai" | "batal" | "hapus"; qty: number | null; catatan: string; oleh: string; at: string }
export interface BountyItem {
  id: string;
  as_id: string;
  as_inisial: string;
  jenis: string;
  qty: number;
  qty_selesai: number;
  keterangan: string;
  tanggal: string;
  created_by: string;
  created_at: string;
  selesai_at: string | null;
  tujuan: { id: string; kode: string; nama: string } | null;
  riwayat: BountyEvent[];
}
export interface BountyAs { id: string; inisial: string; nama: string; sisa: number; bounty: number; utang_aktif: number; sejak: string | null }
export interface BountyData { per_barang: number; as: BountyAs[]; items: BountyItem[] }

export function useBounty() {
  const [data, setData] = useState<BountyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/bounty", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Gagal memuat data bounty."); return; }
      setData(json as BountyData);
      setError("");
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /** Kirim perubahan; sukses → data dimuat ulang. Hasil: pesan error atau null. */
  const send = useCallback(async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): Promise<string | null> => {
    try {
      const res = await fetch("/api/bounty", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return json.error ?? `Gagal (HTTP ${res.status}).`;
      await refresh();
      return null;
    } catch {
      return "Tidak bisa terhubung ke server.";
    }
  }, [refresh]);

  return { data, loading, error, refresh, send };
}
