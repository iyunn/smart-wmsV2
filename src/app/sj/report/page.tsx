"use client";

import { memo, useState, useMemo, useCallback, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useSJReport, type SJReportItem } from "@/hooks/useSJReport";
import { exportSJReportToExcel } from "@/lib/excelExporter";

// ─── Types ────────────────────────────────────────────────────────────────
type PeriodPreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";
type SearchField  =
  | "all" | "no_sj" | "sn" | "pembawa"
  | "tujuan" | "jenis" | "merk" | "status" | "keterangan";

// Filter status mutasi untuk review cepat item yang belum dimutasi
type MutasiFilter = "all" | "belum_oracle" | "belum_wt" | "belum_keduanya";

// Filter jenis SJ: keluar (SJ Manual) / masuk (Penerimaan Barang)
type JenisSJFilter = "all" | "keluar" | "masuk";
const JENIS_SJ_SLUG: Record<JenisSJFilter, string> = { all: "", keluar: "SJ-Keluar", masuk: "SJ-Masuk" };

const PAGE_SIZE = 30;

// ─── StyledSelect (sama pattern existing) ────────────────────────────────
function StyledSelect<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border bg-white/[0.04] text-[12px] text-white/80 transition-all ${
          open ? "border-cyan-500/50 bg-white/[0.06]" : "border-white/[0.08] hover:border-white/[0.15]"
        }`}
      >
        <span className="truncate">{selected?.label ?? "Pilih..."}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`transition-transform shrink-0 ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[160px] bg-[#0d1117] border border-white/[0.1] rounded-lg shadow-2xl shadow-black/50 overflow-hidden max-h-72 overflow-y-auto">
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] transition-all ${
                opt.value === value ? "bg-cyan-500/10 text-cyan-300" : "text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatTanggal(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatHari(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long" });
}

function isInDateRange(tanggal: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (from && tanggal < from) return false;
  if (to   && tanggal > to)   return false;
  return true;
}

function getPresetRange(preset: PeriodPreset): { from: string; to: string } {
  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (preset === "today")     return { from: todayStr, to: todayStr };
  if (preset === "yesterday") {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const s = y.toISOString().slice(0, 10);
    return { from: s, to: s };
  }
  if (preset === "week") {
    const w = new Date(); w.setDate(w.getDate() - 6);
    return { from: w.toISOString().slice(0, 10), to: todayStr };
  }
  if (preset === "month") {
    const m = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: m.toISOString().slice(0, 10), to: todayStr };
  }
  return { from: "", to: "" };
}

// ── Label untuk display & nama file ───────────────────────────────────────
const PERIOD_LABEL: Record<PeriodPreset, string> = {
  all:       "Semua Periode",
  today:     "Hari Ini",
  yesterday: "Kemarin",
  week:      "Minggu Ini",      // ← diganti sesuai permintaan
  month:     "Bulan Ini",
  custom:    "Custom",
};

function getPeriodLabel(preset: PeriodPreset, from: string, to: string): string {
  if (preset === "custom" && from && to)
    return `${formatTanggal(from)} - ${formatTanggal(to)}`;
  if (preset === "custom") return "Custom";
  return PERIOD_LABEL[preset];
}

// ── Slug untuk nama file Excel ─────────────────────────────────────────────
const PERIOD_SLUG: Record<PeriodPreset, string> = {
  all:       "Semua-Periode",
  today:     "Hari-Ini",
  yesterday: "Kemarin",
  week:      "Minggu-Ini",
  month:     "Bulan-Ini",
  custom:    "Custom",
};

const SEARCH_FIELD_LABEL: Record<SearchField, string> = {
  all:        "Semua",
  no_sj:      "No-SJ",
  sn:         "SN",
  pembawa:    "Pembawa",
  tujuan:     "Tujuan",
  jenis:      "Jenis",
  merk:       "Merk",
  status:     "Status",
  keterangan: "Keterangan",
};

/**
 * Build nama file Excel berdasarkan filter aktif.
 * Format: Report-Alokasi-{Periode}-sort-by-{Field}-{Value}
 * Contoh: Report-Alokasi-Minggu-Ini-sort-by-Jenis-CPU
 */
function buildExcelFilename(
  periodPreset: PeriodPreset,
  dateFrom: string,
  dateTo: string,
  searchField: SearchField,
  search: string,
  jenisSJ: JenisSJFilter = "all",
): string {
  const basePeriod = periodPreset === "custom" && dateFrom && dateTo
    ? `${dateFrom}-sd-${dateTo}`
    : PERIOD_SLUG[periodPreset];
  const period = JENIS_SJ_SLUG[jenisSJ] ? `${JENIS_SJ_SLUG[jenisSJ]}-${basePeriod}` : basePeriod;

  const cleanSearch = search.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");

  if (searchField !== "all" && cleanSearch) {
    const fieldLabel = SEARCH_FIELD_LABEL[searchField];
    return `Report-Alokasi-${period}-sort-by-${fieldLabel}-${cleanSearch}`;
  }

  return `Report-Alokasi-${period}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-slate-500/10 text-slate-300 border-slate-500/20",
  submitted: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", completed: "Completed",
};

const StatusBadge = memo(({ status }: { status: string }) => (
  <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
    STATUS_STYLES[status] ?? STATUS_STYLES.draft
  }`}>
    {STATUS_LABEL[status] ?? status}
  </span>
));
StatusBadge.displayName = "StatusBadge";

// ─── Pagination ───────────────────────────────────────────────────────────
const Pagination = memo(({ page, totalPages, onPage, totalItems, pageSize }: {
  page: number; totalPages: number; onPage: (p: number) => void;
  totalItems: number; pageSize: number;
}) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
      <p className="text-xs text-white/30">
        Menampilkan <span className="text-white/60">{from}–{to}</span> dari <span className="text-white/60">{totalItems.toLocaleString()}</span> item
      </p>
      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPage(page - 1)} disabled={page === 1}>‹</PageBtn>
        {buildPageNums(page, totalPages).map((p, i) =>
          p === "…"
            ? <span key={`e-${i}`} className="px-1 text-xs text-white/20">…</span>
            : <PageBtn key={p} onClick={() => onPage(p as number)} active={p === page}>{p}</PageBtn>
        )}
        <PageBtn onClick={() => onPage(page + 1)} disabled={page === totalPages}>›</PageBtn>
      </div>
    </div>
  );
});
Pagination.displayName = "Pagination";

function buildPageNums(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  if (current > 3) pages.push("…");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

const PageBtn = memo(({ active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean; children: React.ReactNode;
}) => (
  <button {...props} className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors ${
    active
      ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
      : "text-white/40 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-25"
  }`}>{children}</button>
));
PageBtn.displayName = "PageBtn";

interface AllocationState {
  kode_asset: string;
  mutasi_oracle: boolean;
  mutasi_wt: boolean;
}

const AllocationCell = memo(({
  itemId, isAktiva, isMutated, initialKode, initialMutasi, initialMutasiWT, usedKodes, onSaved,
}: {
  itemId: string;
  isAktiva: boolean;
  isMutated: boolean;
  initialKode: string;
  initialMutasi: boolean;
  initialMutasiWT: boolean;
  usedKodes: Set<string>;
  onSaved: (itemId: string, next: AllocationState) => void;
}) => {
  const [kode, setKode]         = useState(initialKode);
  const [mutasi, setMutasi]     = useState(initialMutasi);
  const [saving, setSaving]     = useState(false);
  const [dupError, setDupError] = useState(false);
  const lastSaved  = useRef<AllocationState>({ kode_asset: initialKode, mutasi_oracle: initialMutasi, mutasi_wt: initialMutasiWT });
  const mutasiRef  = useRef(initialMutasi);
  const mutasiWTRef = useRef(initialMutasiWT);

  useEffect(() => {
    setKode(initialKode);
    setMutasi(initialMutasi);
    mutasiRef.current = initialMutasi;
    mutasiWTRef.current = initialMutasiWT;
    lastSaved.current = { kode_asset: initialKode, mutasi_oracle: initialMutasi, mutasi_wt: initialMutasiWT };
  }, [initialKode, initialMutasi, initialMutasiWT]);

  const persist = useCallback(async (next: Omit<AllocationState, 'mutasi_wt'>) => {
    if (
      next.kode_asset === lastSaved.current.kode_asset &&
      next.mutasi_oracle === lastSaved.current.mutasi_oracle
    ) return;

    setSaving(true);
    try {
      const res = await fetch("/api/sj/report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          kode_asset: next.kode_asset,
          mutasi_oracle_status: next.mutasi_oracle,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const merged: AllocationState = { ...next, mutasi_wt: mutasiWTRef.current };
        lastSaved.current = merged;
        onSaved(itemId, merged);
      } else if (res.status === 409) {
        setKode(lastSaved.current.kode_asset);
        setMutasi(lastSaved.current.mutasi_oracle);
      }
    } catch {
      // diam — biarkan user retry
    } finally {
      setSaving(false);
    }
  }, [itemId, onSaved]);


  const handleKodeBlur = useCallback(() => {
    const trimmed = kode.trim();
    if (trimmed && trimmed !== (initialKode ?? '').trim() && usedKodes.has(trimmed)) {
      setDupError(true);
      return;
    }
    setDupError(false);
    // Mutasi Oracle TIDAK lagi otomatis ter-checklist saat kode_asset diisi.
    // Ada case user sudah input kode aset tapi belum bisa mutasi Oracle karena
    // kendala teknis. Checkbox mutasi murni dikontrol manual oleh user.
    // Kalau kode dikosongkan, mutasi ikut di-reset false (tidak ada kode = tidak mungkin mutasi).
    const currentMutasi = mutasiRef.current;
    const nextMutasi = trimmed ? currentMutasi : false;
    if (nextMutasi !== currentMutasi) {
      mutasiRef.current = nextMutasi;
      setMutasi(nextMutasi);
    }
    persist({ kode_asset: trimmed, mutasi_oracle: nextMutasi });
  }, [kode, initialKode, usedKodes, persist]);

  const handleCheckbox = useCallback(() => {
    if (!isAktiva) return;
    const next = !mutasiRef.current;
    mutasiRef.current = next;
    setMutasi(next);
    persist({ kode_asset: kode.trim(), mutasi_oracle: next });
  }, [kode, isAktiva, persist]);

  if (isMutated) {
    const lockedByDAT = !!kode.trim();
    return (
      <div className="group flex items-center gap-1.5">
        {kode.trim() ? (
          <span className="font-mono text-[10px] text-emerald-400/80 truncate" title={kode}>{kode}</span>
        ) : (
          <span className="text-[10px] text-white/30">—</span>
        )}
        <span
          className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 whitespace-nowrap"
          title={lockedByDAT ? "Sudah dimutasi — kode aset hilang dari DAT terbaru" : "Dikonfirmasi mutasi secara manual"}
        >
          ✓ Dimutasi
        </span>
        {!lockedByDAT && (
          <button
            type="button"
            onClick={() => { setMutasi(false); persist({ kode_asset: "", mutasi_oracle: false }); }}
            className="text-[9px] text-white/30 hover:text-rose-300 underline decoration-dotted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Batalkan konfirmasi mutasi manual"
          >
            batalkan
          </button>
        )}
        {saving && <span className="text-[9px] text-white/30">…</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="text"
          value={kode}
          onChange={(e) => { setKode(e.target.value); setDupError(false); }}
          onBlur={handleKodeBlur}
          placeholder={isAktiva ? "—" : "non-AT"}
          disabled={!isAktiva}
          suppressHydrationWarning
          className={`w-[110px] bg-white/[0.04] border text-[10px] font-mono placeholder:text-white/20 rounded-md px-2 py-1 focus:outline-none transition-opacity ${
            !isAktiva
              ? "border-white/[0.08] text-white/20 cursor-not-allowed opacity-40"
              : dupError
              ? "border-rose-500/60 text-rose-300 focus:border-rose-500"
              : "border-white/[0.08] text-cyan-300 cursor-text focus:border-cyan-500/50"
          }`}
        />
        {dupError && (
          <span className="absolute left-0 top-full mt-0.5 text-[9px] text-rose-400 whitespace-nowrap">
            kode sudah dipakai
          </span>
        )}
      </div>
      <label
        className={`inline-flex items-center ${isAktiva ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        title={isAktiva ? "Tandai sudah mutasi Oracle" : "Barang non-AT tidak perlu mutasi Oracle"}
      >
        <input
          type="checkbox"
          checked={mutasi}
          onChange={handleCheckbox}
          disabled={!isAktiva}
          suppressHydrationWarning
          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-emerald-500"
        />
      </label>
      {saving && <span className="text-[9px] text-white/30">…</span>}
    </div>
  );
});
AllocationCell.displayName = "AllocationCell";

// ─── Mutasi WT Cell ────────────────────────────────────────────────────────
const MutasiWTCell = memo(({ itemId, isAktiva, initialMutasiWT, onSaved }: {
  itemId: string;
  isAktiva: boolean;
  initialMutasiWT: boolean;
  onSaved: (itemId: string, mutasiWT: boolean) => void;
}) => {
  const [mutasiWT, setMutasiWT] = useState(initialMutasiWT);
  const [saving, setSaving]     = useState(false);
  const wtRef = useRef(initialMutasiWT);

  useEffect(() => {
    setMutasiWT(initialMutasiWT);
    wtRef.current = initialMutasiWT;
  }, [initialMutasiWT]);

  const persist = useCallback(async (next: boolean) => {
    wtRef.current = next;
    setMutasiWT(next);
    setSaving(true);
    try {
      const res = await fetch("/api/sj/report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, mutasi_wt_status: next }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(itemId, next);
      }
    } catch {
      // diam — nilai lokal tetap
    } finally {
      setSaving(false);
    }
  }, [itemId, onSaved]);

  // Non-AT → disabled, tidak perlu mutasi WT
  if (!isAktiva) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <input
          type="checkbox"
          checked={false}
          disabled
          suppressHydrationWarning
          className="h-3.5 w-3.5 rounded border-white/10 bg-white/[0.02] opacity-30 cursor-not-allowed"
        />
      </div>
    );
  }

  // Sudah dicentang → teks statis + tombol batalkan (hover-reveal)
  if (mutasiWT) {
    return (
      <div className="group flex items-center justify-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md border bg-violet-500/10 text-violet-400 border-violet-500/20 whitespace-nowrap">
          ✓ WT
        </span>
        <button
          type="button"
          onClick={() => persist(false)}
          className="text-[9px] text-white/30 hover:text-rose-300 underline decoration-dotted opacity-0 group-hover:opacity-100 transition-opacity"
          title="Batalkan konfirmasi mutasi WT"
        >
          batalkan
        </button>
        {saving && <span className="text-[9px] text-white/30">…</span>}
      </div>
    );
  }

  // Belum dicentang → checkbox normal
  return (
    <div className="flex items-center justify-center gap-1.5">
      <label className="inline-flex items-center cursor-pointer" title="Tandai sudah mutasi Web Tracking">
        <input
          type="checkbox"
          checked={false}
          onChange={() => persist(true)}
          suppressHydrationWarning
          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-violet-500"
        />
      </label>
      {saving && <span className="text-[9px] text-white/30">…</span>}
    </div>
  );
});
MutasiWTCell.displayName = "MutasiWTCell";

// ─── Mutasi "Keduanya" ────────────────────────────────────────────────────
// Satu checkbox untuk menandai mutasi Oracle + WT sekaligus.
//
// Kenapa perlu: mutasi Oracle dan WT dikerjakan di dua program berbeda dan
// tidak bisa bersamaan. Kalau user mencentang salah satu duluan, baris itu
// langsung hilang dari filter "Belum Keduanya" padahal pekerjaannya belum
// selesai. Dengan checkbox ini user bisa menunda penandaan sampai kedua
// program benar-benar sudah dimutasi, lalu tandai sekali klik.
//
// Catatan: kode_asset ikut dikirim apa adanya karena API menulis ulang kolom
// itu setiap kali menerima mutasi_oracle_status — kalau tidak disertakan,
// kode aset yang sudah terisi akan terhapus jadi null.
const MutasiBothCell = memo(({ itemId, isAktiva, kodeAsset, mutasiOracle, mutasiWT, onSaved }: {
  itemId: string;
  isAktiva: boolean;
  kodeAsset: string;
  mutasiOracle: boolean;
  mutasiWT: boolean;
  onSaved: (itemId: string, val: boolean, kodeAsset: string) => void;
}) => {
  const [saving, setSaving] = useState(false);
  const bothOn = mutasiOracle && mutasiWT;

  const persist = useCallback(async (next: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/sj/report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: itemId,
          kode_asset: kodeAsset,
          mutasi_oracle_status: next,
          mutasi_wt_status: next,
        }),
      });
      const json = await res.json();
      if (json.success) onSaved(itemId, next, kodeAsset);
    } catch {
      // diam — biarkan user retry
    } finally {
      setSaving(false);
    }
  }, [itemId, kodeAsset, onSaved]);

  if (!isAktiva) {
    return (
      <div className="flex items-center justify-center">
        <input
          type="checkbox" checked={false} disabled suppressHydrationWarning
          className="h-3.5 w-3.5 rounded border-white/10 bg-white/[0.02] opacity-30 cursor-not-allowed"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="checkbox"
        checked={bothOn}
        disabled={saving}
        onChange={() => persist(!bothOn)}
        suppressHydrationWarning
        title={bothOn ? "Batalkan kedua mutasi" : "Tandai mutasi Oracle + WT sekaligus"}
        className="h-3.5 w-3.5 rounded border-white/20 bg-white/[0.04] accent-emerald-500 cursor-pointer disabled:opacity-40"
      />
      {saving && <span className="text-[9px] text-white/30">...</span>}
    </div>
  );
});
MutasiBothCell.displayName = "MutasiBothCell";

// ─── Main Page ────────────────────────────────────────────────────────────
export default function SJReportPage() {
  const { items, loading } = useSJReport();

  // Local override alokasi (biar tidak perlu refetch seluruh data setelah save)
  const [allocOverride, setAllocOverride] = useState<Record<string, AllocationState>>({});
  const handleAllocSaved = useCallback((itemId: string, next: AllocationState) => {
    setAllocOverride((prev) => ({ ...prev, [itemId]: next }));
  }, []);

  // Override khusus mutasi_wt — di-merge ke AllocationState yang sama agar
  // konsisten dengan source of truth allocOverride dan tidak hilang saat
  // pindah halaman pagination (root cause bug: MutasiWTCell sebelumnya
  // hanya punya state lokal, hilang saat row di-unmount/remount).
  const handleWtSaved = useCallback((itemId: string, mutasiWT: boolean, fallback: AllocationState) => {
    setAllocOverride((prev) => {
      const current = prev[itemId] ?? fallback;
      return { ...prev, [itemId]: { ...current, mutasi_wt: mutasiWT } };
    });
  }, []);

  // Checkbox "Keduanya" — set mutasi Oracle & WT sekaligus di override lokal
  const handleBothSaved = useCallback((itemId: string, val: boolean, kodeAsset: string) => {
    setAllocOverride((prev) => ({
      ...prev,
      [itemId]: { kode_asset: kodeAsset, mutasi_oracle: val, mutasi_wt: val },
    }));
  }, []);

  // Kode aset yang MASIH aktif dipakai — untuk mencegah salah ketik kode kembar.
  //
  // Item yang sudah DIMUTASI sengaja TIDAK dihitung. Alasannya: satu aset punya
  // siklus hidup berulang — masuk ke gudang lewat SJ Penerimaan, lalu dikirim
  // lagi ke toko lewat SJ Keluar dengan kode aset yang sama. Begitu sebuah item
  // terkonfirmasi mutasi, baris itu jadi CATATAN RIWAYAT, bukan pemakaian aktif,
  // sehingga kodenya harus bebas dipakai lagi di surat jalan berikutnya.
  //
  // Sebelumnya semua item ikut dihitung, sehingga kode yang sudah selesai
  // dimutasi di SJ Penerimaan memblokir input kode yang sama di SJ Keluar.
  // Daftar kode kategori yang benar-benar ada di data (huruf depan kategori_oracle,
  // mis. "C - PERALATAN KOMPUTER" → "C"). Tombol filter dibuat dari sini supaya
  // otomatis mengikuti kategori yang ada di DAT.
  const kategoriCodes = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const kat = (it.kategori ?? "").trim();
      if (!kat) continue;
      const code = kat.charAt(0).toUpperCase();
      if (code) set.add(code);
    }
    return Array.from(set).sort();
  }, [items]);

  const toggleKategori = useCallback((code: string) => {
    setKatFilter(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setPage(1);
  }, []);

  const usedKodes = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) {
      const override = allocOverride[it.item_id];
      const kode = override ? override.kode_asset : it.kode_asset;
      if (!kode || !kode.trim()) continue;

      // Status mutasi terkini: pakai override kalau user baru saja mengubahnya
      const mutated = override
        ? (override.kode_asset ? it.is_mutated : override.mutasi_oracle)
        : it.is_mutated;
      if (mutated) continue;   // sudah selesai → riwayat, bukan pemakaian aktif

      s.add(kode.trim());
    }
    return s;
  }, [items, allocOverride]);

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [searchField, setSearchField]   = useState<SearchField>("all");
  const [search, setSearch]             = useState("");
  const [mutasiFilter, setMutasiFilter] = useState<MutasiFilter>("all");
  const [jenisSJFilter, setJenisSJFilter] = useState<JenisSJFilter>("all");
  // Multi-pilih kategori. Set KOSONG = tanpa filter (semua kategori tampil).
  // Klik tombol = toggle: masuk Set kalau belum ada, keluar kalau sudah ada.
  const [katFilter, setKatFilter]       = useState<Set<string>>(new Set());
  const [page, setPage]                 = useState(1);

  // Period preset handler
  const handlePeriodPreset = useCallback((preset: PeriodPreset) => {
    setPeriodPreset(preset);
    setPage(1);
    if (preset !== "custom") {
      const { from, to } = getPresetRange(preset);
      setDateFrom(from);
      setDateTo(to);
    }
  }, []);

  const handleDateFrom = useCallback((v: string) => {
    setDateFrom(v); setPeriodPreset("custom"); setPage(1);
  }, []);
  const handleDateTo = useCallback((v: string) => {
    setDateTo(v); setPeriodPreset("custom"); setPage(1);
  }, []);

  // ── Filter logic ───────────────────────────────────────────────────────
  // baseFiltered = semua filter KECUALI jenis SJ (dipakai untuk angka di tombol Keluar/Masuk);
  // filtered = baseFiltered + filter jenis SJ → tabel, statistik, dan Export Excel.
  const baseFiltered = useMemo(() => {
    let result = items;

    // Date range
    if (dateFrom || dateTo) {
      result = result.filter(it => isInDateRange(it.tanggal, dateFrom, dateTo));
    }

    // Search by kolom
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(it => {
        switch (searchField) {
          case "no_sj":      return it.no_sj.toLowerCase().includes(q);
          case "sn":         return it.serial_number.toLowerCase().includes(q);
          case "pembawa":    return it.pembawa.toLowerCase().includes(q);
          case "tujuan":     return (it.tujuan_kode + " " + it.tujuan_nama).toLowerCase().includes(q);
          case "jenis":      return it.jenis.toLowerCase().includes(q);
          case "merk":       return (it.merk ?? "").toLowerCase().includes(q);
          case "status":     return it.status.toLowerCase().includes(q) ||
                                    (STATUS_LABEL[it.status] ?? it.status).toLowerCase().includes(q);
          case "keterangan": return it.keterangan.toLowerCase().includes(q);
          default: // "all"
            return (
              it.no_sj.toLowerCase().includes(q) ||
              it.serial_number.toLowerCase().includes(q) ||
              it.pembawa.toLowerCase().includes(q) ||
              (it.tujuan_kode + " " + it.tujuan_nama).toLowerCase().includes(q) ||
              it.jenis.toLowerCase().includes(q) ||
              (it.merk ?? "").toLowerCase().includes(q) ||
              it.status.toLowerCase().includes(q) ||
              it.keterangan.toLowerCase().includes(q)
            );
        }
      });
    }

    // Filter status mutasi — untuk review item yang belum dimutasi.
    // Resolve nilai dengan override (allocOverride) agar akurat setelah user
    // baru ubah checkbox tanpa refetch. Hanya item is_aktiva yang relevan
    // (barang non-AT tidak perlu mutasi Oracle/WT).
    // Filter kategori (huruf depan kategori_oracle, mis. "C - PERALATAN KOMPUTER").
    // Multi-pilih: item lolos kalau kategorinya ada di salah satu yang dipilih.
    if (katFilter.size > 0) {
      result = result.filter(it =>
        katFilter.has((it.kategori ?? "").trim().charAt(0).toUpperCase()));
    }

    if (mutasiFilter !== "all") {
      result = result.filter(it => {
        if (!it.is_aktiva) return false;  // non-AT tidak masuk review mutasi
        const override = allocOverride[it.item_id];
        const oracleOn = override ? override.mutasi_oracle : it.mutasi_oracle;
        const wtOn     = override ? override.mutasi_wt     : it.mutasi_wt;
        switch (mutasiFilter) {
          case "belum_oracle":   return !oracleOn;
          case "belum_wt":       return !wtOn;
          case "belum_keduanya": return !oracleOn && !wtOn;
          default:               return true;
        }
      });
    }

    // Sort by No. SJ desc (terbaru di atas) → urutan asc (item dalam 1 SJ berurutan)
    return [...result].sort((a, b) =>
      b.no_sj.localeCompare(a.no_sj) || a.urutan - b.urutan
    );
  }, [items, dateFrom, dateTo, search, searchField, mutasiFilter, katFilter, allocOverride]);

  const jenisSJCount = useMemo(() => {
    const keluar = baseFiltered.filter(it => it.jenis_sj !== "masuk").length;
    return { all: baseFiltered.length, keluar, masuk: baseFiltered.length - keluar };
  }, [baseFiltered]);

  const filtered = useMemo(
    () => jenisSJFilter === "all" ? baseFiltered : baseFiltered.filter(it => (it.jenis_sj === "masuk" ? "masuk" : "keluar") === jenisSJFilter),
    [baseFiltered, jenisSJFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // Reset filter
  const handleReset = useCallback(() => {
    setPeriodPreset("all");
    setDateFrom(""); setDateTo("");
    setSearchField("all"); setSearch("");
    setMutasiFilter("all");
    setJenisSJFilter("all");
    setKatFilter(new Set());
    setPage(1);
  }, []);

  // Export Excel dengan nama file dinamis
  const handleExport = useCallback(() => {
    if (filtered.length === 0) {
      alert("Tidak ada data untuk diekspor. Sesuaikan filter terlebih dahulu.");
      return;
    }
    const filename = buildExcelFilename(periodPreset, dateFrom, dateTo, searchField, search, jenisSJFilter);
    const periodLabel = getPeriodLabel(periodPreset, dateFrom, dateTo)
      + (jenisSJFilter === "keluar" ? " · SJ Keluar" : jenisSJFilter === "masuk" ? " · SJ Masuk (Penerimaan)" : "");
    exportSJReportToExcel({ items: filtered, filename, periodLabel });
  }, [filtered, periodPreset, dateFrom, dateTo, searchField, search, jenisSJFilter]);

  // Stats
  const uniqueSJ     = new Set(filtered.map(it => it.sj_id)).size;
  const uniqueTujuan = new Set(filtered.map(it => it.tujuan_id).filter(Boolean)).size;
  const totalQty     = filtered.reduce((s, it) => s + (it.qty ?? 0), 0);
  const periodLabel  = getPeriodLabel(periodPreset, dateFrom, dateTo);

  const hasActiveFilter = periodPreset !== "all" || !!search.trim() || mutasiFilter !== "all" || katFilter.size > 0 || jenisSJFilter !== "all";

  return (
    <div className="flex h-screen overflow-hidden bg-[#080e18] text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Report Surat Jalan" />
        <main className="flex-1 overflow-y-auto px-6 py-5">

          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Report Surat Jalan</h1>
              <p className="mt-0.5 text-xs text-white/40">
                Filter dan export laporan pengiriman barang berdasarkan periode dan kriteria pencarian
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={loading || filtered.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Excel
            </button>
          </div>

          {/* Filter Panel */}
          <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">

            {/* Row 1: Period preset chips */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mr-1">Periode</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {([
                  { v: "all" as PeriodPreset,       label: "Semua"     },
                  { v: "today" as PeriodPreset,     label: "Hari Ini"  },
                  { v: "yesterday" as PeriodPreset, label: "Kemarin"   },
                  { v: "week" as PeriodPreset,      label: "Minggu Ini"},
                  { v: "month" as PeriodPreset,     label: "Bulan Ini" },
                  { v: "custom" as PeriodPreset,    label: "Custom"    },
                ]).map(p => (
                  <button key={p.v} onClick={() => handlePeriodPreset(p.v)}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border ${
                      periodPreset === p.v
                        ? "bg-white/10 text-white border-white/20"
                        : "text-slate-500 border-transparent hover:text-slate-300 hover:border-white/10"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Jenis SJ — warna sama dengan No. SJ di tabel (keluar cyan, masuk hijau) */}
              <div className="flex flex-wrap items-center gap-1.5 ml-auto" role="group" aria-label="Jenis SJ">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mr-1">Jenis SJ</span>
                {([
                  { v: "all" as const,    label: "Semua",     active: "bg-white/10 text-white border-white/20" },
                  { v: "keluar" as const, label: "SJ Keluar", active: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300" },
                  { v: "masuk" as const,  label: "SJ Masuk",  active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" },
                ]).map(j => (
                  <button key={j.v} onClick={() => { setJenisSJFilter(j.v); setPage(1); }} aria-pressed={jenisSJFilter === j.v}
                    title={j.v === "masuk" ? "Penerimaan Barang (barang masuk dari toko)" : j.v === "keluar" ? "Surat Jalan Manual (barang keluar ke toko)" : "Semua jenis SJ"}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border ${
                      jenisSJFilter === j.v ? j.active : "text-slate-500 border-transparent hover:text-slate-300 hover:border-white/10"
                    }`}>
                    {j.label} <span className="tabular-nums opacity-60">{jenisSJCount[j.v].toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Custom date range */}
            {periodPreset === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-white/40 ml-1">Dari:</span>
                <input type="date" value={dateFrom}
                  onChange={(e) => handleDateFrom(e.target.value)}
                  suppressHydrationWarning
                  className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50"
                />
                <span className="text-[11px] text-white/40">Sampai:</span>
                <input type="date" value={dateTo}
                  onChange={(e) => handleDateTo(e.target.value)}
                  suppressHydrationWarning
                  className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[12px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            )}

            {/* Row: Filter status mutasi (review cepat item belum dimutasi) */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.04]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mr-1">Review Mutasi</span>
              {([
                { value: "all" as const,            label: "Semua",          color: "cyan"    },
                { value: "belum_oracle" as const,   label: "Belum Oracle",   color: "amber"   },
                { value: "belum_wt" as const,       label: "Belum WT",       color: "violet"  },
                { value: "belum_keduanya" as const, label: "Belum Keduanya", color: "rose"    },
              ]).map(chip => {
                const active = mutasiFilter === chip.value;
                const colorCls = active
                  ? chip.color === "cyan"   ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                  : chip.color === "amber"  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : chip.color === "violet" ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                  :                           "bg-rose-500/15 border-rose-500/40 text-rose-300"
                  : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.05]";
                return (
                  <button key={chip.value}
                    onClick={() => { setMutasiFilter(chip.value); setPage(1); }}
                    className={`text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all ${colorCls}`}>
                    {chip.label}
                  </button>
                );
              })}
              {mutasiFilter !== "all" && (
                <span className="text-[10px] text-white/30">
                  {filtered.length} item ditemukan
                </span>
              )}

              {/* Filter kategori — kode huruf dari kategori_oracle DAT.
                  Ikut mempengaruhi tabel DAN ekspor Excel (lewat `filtered`). */}
              {kategoriCodes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 ml-auto">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mr-1">Kategori</span>
                  <button
                    onClick={() => { setKatFilter(new Set()); setPage(1); }}
                    title="Tampilkan semua kategori"
                    className={`text-[11px] font-semibold w-8 h-7 rounded-lg border transition-all ${
                      katFilter.size === 0
                        ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                        : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                    }`}>
                    All
                  </button>
                  {kategoriCodes.map(code => {
                    const active = katFilter.has(code);
                    const contoh = items.find(it => (it.kategori ?? "").trim().charAt(0).toUpperCase() === code);
                    return (
                      <button key={code}
                        onClick={() => toggleKategori(code)}
                        title={`${contoh?.kategori || code}${active ? " — klik untuk matikan" : ""}`}
                        className={`text-[11px] font-semibold w-7 h-7 rounded-lg border transition-all ${
                          active
                            ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                            : "bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                        }`}>
                        {code}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Row 3: Search by field + input + Reset */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.04]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mr-1">Cari</span>
              <div className="w-[160px]">
                <StyledSelect<SearchField>
                  value={searchField}
                  onChange={(v) => { setSearchField(v); setPage(1); }}
                  options={[
                    { value: "all",        label: "Semua Field"   },
                    { value: "tujuan",     label: "Tujuan"        },
                    { value: "jenis",      label: "Jenis Barang"  },
                    { value: "merk",       label: "Merk"          },
                    { value: "status",     label: "Status SJ"     },
                    { value: "no_sj",      label: "No. SJ"        },
                    { value: "sn",         label: "Serial Number" },
                    { value: "pembawa",    label: "Pembawa"       },
                    { value: "keterangan", label: "Keterangan"    },
                  ]}
                />
              </div>
              <div className="relative flex-1 max-w-sm">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input type="text" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={
                    searchField === "status"
                      ? "Draft / Submitted / Completed"
                      : searchField === "tujuan"
                      ? "Cari kode atau nama tujuan..."
                      : searchField === "merk"
                      ? "Cari merk..."
                      : "Cari..."
                  }
                  suppressHydrationWarning
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[12px] placeholder:text-slate-600 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="flex-1" />
              <button
                onClick={handleReset}
                disabled={!hasActiveFilter}
                className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40 disabled:opacity-40 disabled:pointer-events-none transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9" />
                  <polyline points="3 4 3 10 9 10" />
                </svg>
                Reset Filter
              </button>
            </div>
          </div>

          {/* Result info */}
          <div className="mb-3 flex items-center justify-between text-[11px]">
            <p className="text-white/40">
              Menampilkan <span className="text-white/80 font-semibold">{filtered.length.toLocaleString()} item</span>
              {" "}dari <span className="text-white/60">{uniqueSJ}</span> Surat Jalan ke{" "}
              <span className="text-white/60">{uniqueTujuan}</span> tujuan
              {" "}— Total Qty: <span className="text-white/60">{totalQty.toLocaleString()}</span>
            </p>
            <p className="text-white/30">
              Periode: <span className="text-white/60">{periodLabel}</span>
            </p>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-xl shadow-black/30">
            <div className="overflow-x-auto">
              <div className="min-w-[1760px]">
                <div className="grid grid-cols-[90px_180px_140px_100px_130px_100px_80px_50px_50px_70px_180px_90px_150px_80px_70px] gap-2 border-b border-white/[0.06] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                  <span>Tanggal</span>
                  <span>No. SJ</span>
                  <span>Tujuan</span>
                  <span>Pembawa</span>
                  <span>Jenis</span>
                  <span>Merk</span>
                  <span>SN</span>
                  <span>Baru</span>
                  <span className="text-right">Qty</span>
                  <span>Satuan</span>
                  <span>Keterangan</span>
                  <span>Status</span>
                  <span>Kode Aset / Mutasi</span>
                  <span className="text-center">Mutasi WT</span>
                  <span className="text-center">Keduanya</span>
                </div>

                {loading ? (
                  <div className="divide-y divide-white/5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm text-white/40">Tidak ada data untuk filter ini</p>
                    <button onClick={handleReset} className="mt-3 text-xs text-amber-400 hover:text-amber-300">
                      Reset filter →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-white/[0.04]">
                      {paginated.map((it) => {
                        const alloc = allocOverride[it.item_id];
                        const kodeVal   = alloc ? alloc.kode_asset    : it.kode_asset;
                        const mutasiVal = alloc ? alloc.mutasi_oracle : it.mutasi_oracle;
                        const mutasiWtVal = alloc ? alloc.mutasi_wt : it.mutasi_wt;
                        // is_mutated dari server (lock by DAT). Kalau user baru
                        // konfirmasi manual lewat override (kode kosong + mutasi on),
                        // lock langsung tanpa nunggu refetch.
                        const isMutatedVal = alloc
                          ? (alloc.kode_asset ? it.is_mutated : alloc.mutasi_oracle)
                          : it.is_mutated;
                        return (
                        <div key={it.item_id}
                          className="grid grid-cols-[90px_180px_140px_100px_130px_100px_80px_50px_50px_70px_180px_90px_150px_80px_70px] gap-2 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-[11px]">
                          <div className="min-w-0">
                            <p className="text-white/60">{formatTanggal(it.tanggal)}</p>
                            <p className="text-[9px] text-white/30">{formatHari(it.tanggal)}</p>
                          </div>
                          <span className={`font-mono truncate ${it.jenis_sj === 'masuk' ? 'text-emerald-400' : 'text-cyan-400'}`} title={it.no_sj}>{it.no_sj}</span>
                          <div className="min-w-0">
                            <p className="text-white/80 truncate" title={it.tujuan_kode}>{it.tujuan_kode}</p>
                            <p className="text-[9px] text-white/40 truncate" title={it.tujuan_nama}>{it.tujuan_nama}</p>
                          </div>
                          <span className="text-white/60 truncate" title={it.pembawa}>{it.pembawa || "—"}</span>
                          <span className="text-white/70 truncate" title={it.jenis}>{it.jenis || "—"}</span>
                          <span className="text-white/60 truncate" title={it.merk}>{it.merk || "—"}</span>
                          <span className="font-mono text-white/50 truncate" title={it.serial_number}>{it.serial_number || "—"}</span>
                          <span className={`text-[10px] font-medium ${it.is_baru ? "text-emerald-400" : "text-white/30"}`}>
                            {it.is_baru ? "Baru" : "—"}
                          </span>
                          <span className="text-right font-mono text-white/70">{it.qty}</span>
                          <span className="text-white/50">{it.satuan}</span>
                          <span className="text-white/50 truncate" title={it.keterangan}>{it.keterangan || "—"}</span>
                          <div><StatusBadge status={it.status} /></div>
                          <AllocationCell
                            itemId={it.item_id}
                            isAktiva={it.is_aktiva}
                            isMutated={isMutatedVal}
                            initialKode={kodeVal}
                            initialMutasi={mutasiVal}
                            initialMutasiWT={mutasiWtVal}
                            usedKodes={usedKodes}
                            onSaved={handleAllocSaved}
                          />
                          <MutasiWTCell
                            itemId={it.item_id}
                            isAktiva={it.is_aktiva}
                            initialMutasiWT={mutasiWtVal}
                            onSaved={(itemId, mutasiWT) => handleWtSaved(itemId, mutasiWT, {
                              kode_asset: kodeVal,
                              mutasi_oracle: mutasiVal,
                              mutasi_wt: mutasiWtVal,
                            })}
                          />
                          <MutasiBothCell
                            itemId={it.item_id}
                            isAktiva={it.is_aktiva}
                            kodeAsset={kodeVal}
                            mutasiOracle={mutasiVal}
                            mutasiWT={mutasiWtVal}
                            onSaved={handleBothSaved}
                          />
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            <Pagination
              page={page} totalPages={totalPages} onPage={setPage}
              totalItems={filtered.length} pageSize={PAGE_SIZE}
            />
          </div>

        </main>
      </div>
    </div>
  );
}
