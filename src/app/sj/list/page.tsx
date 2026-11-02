"use client";

import { memo, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useSession } from "@/components/SessionContext";
import SummaryCard from "@/components/SummaryCard";
import SJPreviewModal from "@/components/sj/SJPreviewModal";
import { useSJList, useSJDetail, type SJListItem } from "@/hooks/useSJList";
import type { SJDataForPDF } from "@/components/sj/SuratJalanPDF";
import { sjCreatorName } from "@/lib/sjCreator";

type SearchField = "all" | "sn" | "tujuan" | "jenis";
type StatusFilter = "all" | "draft" | "submitted" | "completed";
type PeriodFilter = "all" | "today" | "week" | "month";

const PAGE_SIZE = 20;

function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatHari(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long" });
}

function isInPeriod(tanggal: string, period: PeriodFilter): boolean {
  if (period === "all") return true;
  const d = new Date(tanggal);
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  if (period === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today && d <= now;
  }
  if (period === "week") {
    const week = new Date();
    week.setDate(week.getDate() - 7);
    week.setHours(0, 0, 0, 0);
    return d >= week && d <= now;
  }
  if (period === "month") {
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= month && d <= now;
  }
  return true;
}

const STATUS_STYLES: Record<string, string> = {
  draft:     "bg-slate-500/10 text-slate-300 border-slate-500/20",
  submitted: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", completed: "Completed",
};
const StatusBadge = memo(({ status }: { status: string }) => (
  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
    STATUS_STYLES[status] ?? STATUS_STYLES.draft
  }`}>
    {STATUS_LABEL[status] ?? status}
  </span>
));
StatusBadge.displayName = "StatusBadge";

const JenisBadge = memo(({ jenis }: { jenis?: string }) => (
  jenis === "masuk"
    ? <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">↓ Masuk</span>
    : <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">↑ Keluar</span>
));
JenisBadge.displayName = "JenisBadge";

// ─── Archive Cell ──────────────────────────────────────────────────────────
// Checkbox untuk menandai apakah fisik kertas SJ sudah diarsipkan.
// Independen, save onChange langsung ke /api/sj (mode archive_only).
const ArchiveCell = memo(({ sjId, initialArchived, onSaved }: {
  sjId: string;
  initialArchived: boolean;
  onSaved: (sjId: string, archived: boolean) => void;
}) => {
  const [archived, setArchived] = useState(initialArchived);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    setArchived(initialArchived);
  }, [initialArchived]);

  const handleToggle = useCallback(async () => {
    const next = !archived;
    setArchived(next);
    setSaving(true);
    try {
      const res = await fetch("/api/sj", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sjId, archive_only: true, is_archived: next }),
      });
      const json = await res.json();
      if (json.sj) {
        onSaved(sjId, next);
      } else {
        setArchived(!next);
      }
    } catch {
      setArchived(!next);
    } finally {
      setSaving(false);
    }
  }, [archived, sjId, onSaved]);

  return (
    <div className="flex items-center justify-center gap-1.5">
      <label className="inline-flex items-center cursor-pointer" title="Tandai sudah diarsipkan">
        <input
          type="checkbox"
          checked={archived}
          onChange={handleToggle}
          suppressHydrationWarning
          className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-cyan-500"
        />
      </label>
      {saving && <span className="text-[9px] text-white/30">…</span>}
    </div>
  );
});
ArchiveCell.displayName = "ArchiveCell";

// ─── Reschedule Modal ─────────────────────────────────────────────────────
interface RescheduleModalProps {
  sj: SJListItem;
  onClose: () => void;
  onSuccess: (newTanggal: string) => void;  // pass new date untuk trigger preview
}

const RescheduleModal = memo(({ sj, onClose, onSuccess }: RescheduleModalProps) => {
  const [tanggal, setTanggal] = useState(sj.tanggal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = useCallback(async () => {
    setError("");
    if (!tanggal) { setError("Tanggal wajib diisi"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/sj", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sj.id, tanggal, reschedule_only: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Gagal reschedule");
      }
      onSuccess(tanggal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }, [tanggal, sj.id, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Reschedule Surat Jalan</h3>
        <p className="text-xs text-white/40 mb-4">
          {sj.no_sj} — {sj.tujuan?.kode} {sj.tujuan?.nama}
        </p>

        <div>
          <label className="block text-[11px] font-medium text-white/50 mb-1.5">Tanggal Baru *</label>
          <input
            type="date" value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            suppressHydrationWarning
            className="w-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[12px] rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        {error && <p className="text-xs text-rose-400 mt-3">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50">
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
});
RescheduleModal.displayName = "RescheduleModal";

// ─── Delete Modal ─────────────────────────────────────────────────────────
interface DeleteModalProps { sj: SJListItem; onClose: () => void; onSuccess: () => void; }
const DeleteModal = memo(({ sj, onClose, onSuccess }: DeleteModalProps) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = useCallback(async () => {
    setError(""); setDeleting(true);
    try {
      const res = await fetch(`/api/sj?id=${sj.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal hapus");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setDeleting(false); }
  }, [sj.id, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <h3 className="text-sm font-semibold text-white mb-2">Hapus Surat Jalan?</h3>
        <p className="text-xs text-white/50 mb-1"><span className="text-rose-400 font-semibold">{sj.no_sj}</span></p>
        <p className="text-xs text-white/50 mb-4">{sj.tujuan?.kode} — {sj.tujuan?.nama} ({sj.items_count} item)</p>
        <p className="text-xs text-amber-400/80 mb-4">⚠ Surat Jalan beserta semua item-nya akan dihapus permanen.</p>
        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={deleting} className="px-4 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/5">Batal</button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50">
            {deleting ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
});
DeleteModal.displayName = "DeleteModal";

// ─── Wrapper untuk fetch detail + tampilkan preview modal ────────────────
interface PreviewWrapperProps {
  sjId: string;
  title?: string;
  onClose: () => void;
}

const PreviewWrapper = memo(({ sjId, title, onClose }: PreviewWrapperProps) => {
  const { sj, loading, error } = useSJDetail(sjId);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
        <div className="text-center text-white/60">
          <svg className="animate-spin mx-auto mb-3 text-cyan-400" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2A10 10 0 1 1 2 12" /></svg>
          <p className="text-sm">Memuat data SJ...</p>
        </div>
      </div>
    );
  }

  if (error || !sj) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        <div className="bg-[#0d1117] border border-rose-500/30 rounded-2xl p-6 max-w-md">
          <p className="text-sm text-rose-400 mb-3">Gagal memuat data SJ</p>
          <p className="text-xs text-white/50 mb-4">{error ?? "SJ tidak ditemukan"}</p>
          <button onClick={onClose} className="text-xs text-cyan-400 hover:text-cyan-300">Tutup</button>
        </div>
      </div>
    );
  }

  // Build PDF data dari detail SJ
  const tujuan = Array.isArray(sj.tujuan) ? sj.tujuan[0] : sj.tujuan;
  const pdfData: SJDataForPDF = {
    no_sj:       sj.no_sj,
    tanggal:     sj.tanggal,
    tujuan_kode: tujuan?.kode ?? "",
    tujuan_nama: tujuan?.nama ?? "",
    pembawa:     sj.pembawa ?? "",
    penerima:    sj.penerima ?? "",
    approved_by: sj.approved_by ?? "SPV/Manager",
    created_by:  sjCreatorName(sj.created_by),
    items: (sj.items ?? []).map((it: any, idx: number) => ({
      urutan:        idx + 1,
      jenis:         it.jenis ?? "",
      merk:          it.merk ?? "",
      serial_number: it.serial_number ?? "",
      qty:           it.qty ?? 1,
      satuan:        it.satuan ?? "Unit",
      is_baru:       !!it.is_baru,
      is_aktiva:     !!it.is_aktiva,
      keterangan:    it.keterangan ?? "",
      kode_asset:    it.kode_asset ?? "",
    })),
  };

  return <SJPreviewModal data={pdfData} title={title} onClose={onClose} />;
});
PreviewWrapper.displayName = "PreviewWrapper";

// ─── Pagination ───────────────────────────────────────────────────────────
const Pagination = memo(({ page, totalPages, onPage, totalItems, pageSize }: {
  page: number; totalPages: number; onPage: (p: number) => void;
  totalItems: number; pageSize: number;
}) => {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
      <p className="text-xs text-white/30">
        Menampilkan <span className="text-white/60">{from}–{to}</span> dari <span className="text-white/60">{totalItems.toLocaleString()}</span> SJ
      </p>
      <div className="flex items-center gap-1">
        <PageBtn onClick={() => onPage(page - 1)} disabled={page === 1}>‹</PageBtn>
        {buildPageNums(page, totalPages).map((p, i) =>
          p === "…" ? <span key={`e-${i}`} className="px-1 text-xs text-white/20">…</span>
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

const PageBtn = memo(({ active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: React.ReactNode }) => (
  <button {...props} className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors ${
    active ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
           : "text-white/40 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-25"
  }`}>{children}</button>
));
PageBtn.displayName = "PageBtn";

// ─── Main Page ────────────────────────────────────────────────────────────
export default function SJListPage() {
  const router = useRouter();
  const { isSuperAdmin } = useSession();
  const { list, loading, refresh } = useSJList();

  const [searchField, setSearchField]   = useState<SearchField>("all");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [page, setPage]                 = useState(1);

  const [rescheduleTarget, setRescheduleTarget] = useState<SJListItem | null>(null);
  const [deleteTarget, setDeleteTarget]         = useState<SJListItem | null>(null);

  // Local override is_archived — source of truth setelah toggle, agar tidak
  // hilang saat pindah pagination (row unmount/remount sebelum refetch).
  const [archiveOverride, setArchiveOverride] = useState<Record<string, boolean>>({});
  const handleArchiveSaved = useCallback((sjId: string, archived: boolean) => {
    setArchiveOverride((prev) => ({ ...prev, [sjId]: archived }));
  }, []);

  // Preview state: { sjId, title }
  const [previewState, setPreviewState] = useState<{ sjId: string; title: string } | null>(null);

  const filtered = useMemo(() => {
    let result = list;
    if (statusFilter !== "all") result = result.filter(sj => sj.status === statusFilter);
    if (periodFilter !== "all") result = result.filter(sj => isInPeriod(sj.tanggal, periodFilter));

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(sj => {
        if (searchField === "sn" || searchField === "all")
          if (sj.sn_list.some(sn => sn.toLowerCase().includes(q))) return true;
        if (searchField === "tujuan" || searchField === "all") {
          if (sj.tujuan?.kode.toLowerCase().includes(q)) return true;
          if (sj.tujuan?.nama.toLowerCase().includes(q)) return true;
        }
        if (searchField === "jenis" || searchField === "all")
          if (sj.jenis_list.some(j => j.toLowerCase().includes(q))) return true;
        if (searchField === "all") {
          if (sj.no_sj.toLowerCase().includes(q)) return true;
          if (sj.pembawa.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    return result;
  }, [list, searchField, search, statusFilter, periodFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const handleSearch       = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleSearchField  = useCallback((v: SearchField) => { setSearchField(v); setPage(1); }, []);
  const handleStatusFilter = useCallback((v: StatusFilter) => { setStatusFilter(v); setPage(1); }, []);
  const handlePeriodFilter = useCallback((v: PeriodFilter) => { setPeriodFilter(v); setPage(1); }, []);

  const summary = useMemo(() => {
    const totalSJ      = list.length;
    const totalItems   = list.reduce((s, sj) => s + sj.items_count, 0);
    const draft        = list.filter(sj => sj.status === "draft").length;
    const submitted    = list.filter(sj => sj.status === "submitted").length;
    const completed    = list.filter(sj => sj.status === "completed").length;
    return { totalSJ, totalItems, draft, submitted, completed };
  }, [list]);

  // Handler: setelah reschedule sukses → buka preview
  const handleRescheduleSuccess = useCallback((sjId: string) => {
    setRescheduleTarget(null);
    refresh();
    setPreviewState({ sjId, title: "Surat Jalan Berhasil Direschedule" });
  }, [refresh]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#080e18] text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Daftar Surat Jalan" />
        <main className="flex-1 overflow-y-auto px-6 py-5">

          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Daftar Surat Jalan</h1>
              <p className="mt-0.5 text-xs text-white/40">
                Kelola seluruh Surat Jalan yang sudah dibuat — print, edit, reschedule, atau hapus
              </p>
            </div>
            <Link href="/sj/buat"
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
              Buat SJ Baru
            </Link>
          </div>

          <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard
              title="Total Surat Jalan"
              value={loading ? "—" : summary.totalSJ.toLocaleString()}
              subtitle="Semua status"
              accentColor="cyan"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
            />
            <SummaryCard
              title="Total Items Dikirim"
              value={loading ? "—" : summary.totalItems.toLocaleString()}
              subtitle="Akumulasi dari semua SJ"
              accentColor="violet"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>}
            />
            <SummaryCard
              title="Breakdown Status"
              value={loading ? "—" : `${summary.submitted + summary.completed}/${summary.totalSJ}`}
              subtitle={`Draft: ${summary.draft} · Submit: ${summary.submitted} · Done: ${summary.completed}`}
              accentColor="amber"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-xl shadow-black/30">

            <div className="border-b border-white/[0.06] px-5 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                {([
                  { v: "all" as StatusFilter,       label: "Semua" },
                  { v: "draft" as StatusFilter,     label: "Draft" },
                  { v: "submitted" as StatusFilter, label: "Submitted" },
                  { v: "completed" as StatusFilter, label: "Completed" },
                ]).map(s => (
                  <button key={s.v} onClick={() => handleStatusFilter(s.v)}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border ${
                      statusFilter === s.v
                        ? "bg-white/10 text-white border-white/20"
                        : "text-slate-500 border-transparent hover:text-slate-300 hover:border-white/10"
                    }`}>{s.label}</button>
                ))}
              </div>

              <select value={periodFilter}
                onChange={(e) => handlePeriodFilter(e.target.value as PeriodFilter)}
                suppressHydrationWarning
                className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50">
                <option value="all">Semua Periode</option>
                <option value="today">Hari Ini</option>
                <option value="week">7 Hari Terakhir</option>
                <option value="month">Bulan Ini</option>
              </select>

              <div className="flex-1" />

              <div className="flex items-center gap-2">
                <select value={searchField}
                  onChange={(e) => handleSearchField(e.target.value as SearchField)}
                  suppressHydrationWarning
                  className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[11px] rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500/50">
                  <option value="all">Semua Field</option>
                  <option value="sn">Serial Number</option>
                  <option value="tujuan">Kode/Nama Tujuan</option>
                  <option value="jenis">Jenis Barang</option>
                </select>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
                    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input type="text" value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Cari..." suppressHydrationWarning
                    className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[12px] placeholder:text-slate-600 rounded-xl pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:border-cyan-500/50" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[200px_100px_50px_160px_80px_60px_100px_70px_165px] gap-3 border-b border-white/[0.06] px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
              <span>No. SJ</span>
              <span>Tanggal</span>
              <span>Jenis</span>
              <span>Tujuan / Asal</span>
              <span>Pembawa</span>
              <span className="text-right">Items</span>
              <span>Status</span>
              <span className="text-center">Arsip</span>
              <span className="text-center">Aksi</span>
            </div>

            {loading ? (
              <div className="divide-y divide-white/5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-5 py-3"><div className="h-4 bg-white/5 rounded w-1/2 animate-pulse" /></div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-white/40">
                  {list.length === 0 ? "Belum ada Surat Jalan" : "Tidak ada hasil untuk filter ini"}
                </p>
                {list.length === 0 && (
                  <Link href="/sj/buat" className="inline-block mt-3 text-xs text-cyan-400 hover:text-cyan-300">
                    Buat SJ pertama →
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/[0.04]">
                  {paginated.map(sj => {
                    const archivedVal = archiveOverride[sj.id] ?? sj.is_archived;
                    return (
                    <div key={sj.id} className="grid grid-cols-[200px_100px_50px_160px_80px_60px_100px_70px_165px] gap-3 items-center px-5 py-3 hover:bg-white/[0.02] transition-colors">
                      <span className="text-[11px] font-mono font-semibold text-cyan-400 truncate" title={sj.no_sj}>{sj.no_sj}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] text-white/70">{formatTanggal(sj.tanggal)}</p>
                        <p className="text-[9px] text-white/30">{formatHari(sj.tanggal)}</p>
                      </div>
                      <div><JenisBadge jenis={sj.jenis} /></div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-white/80 truncate">{sj.tujuan?.kode ?? "-"}</p>
                        <p className="text-[10px] text-white/40 truncate">{sj.tujuan?.nama ?? "-"}</p>
                      </div>
                      <span className="text-[11px] text-white/60 truncate" title={sj.pembawa}>{sj.pembawa || "—"}</span>
                      <span className="text-[11px] font-mono text-white/70 text-right">{sj.items_count}</span>
                      <div><StatusBadge status={sj.status} /></div>
                      <ArchiveCell sjId={sj.id} initialArchived={archivedVal} onSaved={handleArchiveSaved} />

                      <div className="flex items-center justify-center gap-0.5">
                        {/* Print/Preview button (icon printer hijau) */}
                        <button
                          onClick={() => setPreviewState({ sjId: sj.id, title: `Surat Jalan ${sj.no_sj}` })}
                          title="Print / Preview PDF"
                          className="flex items-center justify-center w-7 h-7 rounded-md text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                          </svg>
                        </button>
                        <button
                          onClick={() => router.push(
                            sj.jenis === 'masuk'
                              ? `/sj/masuk?edit=${sj.id}`
                              : `/sj/buat?edit=${sj.id}`
                          )}
                          title={sj.jenis === 'masuk' ? "Edit Penerimaan Barang" : "Edit Surat Jalan"}
                          className="flex items-center justify-center w-7 h-7 rounded-md text-blue-400/60 hover:text-blue-300 hover:bg-blue-500/10 transition-all">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button onClick={() => setRescheduleTarget(sj)} title="Reschedule"
                          className="flex items-center justify-center w-7 h-7 rounded-md text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10 transition-all">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        </button>
                        <button onClick={() => setDeleteTarget(sj)} title="Hapus"
                          className={`flex items-center justify-center w-7 h-7 rounded-md text-rose-400/60 hover:text-rose-300 hover:bg-rose-500/10 transition-all ${!isSuperAdmin ? "hidden" : ""}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /></svg>
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <Pagination page={page} totalPages={totalPages} onPage={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
              </>
            )}
          </div>
        </main>
      </div>

      {rescheduleTarget && (
        <RescheduleModal
          sj={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => handleRescheduleSuccess(rescheduleTarget.id)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          sj={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={() => { setDeleteTarget(null); refresh(); }}
        />
      )}
      {previewState && (
        <PreviewWrapper
          sjId={previewState.sjId}
          title={previewState.title}
          onClose={() => setPreviewState(null)}
        />
      )}
    </div>
  );
}
