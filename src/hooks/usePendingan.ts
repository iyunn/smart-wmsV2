"use client";

import { useState, useEffect, useCallback } from "react";

export type UrgensiLevel = "tinggi" | "sedang" | "rendah";
export type ArahPendingan = "kirim" | "tarik";

export interface PendinganItemFull {
  id: string;
  tujuan_id: string;
  jenis: string;
  merk?: string;
  qty: number;
  keterangan?: string;
  urgensi?: UrgensiLevel;
  arah?: ArahPendingan;
  created_at?: string;
  tujuan?: {
    id: string;
    kode: string;
    nama: string;
    kota?: string | null;
    kecamatan?: string | null;
  };
}

// Hook: fetch semua item pendingan (dengan join tujuan) + helper mutate.
export function usePendingan() {
  const [items, setItems] = useState<PendinganItemFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pendingan");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal memuat");
      // Jaga-jaga bila tujuan datang sebagai array (bentuk join V1) — normalisasi ke objek.
      const normalized: PendinganItemFull[] = (json.items ?? []).map((it: PendinganItemFull & { tujuan: unknown }) => ({
        ...it,
        tujuan: Array.isArray(it.tujuan) ? it.tujuan[0] : it.tujuan,
      }));
      setItems(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Tambah item batch untuk satu tujuan
  const addItems = useCallback(async (
    tujuan_id: string,
    newItems: { jenis: string; merk?: string; qty: number; keterangan?: string; urgensi?: UrgensiLevel; arah?: ArahPendingan }[]
  ) => {
    const res = await fetch("/api/pendingan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tujuan_id, items: newItems }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Gagal menambah");
    await refresh();
    return json.items;
  }, [refresh]);

  // Clear (hard-delete) satu atau banyak item
  const clearItems = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const res = await fetch("/api/pendingan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Gagal menghapus");
    await refresh();
  }, [refresh]);

  // Edit satu item (hanya field yang dikirim yang diubah)
  const updateItem = useCallback(async (
    id: string,
    patch: { jenis?: string; merk?: string; qty?: number; keterangan?: string; urgensi?: UrgensiLevel; arah?: ArahPendingan }
  ) => {
    const res = await fetch("/api/pendingan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Gagal mengubah");
    await refresh();
    return json.item;
  }, [refresh]);

  return { items, loading, error, refresh, addItems, updateItem, clearItems };
}
