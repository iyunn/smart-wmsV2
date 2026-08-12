// ═══════════════════════════════════════════════════════════════════════════
// FILE : src/app/reconciliation/page.tsx
// GUNA : menampilkan hasil perbandingan DAT dan LPP dalam bentuk card
//        ringkasan dan tabel rincian yang bisa difilter.
//
// MENGAMBIL DATA LEWAT:
//   useReconciliation() dari src/hooks/useReconciliation.ts
//     → yang memanggil /api/reconciliation
//       → src/app/api/reconciliation/route.ts (di sanalah logika pembandingnya)
//
// MEMANGGIL JUGA:
//   exportReconciliationToExcel() dari src/lib/reconciliationExporter.ts
//
// CATATAN: halaman ini hanya mengurus tampilan dan penyaringan.
// Perhitungan kondisi 1 sampai 6 semuanya dikerjakan di sisi server.
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useReconciliation, type ReconciliationItem } from "@/hooks/useReconciliation";
import { exportReconciliationToExcel } from "@/lib/reconciliationExporter";

// Jumlah baris yang ditampilkan per halaman tabel.
const PAGE_SIZE = 30;

// ─── DAFTAR KONDISI dan tampilannya ────────────────────────────────────────
// Angka kondisi datang dari server; di sini diterjemahkan jadi nama, penjelasan,
// dan warna. severity menentukan apakah kondisi itu wajar atau perlu perhatian.
// Disimpan sebagai objek terpisah supaya kalau ada kondisi baru, cukup
// ditambahkan di sini tanpa mengubah tampilannya.
const KONDISI_CONFIG: Record<number, { label: string; desc: string; badge: string; severity: "normal" | "warning" }> = {
  1: { label: "Fisik di CGA",        desc: "Ada di DAT & LPP, CGA sama — konsisten",                 badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20", severity: "normal" },
  2: { label: "Belum Mutasi Oracle", desc: "Ada di DAT, tidak ada di LPP — segera mutasi Oracle",     badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",       severity: "warning" },
  4: { label: "Belum Mutasi WT",     desc: "Ada di LPP, tidak ada di DAT — segera buat SJ WT",        badge: "bg-rose-500/10 text-rose-300 border-rose-500/20",          severity: "warning" },
  5: { label: "Fisik Allocated",     desc: "Tidak ada di DAT & LPP — konsisten, sudah keluar CGA",    badge: "bg-slate-500/10 text-slate-300 border-slate-500/20",       severity: "normal" },
  6: { label: "Mismatch CGA",        desc: "Ada di DAT & LPP tapi CGA berbeda — perlu investigasi",   badge: "bg-purple-500/10 text-purple-300 border-purple-500/20",    severity: "warning" },
};

// Warna penanda tiap gudang. Kunci objek ini harus sama persis dengan hasil
// extractCGACode() di server — itu sebabnya penyeragaman kode gudang di sana
// penting, supaya warnanya tidak gagal muncul.
const CGA_BADGE: Record<string, string> = {
  CGA1: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  CGA2: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  CGA3: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

// ─── Tombol pindah halaman tabel ───────────────────────────────────────────
// Komponen kecil terpisah supaya bisa dipakai di atas dan di bawah tabel.
function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-white/[0.06]">
      <button onClick={() => onPage(page - 1)} disabled={page === 1}
        className="w-7 h-7 rounded-lg text-[12px] text-white/50 hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none">‹</button>
      <span className="text-[11px] text-white/40 px-3">{page} / {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
        className="w-7 h-7 rounded-lg text-[12px] text-white/50 hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none">›</button>
    </div>
  );
}

// ═══ KOMPONEN UTAMA HALAMAN — MULAI (baris 39-akhir) ═══════════════════════
function ReconciliationPageContent() {
  const searchParams = useSearchParams();
  const { items, summary, loading } = useReconciliation();

  // Empat penyaring yang bisa dipakai bersamaan:
  //   activeKondisi → kondisi 1/2/4/5/6, atau semua
  //   cga           → gudang tertentu, atau semua
  //   search        → pencarian kode aset atau keterangan
  //   page          → halaman tabel yang sedang dibuka
  const [activeKondisi, setActiveKondisi] = useState<number | "ALL">("ALL");
  const [cga, setCga] = useState<"ALL" | "CGA1" | "CGA2" | "CGA3">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ─── LOGIC pembaca tautan dari Dashboard — MULAI (baris 50-62) ──────────
  // Di Dashboard ada kartu "DAT vs LPP" yang bisa diklik. Kartu itu membawa
  // pengguna ke halaman ini lengkap dengan penyaringnya, lewat alamat seperti
  //   /reconciliation?kondisi=2&cga=CGA1
  // Bagian ini yang membaca alamat tersebut lalu memasang penyaringnya.
  //
  // Daftar pemicu useEffect sengaja dikosongkan (baris 62), supaya hanya
  // dijalankan SEKALI saat halaman dibuka. Kalau tidak, penyaring yang
  // diubah pengguna akan terus dikembalikan ke nilai dari alamat.
  // Deep-link dari Dashboard Baris 2 (DATvsLPPCards) — baca ?kondisi=2&cga=CGA1
  // dan pre-apply filter sekali saat halaman dibuka.
  useEffect(() => {
    const kondisiParam = searchParams.get("kondisi");
    const cgaParam = searchParams.get("cga");

    if (kondisiParam) {
      const parsed = parseInt(kondisiParam, 10);
      if ([1, 2, 4, 5, 6].includes(parsed)) setActiveKondisi(parsed);
    }
    if (cgaParam && ["CGA1", "CGA2", "CGA3"].includes(cgaParam)) {
      setCga(cgaParam as "CGA1" | "CGA2" | "CGA3");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ─── LOGIC pembaca tautan dari Dashboard — SELESAI ──────────────────────

  // ─── LOGIC penyaringan bertumpuk — MULAI (baris 64-74) ──────────────────
  // Tiap baris data harus lolos SEMUA penyaring yang sedang aktif.
  // Bentuk penulisannya memakai return false lebih awal — begitu satu syarat
  // tidak terpenuhi, baris itu langsung dibuang tanpa memeriksa sisanya.
  //
  // Dibungkus useMemo supaya penyaringan hanya dihitung ulang kalau datanya
  // atau penyaringnya berubah — bukan setiap kali halaman digambar ulang.
  // Penting karena jumlah barisnya bisa ribuan.
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (activeKondisi !== "ALL" && it.kondisi !== activeKondisi) return false;
      if (cga !== "ALL" && it.toko !== cga) return false;
      if (search.trim() !== "") {
        const q = search.trim().toLowerCase();
        return it.kode_asset.toLowerCase().includes(q) || it.deskripsi.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, activeKondisi, cga, search]);
  // ─── LOGIC penyaringan bertumpuk — SELESAI ──────────────────────────────

  // ─── LOGIC pemenggalan halaman — MULAI (baris 76-80) ────────────────────
  // Dikerjakan SETELAH penyaringan, bukan sebelumnya — supaya jumlah halaman
  // mengikuti data yang benar-benar tampil.
  //
  // Math.max(1, ...) menjaga agar jumlah halaman tidak pernah nol, karena
  // halaman ke-0 akan membuat tombol navigasinya berperilaku aneh.
  // .slice() memotong bagian yang sesuai halaman aktif.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );
  // ─── LOGIC pemenggalan halaman — SELESAI ────────────────────────────────


  // ─── LOGIC ekspor Excel — MULAI (baris 83-90) ───────────────────────────
  // Yang dikirim adalah filtered (data setelah disaring), BUKAN items.
  // Jadi isi berkas Excel selalu sama dengan yang sedang terlihat di layar.
  //
  // allItems tetap ikut dikirim untuk keperluan ringkasan di dalam berkasnya,
  // supaya pembaca laporan tahu ini bagian dari berapa total data.
  const handleExport = useCallback(() => {
    exportReconciliationToExcel({
      items: filtered,
      allItems: items,
      activeKondisi,
      cga,
    });
  }, [filtered, items, activeKondisi, cga]);
  // ─── LOGIC ekspor Excel — SELESAI ───────────────────────────────────────
  // Susunan kartu ringkasan di bagian atas halaman. Angkanya diambil dari
  // summary yang sudah dihitung server, bukan dihitung ulang di sini.
  const cards = [
    { kondisi: 1, count: summary?.kondisi1 ?? 0 },
    { kondisi: 2, count: summary?.kondisi2 ?? 0 },
    { kondisi: 4, count: summary?.kondisi4 ?? 0 },
    { kondisi: 5, count: summary?.kondisi5 ?? 0 },
    { kondisi: 6, count: summary?.kondisi6 ?? 0 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#080e18] text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Reconciliation" />

        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Reconciliation DAT vs LPP</h1>
              <p className="mt-0.5 text-xs text-white/40">
                Bandingkan posisi aset antara DAT Oracle dan LPP Web Tracking untuk mendeteksi selisih administrasi.
                Kondisi 3 (Aset Intransit) tidak diimplementasi — saran penelitian lanjutan.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={loading || items.length === 0}
              className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[12px] font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Excel
            </button>
          </div>

          {/* Summary cards — clickable filter */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cards.map((c) => {
              const cfg = KONDISI_CONFIG[c.kondisi];
              const isActive = activeKondisi === c.kondisi;
              return (
                <button
                  key={c.kondisi}
                  onClick={() => { setActiveKondisi(isActive ? "ALL" : c.kondisi); setPage(1); }}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    isActive
                      ? "border-cyan-500/40 bg-cyan-500/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                      Kondisi {c.kondisi}
                    </span>
                    {cfg.severity === "warning" && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-white">{loading ? "—" : c.count.toLocaleString()}</p>
                  <p className="text-[11px] font-medium text-white/70 mt-1">{cfg.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">{cfg.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Filter Panel */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Cost Center</span>
              <div className="flex items-center gap-1.5">
                {(["ALL", "CGA1", "CGA2", "CGA3"] as const).map((c) => (
                  <button key={c} onClick={() => { setCga(c); setPage(1); }}
                    className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all border ${
                      cga === c ? "bg-white/10 text-white border-white/20" : "text-slate-500 border-transparent hover:text-slate-300 hover:border-white/10"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-white/[0.04]">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Cari kode aset atau deskripsi..."
                suppressHydrationWarning
                className="w-full max-w-md bg-white/[0.04] border border-white/[0.08] text-white/80 text-[12px] placeholder:text-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <p className="text-[11px] text-white/40">
            Menampilkan <span className="text-white/80 font-semibold">{filtered.length.toLocaleString()}</span> dari {items.length.toLocaleString()} total kode aset
          </p>

          {/* Table */}
          {loading ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] py-20 text-center">
              <p className="text-sm text-white/40">Menghitung reconciliation...</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[50px_150px_1fr_90px_160px] gap-3 border-b border-white/[0.06] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                    <span>No</span>
                    <span>Kode Aset</span>
                    <span>Deskripsi</span>
                    <span>CGA</span>
                    <span>Kondisi</span>
                  </div>
                  {paginated.map((it: ReconciliationItem, idx: number) => {
                    const cfg = KONDISI_CONFIG[it.kondisi];
                    return (
                      <div key={it.kode_asset}
                        className="grid grid-cols-[50px_150px_1fr_90px_160px] gap-3 items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-[11px] border-b border-white/[0.03] last:border-0">
                        <span className="text-white/30 font-mono">{(page - 1) * PAGE_SIZE + idx + 1}</span>
                        <span className="text-white/70 font-mono">{it.kode_asset}</span>
                        <span className="text-white/60 truncate">{it.deskripsi || "—"}</span>
                        {it.kondisi === 6 ? (
                          // Mismatch CGA: tampilkan "DAT → LPP"
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex items-center text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md border ${CGA_BADGE[it.toko] ?? ""}`}>
                              {it.toko}
                            </span>
                            <span className="text-white/30 text-[10px]">→</span>
                            <span className={`inline-flex items-center text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md border ${CGA_BADGE[it.tokoLPP ?? ""] ?? ""}`}>
                              {it.tokoLPP}
                            </span>
                          </div>
                        ) : it.toko !== "-" ? (
                          <span className={`inline-flex w-fit items-center text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border ${CGA_BADGE[it.toko] ?? ""}`}>
                            {it.toko}
                          </span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                        <span className={`inline-flex w-fit items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                  {paginated.length === 0 && (
                    <div className="py-12 text-center">
                      <p className="text-sm text-white/30">Tidak ada data yang cocok dengan filter</p>
                    </div>
                  )}
                </div>
              </div>
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#080e18] items-center justify-center">
        <span className="text-white/40 text-sm">Memuat...</span>
      </div>
    }>
      <ReconciliationPageContent />
    </Suspense>
  );
}
