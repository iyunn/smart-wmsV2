"use client";

// ══════════════════════════════════════════════════════════════════════════
// /bounty — Bounty Hunter (ROADMAP 9e-2, ARCHITECTURE D-39)
// Catatan barang pinjaman / janji AS yang belum kembali. Semua user bisa mencatat, mengubah,
// menandai kembali (boleh sebagian), membatalkan, dan menghapus; setiap aksi tercatat di riwayat.
// Bounty = Rp10.000 × barang yang belum kembali (dihitung, tidak disimpan).
// ══════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { BountyFormModal, DeleteModal, SettleModal, UndoModal, WaModal } from "@/components/bounty/BountyModals";
import { useBounty, type BountyEvent, type BountyItem } from "@/hooks/useBounty";
import { useMasterJenis, useMasterTujuan } from "@/hooks/useSJMaster";
import { BOUNTY_PER_BARANG, formatRupiah, sisaBarang, todayWib } from "@/lib/bounty";

type Status = "aktif" | "lunas" | "semua";
type ModalState =
  | { kind: "form"; item: BountyItem | null }
  | { kind: "settle" | "undo" | "delete"; item: BountyItem }
  | { kind: "wa" }
  | null;

const DAY = 86_400_000;
function hariSejak(tanggal: string): number {
  return Math.max(0, Math.round((Date.parse(todayWib() + "T00:00:00Z") - Date.parse(tanggal + "T00:00:00Z")) / DAY));
}
function labelHari(n: number): string {
  return n === 0 ? "hari ini" : n === 1 ? "kemarin" : `${n} hari lalu`;
}
function formatTanggal(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function formatWaktu(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

const AKSI_LABEL: Record<BountyEvent["aksi"], string> = {
  buat: "mencatat", ubah: "mengubah", selesai: "menandai kembali", batal: "membatalkan tanda kembali", hapus: "menghapus",
};

export default function BountyPage() {
  const { data, loading, error, send } = useBounty();
  const { jenis: jenisList } = useMasterJenis();
  const { tujuan: tujuanList } = useMasterTujuan();

  const [status, setStatus] = useState<Status>("aktif");
  const [asFilter, setAsFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [openHistory, setOpenHistory] = useState<Set<string>>(new Set());

  const items = useMemo(() => data?.items ?? [], [data]);
  const asList = useMemo(() => (data?.as ?? []).map((a) => a.inisial).sort(), [data]);
  const wanted = useMemo(() => (data?.as ?? []).filter((a) => a.sisa > 0), [data]);

  const stats = useMemo(() => {
    const aktif = items.filter((it) => sisaBarang(it) > 0);
    const sisa = aktif.reduce((n, it) => n + sisaBarang(it), 0);
    const tertua = aktif.reduce((m, it) => Math.max(m, hariSejak(it.tanggal)), 0);
    return { bounty: sisa * BOUNTY_PER_BARANG, sisa, asCount: wanted.length, tertua, aktifCount: aktif.length };
  }, [items, wanted]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((it) => status === "semua" || (status === "aktif" ? sisaBarang(it) > 0 : sisaBarang(it) === 0))
      .filter((it) => !asFilter || it.as_inisial === asFilter)
      .filter((it) => !q || [it.as_inisial, it.jenis, it.keterangan, it.tujuan?.kode, it.tujuan?.nama, it.created_by]
        .some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => status === "lunas"
        ? (b.selesai_at ?? "").localeCompare(a.selesai_at ?? "")
        : a.tanggal.localeCompare(b.tanggal) || a.created_at.localeCompare(b.created_at));
  }, [items, status, asFilter, search]);

  // Tagih via WA: utang belum lunas sesuai filter AS & kata cari (tab status diabaikan — selalu belum lunas)
  const waItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((it) => sisaBarang(it) > 0)
      .filter((it) => !asFilter || it.as_inisial === asFilter)
      .filter((it) => !q || [it.as_inisial, it.jenis, it.keterangan, it.tujuan?.kode, it.tujuan?.nama, it.created_by]
        .some((v) => v?.toLowerCase().includes(q)));
  }, [items, asFilter, search]);
  const waScope = [asFilter ? `AS ${asFilter}` : "semua AS", search.trim() ? `cari "${search.trim()}"` : ""].filter(Boolean).join(", ");

  const toggleHistory = (id: string) => setOpenHistory((s) => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-heading">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Bounty Hunter" />
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-heading">Bounty Hunter</h1>
              <p className="mt-1 max-w-2xl text-[13px] text-muted">
                Barang yang dipinjam AS atau dijanjikan dikembalikan. Siapa pun boleh memperbarui —
                setiap perubahan tercatat. Bounty {formatRupiah(BOUNTY_PER_BARANG)} per barang yang belum kembali.
              </p>
            </div>
            <button onClick={() => setModal({ kind: "form", item: null })}
              className="flex items-center gap-2 rounded-xl bg-linear-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              Catat bounty
            </button>
          </div>

          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger-50 px-4 py-3 text-[13px] text-danger-700">{error}</p>}

          {/* ── Ringkasan ───────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total bounty aktif", value: formatRupiah(stats.bounty), tone: "text-danger-700" },
              { label: "Barang belum kembali", value: `${stats.sisa}`, sub: `${stats.aktifCount} catatan` },
              { label: "AS punya utang", value: `${stats.asCount}` },
              { label: "Utang tertua", value: stats.aktifCount ? labelHari(stats.tertua) : "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-surface px-5 py-4">
                <p className="text-[12px] font-semibold text-muted">{s.label}</p>
                <p className={`mt-1 text-[24px] font-bold tabular-nums ${s.tone ?? "text-heading"}`}>{loading ? "…" : s.value}</p>
                {s.sub && !loading && <p className="text-[12px] text-dim">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Wanted: AS urut bounty terbesar ─────────────────────── */}
          <section aria-label="Daftar AS">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-bold text-heading">Wanted</h2>
              {asFilter && (
                <button onClick={() => setAsFilter(null)} className="text-[12px] font-medium text-accent underline underline-offset-2">
                  Tampilkan semua AS
                </button>
              )}
            </div>
            {!loading && wanted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-5 py-6 text-center text-[13px] text-muted">
                Tidak ada AS yang punya utang. Aman! 🎉
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {wanted.map((a, i) => {
                  const active = asFilter === a.inisial;
                  return (
                    <button key={a.id} onClick={() => setAsFilter(active ? null : a.inisial)} aria-pressed={active}
                      aria-label={`${a.inisial}: bounty ${formatRupiah(a.bounty)}, ${a.sisa} barang belum kembali${i === 0 ? " (paling dicari)" : ""}`}
                      className={`relative rounded-2xl border bg-surface p-4 text-left transition-colors ${active ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"}`}>
                      {i === 0 && <span className="absolute right-3 top-3 rounded-md bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-700">#1 Wanted</span>}
                      <p className="text-[22px] font-black tracking-wide text-heading">{a.inisial}</p>
                      {a.nama && <p className="text-[12px] text-muted">{a.nama}</p>}
                      <p className="mt-2 text-[20px] font-bold tabular-nums text-danger-700">{formatRupiah(a.bounty)}</p>
                      <p className="text-[12px] text-muted">
                        {a.sisa} barang · {a.utang_aktif} catatan{a.sejak ? ` · sejak ${labelHari(hariSejak(a.sejak))}` : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Daftar utang ────────────────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-surface" aria-label="Daftar bounty">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
              <div className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-panel p-1" role="tablist" aria-label="Status">
                {([["aktif", "Belum kembali"], ["lunas", "Lunas"], ["semua", "Semua"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={status === k} onClick={() => setStatus(k)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${status === k ? "bg-brand-50 text-brand-700" : "text-muted hover:text-heading"}`}>
                    {l}
                  </button>
                ))}
              </div>
              {asFilter && <span className="rounded-full bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">AS {asFilter}</span>}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari AS, barang, toko, keterangan…" aria-label="Cari"
                className="ml-auto w-full max-w-xs rounded-lg border border-line-strong bg-field px-3 py-2 text-[13px] text-body placeholder:text-dim" />
              <button onClick={() => setModal({ kind: "wa" })} disabled={loading}
                title={`Buat pesan tagihan WhatsApp — ${waScope} (${waItems.length} catatan belum lunas)`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success-50 px-3 py-2 text-[13px] font-semibold text-success-700 hover:brightness-95 disabled:opacity-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" /></svg>
                Tagih via WA{asFilter ? ` (${asFilter})` : ""}
              </button>
            </div>

            {loading ? (
              <p className="px-5 py-10 text-center text-[13px] text-muted">Memuat…</p>
            ) : shown.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-muted">
                {items.length === 0 ? "Belum ada catatan bounty. Klik “Catat bounty” untuk mulai." : "Tidak ada yang cocok dengan filter."}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {shown.map((it) => {
                  const sisa = sisaBarang(it);
                  const lunas = sisa === 0;
                  const hari = hariSejak(it.tanggal);
                  const histOpen = openHistory.has(it.id);
                  return (
                    <li key={it.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start gap-4">
                        <button onClick={() => setModal(lunas ? { kind: "undo", item: it } : { kind: "settle", item: it })}
                          role="checkbox" aria-checked={lunas ? true : it.qty_selesai > 0 ? "mixed" : false}
                          aria-label={lunas ? `Batalkan tanda kembali ${it.jenis} ${it.as_inisial}` : `Tandai kembali ${it.jenis} ${it.as_inisial}`}
                          title={lunas ? "Batalkan tanda kembali" : "Tandai sudah kembali"}
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${lunas ? "border-success bg-success-700 text-white" : it.qty_selesai > 0 ? "border-success text-success-700" : "border-line-strong text-transparent hover:border-success hover:text-success-700"}`}>
                          {it.qty_selesai > 0 && !lunas
                            ? <span className="text-[14px] font-black leading-none">–</span>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="rounded-md bg-panel px-2 py-0.5 text-[12px] font-black tracking-wide text-heading">{it.as_inisial}</span>
                            <span className={`text-[15px] font-semibold ${lunas ? "text-muted line-through" : "text-heading"}`}>{it.jenis}</span>
                            <span className="text-[13px] font-semibold tabular-nums text-body">× {it.qty}</span>
                            {it.qty_selesai > 0 && !lunas && (
                              <span className="rounded-md bg-success-50 px-2 py-0.5 text-[12px] font-semibold text-success-700">{it.qty_selesai} kembali · sisa {sisa}</span>
                            )}
                            {lunas && <span className="rounded-md bg-success-50 px-2 py-0.5 text-[12px] font-semibold text-success-700">Lunas{it.selesai_at ? ` · ${formatWaktu(it.selesai_at)}` : ""}</span>}
                          </div>
                          {it.keterangan && <p className="mt-1 text-[13px] text-body">{it.keterangan}</p>}
                          <p className="mt-1 text-[12px] text-muted">
                            {it.tujuan ? <>Toko <b className="font-semibold text-body">{it.tujuan.kode}</b> {it.tujuan.nama} · </> : null}
                            Ditetapkan {formatTanggal(it.tanggal)}
                            {!lunas && <span className={hari >= 7 ? "font-semibold text-warning-700" : ""}> ({labelHari(hari)})</span>}
                            {" "}· dicatat {it.created_by || "—"}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <p className={`text-[16px] font-bold tabular-nums ${lunas ? "text-dim" : "text-danger-700"}`}>
                            {formatRupiah(sisa * BOUNTY_PER_BARANG)}
                          </p>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {!lunas && (
                              <button onClick={() => setModal({ kind: "settle", item: it })}
                                className="rounded-lg bg-success-50 px-3 py-1.5 text-[12px] font-semibold text-success-700 hover:brightness-95">
                                Tandai kembali
                              </button>
                            )}
                            {it.qty_selesai > 0 && !lunas && (
                              <button onClick={() => setModal({ kind: "undo", item: it })} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted hover:text-heading">
                                Batalkan tanda
                              </button>
                            )}
                            <button onClick={() => setModal({ kind: "form", item: it })} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted hover:text-heading">
                              Ubah
                            </button>
                            <button onClick={() => toggleHistory(it.id)} aria-expanded={histOpen} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-muted hover:text-heading">
                              Riwayat ({it.riwayat.length})
                            </button>
                            <button onClick={() => setModal({ kind: "delete", item: it })} aria-label={`Hapus ${it.jenis} ${it.as_inisial}`} title="Hapus"
                              className="rounded-lg border border-line px-2.5 py-1.5 text-danger-700 hover:bg-danger-50">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      {histOpen && (
                        <ol className="mt-3 ml-11 space-y-1.5 border-l-2 border-line pl-4">
                          {it.riwayat.map((e, i) => (
                            <li key={i} className="text-[12px] text-muted">
                              <span className="tabular-nums text-dim">{formatWaktu(e.at)}</span>{" "}
                              <b className="font-semibold text-body">{e.oleh || "—"}</b> {AKSI_LABEL[e.aksi]}
                              {e.qty !== null && (e.aksi === "selesai" || e.aksi === "batal" || e.aksi === "buat") ? ` ${e.qty} barang` : ""}
                              {e.catatan && <> — <span className="text-body">{e.catatan}</span></>}
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>
      </div>

      {modal?.kind === "form" && (
        <BountyFormModal item={modal.item} asList={asList} jenisList={jenisList} tujuanList={tujuanList} send={send} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "settle" && <SettleModal item={modal.item} send={send} onClose={() => setModal(null)} />}
      {modal?.kind === "undo" && <UndoModal item={modal.item} send={send} onClose={() => setModal(null)} />}
      {modal?.kind === "delete" && <DeleteModal item={modal.item} send={send} onClose={() => setModal(null)} />}
      {modal?.kind === "wa" && <WaModal items={waItems} scope={waScope} onClose={() => setModal(null)} />}
    </div>
  );
}
