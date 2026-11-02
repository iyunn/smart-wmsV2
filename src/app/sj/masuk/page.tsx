"use client";

/**
 * /sj/masuk/page.tsx
 * Form Penerimaan Barang — mencatat barang yang kembali dari toko ke CGA.
 *
 * Mirip dengan /sj/buat (SJ keluar) tapi dengan semantik yang berbeda:
 *   - "Asal Toko" (bukan "Tujuan") — tujuan_id di DB, toko pengirim barang
 *   - "Pengirim"  (bukan "Pembawa") — pembawa di DB, orang yang membawa barang
 *   - "Penerima"  auto = "Admin GA - CGA" (bukan toko tujuan)
 *   - jenis = 'masuk' (dikirim ke API, disimpan di DB)
 *   - Tidak ada mode Draft — langsung submitted
 *   - Barang gaib (tidak diketahui kode_asset-nya): kode_asset dikosongkan,
 *     keterangan diisi manual oleh user
 */

import { useState, useCallback, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import SearchableDropdown from "@/components/sj/SearchableDropdown";
import SJItemsTableMasuk from "@/components/sj/SJItemsTableMasuk";
import SJPreviewModal from "@/components/sj/SJPreviewModal";
import { useMasterJenis, useMasterMerk, useMasterTujuan } from "@/hooks/useSJMaster";
import { useSJDetail } from "@/hooks/useSJList";
import { createEmptyItem, type SJItem } from "@/lib/sjTypes";
import type { SJDataForPDF } from "@/components/sj/SuratJalanPDF";
import { useSession } from "@/components/SessionContext";
import { sjCreatorName } from "@/lib/sjCreator";

function TerimaBarangContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Mode edit — dipakai saat Daftar SJ membuka Penerimaan Barang lewat ?edit=<id>
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const { sj: existingSJ, loading: loadingExisting, error: loadError } = useSJDetail(editId);
  const [hydrated, setHydrated] = useState(false);

  const { jenis: jenisOptions } = useMasterJenis();
  const { merk: merkOptions }   = useMasterMerk();
  const { tujuan: tujuanList }  = useMasterTujuan();

  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal]   = useState(today);
  const [asalId, setAsalId]     = useState(searchParams.get("asal") ?? "");
  const [pengirim, setPengirim] = useState("");
  const [items, setItems]       = useState<SJItem[]>([createEmptyItem(1)]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");

  const [previewData, setPreviewData]   = useState<SJDataForPDF | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  // Isi form dari SJ yang sedang diedit (sekali saja)
  useEffect(() => {
    if (isEditMode && existingSJ && !hydrated) {
      setTanggal(existingSJ.tanggal);
      setAsalId(existingSJ.tujuan_id);
      setPengirim(existingSJ.pembawa ?? "");
      const existingItems = (existingSJ.items ?? []).map((it: any, idx: number) => ({
        urutan:        idx + 1,
        jenis:         it.jenis ?? "",
        merk:          it.merk ?? "",
        serial_number: it.serial_number ?? "",
        qty:           it.qty ?? 1,
        satuan:        it.satuan ?? "Unit",
        is_baru:       it.is_baru ?? false,
        is_aktiva:     it.is_aktiva ?? false,
        keterangan:    it.keterangan ?? "",
        kode_asset:    it.kode_asset ?? "",
      }));
      setItems(existingItems.length > 0 ? existingItems : [createEmptyItem(1)]);
      setHydrated(true);
    }
  }, [isEditMode, existingSJ, hydrated]);

  const asalOptions = useMemo(
    () => tujuanList.map(t => ({ value: t.id, label: `${t.kode} — ${t.nama}` })),
    [tujuanList]
  );

  const selectedAsal = tujuanList.find(t => t.id === asalId);
  // Penerima = Admin GA (CGA menerima barang dari toko)
  const penerimaDisplay = "Admin GA";

  const { profile } = useSession();

  const handleSubmit = useCallback(async () => {
    setError("");

    if (!asalId)  { setError("Asal toko wajib dipilih"); return; }
    if (!tanggal) { setError("Tanggal wajib diisi"); return; }

    const validItems = items.filter(i => i.jenis.trim() !== "");
    if (validItems.length === 0) {
      setError("Minimal 1 baris barang dengan jenis terisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tanggal,
        tujuan_id:   asalId,          // DB: tujuan_id = asal toko
        pembawa:     pengirim,         // DB: pembawa   = pengirim dari toko
        penerima:    penerimaDisplay,  // DB: penerima  = Admin GA
        approved_by: "SPV/Manager",
        items:       validItems,
        status:      "submitted",
        jenis:       "masuk",          // ← kunci perbedaan dari SJ keluar
      };

      const res = await fetch("/api/sj", {
        method:  isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditMode ? { id: editId, ...payload } : payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Gagal menyimpan");
      }

      const data = await res.json();
      const finalNoSJ = isEditMode ? existingSJ?.no_sj : data.no_sj;

      // Tampilkan preview — Tahap 3 akan buat PDF khusus "Surat Penerimaan Barang"
      // Untuk sementara pakai SJPreviewModal existing (judul sudah di-override)
      const pdfData: SJDataForPDF = {
        no_sj:       finalNoSJ,
        tanggal,
        tujuan_kode: selectedAsal?.kode ?? "",
        tujuan_nama: selectedAsal?.nama ?? "",
        pembawa:     pengirim,
        penerima:    penerimaDisplay,
        approved_by: "SPV/Manager",
        created_by:  sjCreatorName(isEditMode ? existingSJ?.created_by : profile?.username),
        items: validItems.map((it, idx) => ({
          urutan:        idx + 1,
          jenis:         it.jenis,
          merk:          it.merk,
          serial_number: it.serial_number,
          qty:           it.qty,
          satuan:        it.satuan,
          is_baru:       it.is_baru,
          is_aktiva:     it.is_aktiva,
          keterangan:    it.keterangan,
          kode_asset:    it.kode_asset ?? "",
        })),
      };

      setPreviewTitle(isEditMode ? "Surat Penerimaan Barang Berhasil Diupdate" : "Surat Penerimaan Barang Berhasil Dibuat");
      setPreviewData(pdfData);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }, [tanggal, asalId, pengirim, penerimaDisplay, items, selectedAsal, isEditMode, editId, existingSJ, profile]);

  const handleClosePreview = useCallback(() => {
    setPreviewData(null);
    if (isEditMode) {
      // Selesai mengedit — kembali ke Daftar Surat Jalan
      router.push("/sj/list");
      return;
    }
    // Reset form untuk penerimaan berikutnya
    setItems([createEmptyItem(1)]);
    setPengirim("");
    setAsalId("");
  }, [isEditMode, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#080e18] text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={isEditMode ? "Edit Penerimaan Barang" : "Penerimaan Barang"} />

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Penerimaan Barang</h1>
            <p className="mt-0.5 text-xs text-white/40">
              Catat barang yang kembali dari toko ke CGA. No dokumen akan di-generate otomatis.
              Barang tanpa kode aset (gaib) — kosongkan kode aset, isi keterangan.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400 shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          )}

          {/* Header info */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-4">
              Informasi Penerimaan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Tanggal Penerimaan *
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  suppressHydrationWarning
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[12px] rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Asal Toko *
                </label>
                <SearchableDropdown
                  options={asalOptions}
                  value={asalId}
                  onChange={setAsalId}
                  placeholder="Pilih asal toko..."
                />
                {selectedAsal && (
                  <p className="text-[10px] text-white/30 mt-1.5">
                    Penerima otomatis:{" "}
                    <span className="text-emerald-400">{penerimaDisplay}</span>
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                  Pengirim (dari toko)
                </label>
                <input
                  type="text"
                  value={pengirim}
                  onChange={e => setPengirim(e.target.value)}
                  placeholder="Nama pengirim dari toko..."
                  suppressHydrationWarning
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[12px] placeholder:text-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

            </div>
          </div>

          {/* Tabel item */}
          <div>
            <h2 className="text-[12px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-3">
              Detail Barang Diterima
            </h2>
            <SJItemsTableMasuk
              items={items}
              jenisOptions={jenisOptions}
              merkOptions={merkOptions}
              onChange={setItems}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-[#080e18] py-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[12px] font-semibold shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 1.5A4.5 4.5 0 1 1 1.5 6"/>
                  </svg>
                  Menyimpan...
                </>
              ) : (
                <>{isEditMode ? "Update Penerimaan Barang" : "Simpan Penerimaan Barang"}</>
              )}
            </button>
          </div>

        </main>
      </div>

      {previewData && (
        <SJPreviewModal
          data={previewData}
          title={previewTitle}
          jenis="masuk"
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}

export default function TerimaBarangPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#080e18] items-center justify-center">
        <span className="text-white/40 text-sm">Memuat...</span>
      </div>
    }>
      <TerimaBarangContent />
    </Suspense>
  );
}
