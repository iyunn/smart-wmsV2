"use client";

import { useState, useMemo, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import SearchableDropdown from "@/components/sj/SearchableDropdown";
import PendinganItemsTable, { createEmptyPendinganItem, URGENSI_OPTIONS, ARAH_OPTIONS, type PendinganDraftItem, type UrgensiLevel } from "@/components/sj/PendinganItemsTable";
import { useMasterJenis, useMasterMerk, useMasterTujuan } from "@/hooks/useSJMaster";
import { usePendingan, type PendinganItemFull } from "@/hooks/usePendingan";
import type { SJTujuan } from "@/lib/sjTypes";

interface TujuanWithCount extends SJTujuan {
  pendingCount: number;
}

export default function PendinganAlokasiPage() {
  const { jenis: jenisOptions } = useMasterJenis();
  const { merk: merkOptions } = useMasterMerk();
  const { tujuan: allTujuan, loading: loadingTujuan } = useMasterTujuan();
  const { items, loading: loadingItems, addItems, updateItem, clearItems } = usePendingan();

  const [kotaFilter, setKotaFilter] = useState("all");
  const [urgensiFilter, setUrgensiFilter] = useState("all");
  const [arahFilter, setArahFilter] = useState("all");
  const [selectedTujuanId, setSelectedTujuanId] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // Modal input pendingan (form ala SJ)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTujuanId, setModalTujuanId] = useState("");
  const [draftItems, setDraftItems] = useState<PendinganDraftItem[]>([createEmptyPendinganItem(1)]);

  // Modal edit satu item
  const [editTarget, setEditTarget] = useState<PendinganItemFull | null>(null);
  const [editJenis, setEditJenis] = useState("");
  const [editMerk, setEditMerk] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editKet, setEditKet] = useState("");
  const [editUrgensi, setEditUrgensi] = useState<UrgensiLevel>("sedang");
  const [editArah, setEditArah] = useState("kirim");

  // Item yang lolos filter urgensi (dipakai untuk hitung & tampilkan tujuan)
  const itemsByUrgensi = useMemo(() => {
    let list = items;
    if (urgensiFilter !== "all") list = list.filter(it => (it.urgensi ?? "sedang") === urgensiFilter);
    if (arahFilter !== "all")    list = list.filter(it => (it.arah ?? "kirim") === arahFilter);
    return list;
  }, [items, urgensiFilter, arahFilter]);

  const pendingCountByTujuan = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of itemsByUrgensi) map.set(it.tujuan_id, (map.get(it.tujuan_id) ?? 0) + 1);
    return map;
  }, [itemsByUrgensi]);

  // Urgensi tertinggi per tujuan (untuk badge di list kiri)
  const topUrgensiByTujuan = useMemo(() => {
    const rank: Record<string, number> = { tinggi: 3, sedang: 2, rendah: 1 };
    const map = new Map<string, UrgensiLevel>();
    for (const it of itemsByUrgensi) {
      const u = (it.urgensi ?? "sedang") as UrgensiLevel;
      const cur = map.get(it.tujuan_id);
      if (!cur || rank[u] > rank[cur]) map.set(it.tujuan_id, u);
    }
    return map;
  }, [itemsByUrgensi]);

  const urgensiFilterOptions = useMemo(() => ([
    { value: "all", label: "Semua Urgensi" },
    ...URGENSI_OPTIONS.map(o => ({ value: o.value, label: o.label })),
  ]), []);

  const arahFilterOptions = useMemo(() => ([
    { value: "all", label: "Kirim & Tarik" },
    ...ARAH_OPTIONS.map(o => ({ value: o.value, label: o.label })),
  ]), []);

  const kotaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTujuan) if (t.kota?.trim()) set.add(t.kota.trim());
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: "all", label: "Semua Kota" }, ...sorted.map(k => ({ value: k, label: k }))];
  }, [allTujuan]);

  const groupedTujuan = useMemo(() => {
    const withPending: TujuanWithCount[] = allTujuan
      .filter(t => pendingCountByTujuan.has(t.id))
      .filter(t => kotaFilter === "all" || (t.kota?.trim() ?? "") === kotaFilter)
      .map(t => ({ ...t, pendingCount: pendingCountByTujuan.get(t.id) ?? 0 }));

    const byKota = new Map<string, Map<string, TujuanWithCount[]>>();
    for (const t of withPending) {
      const kota = t.kota?.trim() || "Tanpa Kota";
      const kec = t.kecamatan?.trim() || "Tanpa Kecamatan";
      if (!byKota.has(kota)) byKota.set(kota, new Map());
      const kecMap = byKota.get(kota)!;
      if (!kecMap.has(kec)) kecMap.set(kec, []);
      kecMap.get(kec)!.push(t);
    }

    return Array.from(byKota.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kota, kecMap]) => ({
        kota,
        kecamatans: Array.from(kecMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([kec, tjs]) => ({ kecamatan: kec, tujuans: tjs.sort((a, b) => a.kode.localeCompare(b.kode)) })),
      }));
  }, [allTujuan, pendingCountByTujuan, kotaFilter]);

  const selectedItems = useMemo(
    () => itemsByUrgensi.filter(it => it.tujuan_id === selectedTujuanId),
    [itemsByUrgensi, selectedTujuanId]
  );
  const selectedTujuan = useMemo(
    () => allTujuan.find(t => t.id === selectedTujuanId) ?? null,
    [allTujuan, selectedTujuanId]
  );

  const toggleItem = useCallback((id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const allItemsChecked = useMemo(() => {
    if (selectedItems.length === 0) return false;
    return selectedItems.every(it => checkedItems.has(it.id));
  }, [selectedItems, checkedItems]);

  const handleClearChecked = useCallback(async () => {
    const toClear = selectedItems.filter(it => checkedItems.has(it.id)).map(it => it.id);
    if (toClear.length === 0) return;
    setBusy(true);
    try {
      await clearItems(toClear);
      setCheckedItems(prev => {
        const next = new Set(prev);
        toClear.forEach(id => next.delete(id));
        return next;
      });
    } catch (e) { alert(e instanceof Error ? e.message : "Gagal clear"); }
    finally { setBusy(false); }
  }, [selectedItems, checkedItems, clearItems]);

  const handleClearTujuan = useCallback(async (tujuanId: string) => {
    // Hard-delete langsung tanpa konfirmasi (sesuai permintaan).
    const toClear = items.filter(it => it.tujuan_id === tujuanId).map(it => it.id);
    if (toClear.length === 0) return;
    setBusy(true);
    try {
      await clearItems(toClear);
      if (selectedTujuanId === tujuanId) setSelectedTujuanId(null);
    } catch (e) { alert(e instanceof Error ? e.message : "Gagal clear"); }
    finally { setBusy(false); }
  }, [items, clearItems, selectedTujuanId]);

  const openModal = useCallback(() => {
    setModalTujuanId(selectedTujuanId ?? "");
    setDraftItems([createEmptyPendinganItem(1)]);
    setModalOpen(true);
  }, [selectedTujuanId]);

  const handleSaveModal = useCallback(async () => {
    if (!modalTujuanId) { alert("Pilih tujuan dulu"); return; }
    const valid = draftItems
      .filter(it => it.jenis.trim())
      .map(it => ({
        jenis: it.jenis.trim(),
        merk: it.merk.trim(),
        qty: Math.max(1, it.qty || 1),
        keterangan: it.keterangan.trim(),
        urgensi: it.urgensi,
        arah: it.arah,
      }));
    if (valid.length === 0) { alert("Minimal satu item dengan jenis terisi"); return; }
    setBusy(true);
    try {
      await addItems(modalTujuanId, valid);
      setModalOpen(false);
      setSelectedTujuanId(modalTujuanId);
      setCheckedItems(new Set());
    } catch (e) { alert(e instanceof Error ? e.message : "Gagal simpan"); }
    finally { setBusy(false); }
  }, [modalTujuanId, draftItems, addItems]);

  const openEdit = useCallback((it: PendinganItemFull) => {
    setEditTarget(it);
    setEditJenis(it.jenis);
    setEditMerk(it.merk ?? "");
    setEditQty(String(it.qty ?? 1));
    setEditKet(it.keterangan ?? "");
    setEditUrgensi((it.urgensi ?? "sedang") as UrgensiLevel);
    setEditArah(it.arah ?? "kirim");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget) return;
    if (!editJenis.trim()) { alert("Jenis tidak boleh kosong"); return; }
    setBusy(true);
    try {
      await updateItem(editTarget.id, {
        jenis: editJenis.trim(),
        merk: editMerk.trim(),
        qty: Math.max(1, Number(editQty) || 1),
        keterangan: editKet.trim(),
        urgensi: editUrgensi,
        arah: editArah as "kirim" | "tarik",
      });
      setEditTarget(null);
    } catch (e) { alert(e instanceof Error ? e.message : "Gagal mengubah"); }
    finally { setBusy(false); }
  }, [editTarget, editJenis, editMerk, editQty, editKet, editUrgensi, editArah, updateItem]);

  const tujuanDropdownOptions = useMemo(
    () => allTujuan
      .slice()
      .sort((a, b) => a.kode.localeCompare(b.kode))
      .map(t => ({
        value: t.id,
        label: `${t.kode} — ${t.nama}`,
        sublabel: [t.kota, t.kecamatan].filter(Boolean).join(" · ") || undefined,
      })),
    [allTujuan]
  );

  return (
    <div className="flex h-screen overflow-hidden pend-scope pend-bg" style={{ color: "var(--pend-text)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title="Pendingan Alokasi" />

        <main className="flex-1 overflow-hidden px-6 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 h-full">

            {/* ══ KIRI ══════════════════════════════════════════════════════ */}
            <div className="pend-glass rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-[color:var(--pend-border)] space-y-3">
                <button
                  onClick={openModal}
                  className="w-full py-2.5 rounded-xl bg-accent/15 border border-accent/40 text-[color:var(--pend-accent)] text-base2 font-semibold hover:bg-accent/25 transition-all flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Pendingan Baru
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-tiny font-semibold uppercase tracking-widest text-[color:var(--pend-text-dim)] mb-2">Kota</p>
                    <SearchableDropdown options={kotaOptions} value={kotaFilter} onChange={setKotaFilter} placeholder="Kota..." />
                  </div>
                  <div>
                    <p className="text-tiny font-semibold uppercase tracking-widest text-[color:var(--pend-text-dim)] mb-2">Urgensi</p>
                    <SearchableDropdown options={urgensiFilterOptions} value={urgensiFilter} onChange={setUrgensiFilter} placeholder="Urgensi..." />
                  </div>
                </div>
                <div>
                  <p className="text-tiny font-semibold uppercase tracking-widest text-[color:var(--pend-text-dim)] mb-2">Arah</p>
                  <SearchableDropdown options={arahFilterOptions} value={arahFilter} onChange={setArahFilter} placeholder="Arah..." />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {loadingTujuan || loadingItems ? (
                  <p className="text-base2 text-[color:var(--pend-text-dim)] text-center py-8">Memuat...</p>
                ) : groupedTujuan.length === 0 ? (
                  <p className="text-base2 text-[color:var(--pend-text-dim)] text-center py-8">Belum ada pendingan.</p>
                ) : (
                  groupedTujuan.map(({ kota, kecamatans }) => (
                    <div key={kota}>
                      <p className="text-small font-bold uppercase tracking-wider text-[color:var(--pend-accent)] px-2 mb-1.5">{kota}</p>
                      {kecamatans.map(({ kecamatan, tujuans }) => (
                        <div key={kecamatan} className="mb-2">
                          <p className="text-tiny font-medium text-[color:var(--pend-text-dim)] px-2 mb-1">{kecamatan}</p>
                          <div className="space-y-1">
                            {tujuans.map(t => (
                              <TujuanRow
                                key={t.id} tujuan={t}
                                topUrgensi={topUrgensiByTujuan.get(t.id)}
                                selected={selectedTujuanId === t.id}
                                onSelect={() => { setSelectedTujuanId(t.id); setCheckedItems(new Set()); }}
                                onClear={() => handleClearTujuan(t.id)}
                                busy={busy}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ══ KANAN ═════════════════════════════════════════════════════ */}
            <div className="pend-glass rounded-2xl flex flex-col overflow-hidden">
              {!selectedTujuan ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-lead text-[color:var(--pend-text-dim)]">Pilih tujuan di kiri, atau klik &quot;Pendingan Baru&quot;.</p>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-[color:var(--pend-border)] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lead font-mono font-bold text-[color:var(--pend-accent)]">{selectedTujuan.kode}</span>
                        <span className="text-lead truncate" style={{ color: "var(--pend-text)" }}>{selectedTujuan.nama}</span>
                      </div>
                      <p className="text-tiny text-[color:var(--pend-text-dim)] mt-0.5">
                        {[selectedTujuan.kota, selectedTujuan.kecamatan].filter(Boolean).join(" · ") || "Tanpa wilayah"}
                        {" · "}{selectedItems.length} item pending
                      </p>
                    </div>
                    {allItemsChecked && selectedItems.length > 0 && (
                      <span className="text-tiny bg-success/15 border border-success/30 rounded-lg px-2 py-1 shrink-0 pend-emerald-text">Semua tercentang</span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {selectedItems.length === 0 ? (
                      <p className="text-base2 text-[color:var(--pend-text-dim)] text-center py-8">Belum ada item.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-[auto_1.15fr_0.85fr_44px_60px_64px_1fr_28px] gap-2 px-2 pb-1 text-mini font-semibold uppercase tracking-widest text-[color:var(--pend-text-dim)]">
                          <span className="w-5" /><span>Jenis</span><span>Merk</span><span className="text-center">Qty</span><span>Arah</span><span>Urgensi</span><span>Keterangan</span><span />
                        </div>
                        {selectedItems.map(it => (
                          <ItemRow key={it.id} item={it} checked={checkedItems.has(it.id)} onToggle={() => toggleItem(it.id)} onEdit={() => openEdit(it)} />
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedItems.some(it => checkedItems.has(it.id)) && (
                    <div className="px-4 py-2 border-t border-[color:var(--pend-border)]">
                      <button onClick={handleClearChecked} disabled={busy}
                        className="w-full py-2 rounded-xl bg-success/15 border border-success/40 text-base2 font-semibold hover:bg-success/25 transition-all disabled:opacity-50 pend-emerald-text">
                        Clear {selectedItems.filter(it => checkedItems.has(it.id)).length} item tercentang (sudah kirim)
                      </button>
                    </div>
                  )}

                  <div className="p-4 border-t border-[color:var(--pend-border)]">
                    <button onClick={openModal}
                      className="w-full py-2 rounded-xl bg-accent/15 border border-accent/40 text-[color:var(--pend-accent)] text-base2 font-semibold hover:bg-accent/25 transition-all">
                      + Tambah Item ke Tujuan Ini
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* ══ MODAL EDIT ITEM ═════════════════════════════════════════════════ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setEditTarget(null)}>
          <div className="pend-glass rounded-2xl w-full max-w-lg flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[color:var(--pend-border)] flex items-center justify-between">
              <h3 className="text-title font-semibold" style={{ color: "var(--pend-text)" }}>Edit Item Pendingan</h3>
              <button onClick={() => setEditTarget(null)} className="text-[color:var(--pend-text-dim)] hover:opacity-70">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Jenis Barang *</label>
                <SearchableDropdown
                  options={jenisOptions.map(j => ({ value: j, label: j }))}
                  value={editJenis} onChange={setEditJenis}
                  placeholder="Jenis..." allowCustom
                />
              </div>
              <div>
                <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Merk</label>
                <SearchableDropdown
                  options={merkOptions.map(m => ({ value: m, label: m }))}
                  value={editMerk} onChange={setEditMerk}
                  placeholder="Merk..." allowCustom
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Jumlah</label>
                  <input type="number" min="1" value={editQty}
                    onChange={e => setEditQty(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-[color:var(--pend-border)] bg-[color:var(--pend-input)] text-base2 text-center focus:outline-none focus:border-accent/50"
                    style={{ color: "var(--pend-text)" }}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Arah</label>
                  <SearchableDropdown
                    options={ARAH_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    value={editArah} onChange={setEditArah} placeholder="Arah..."
                  />
                </div>
                <div>
                  <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Urgensi</label>
                  <SearchableDropdown
                    options={URGENSI_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    value={editUrgensi} onChange={(v) => setEditUrgensi(v as UrgensiLevel)} placeholder="Urgensi..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Keterangan</label>
                <input type="text" value={editKet}
                  onChange={e => setEditKet(e.target.value)}
                  placeholder="Keterangan..."
                  className="w-full px-2 py-1.5 rounded-lg border border-[color:var(--pend-border)] bg-[color:var(--pend-input)] text-base2 focus:outline-none focus:border-accent/50"
                  style={{ color: "var(--pend-text)" }}
                />
              </div>
            </div>

            <div className="p-4 border-t border-[color:var(--pend-border)] flex items-center justify-end gap-2">
              <button onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-[color:var(--pend-border)] text-base2 text-[color:var(--pend-text-dim)] hover:opacity-70 transition-all">
                Batal
              </button>
              <button onClick={handleSaveEdit} disabled={busy}
                className="px-5 py-2 rounded-xl bg-accent/20 border border-accent/50 text-[color:var(--pend-accent)] text-base2 font-semibold hover:bg-accent/30 transition-all disabled:opacity-50">
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL INPUT (form ala SJ) ═══════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setModalOpen(false)}>
          <div className="pend-glass rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-[color:var(--pend-border)] flex items-center justify-between">
              <h3 className="text-title font-semibold" style={{ color: "var(--pend-text)" }}>Input Pendingan Alokasi</h3>
              <button onClick={() => setModalOpen(false)} className="text-[color:var(--pend-text-dim)] hover:opacity-70">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Tujuan *</label>
                <SearchableDropdown options={tujuanDropdownOptions} value={modalTujuanId} onChange={setModalTujuanId} placeholder="Pilih tujuan..." />
              </div>

              <div>
                <label className="block text-small font-medium text-[color:var(--pend-text-dim)] mb-1.5">Detail Barang</label>
                <PendinganItemsTable items={draftItems} jenisOptions={jenisOptions} merkOptions={merkOptions} onChange={setDraftItems} />
              </div>
            </div>

            <div className="p-4 border-t border-[color:var(--pend-border)] flex items-center justify-end gap-2">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[color:var(--pend-border)] text-base2 text-[color:var(--pend-text-dim)] hover:opacity-70 transition-all">
                Batal
              </button>
              <button onClick={handleSaveModal} disabled={busy}
                className="px-5 py-2 rounded-xl bg-accent/20 border border-accent/50 text-[color:var(--pend-accent)] text-base2 font-semibold hover:bg-accent/30 transition-all disabled:opacity-50">
                Simpan Pendingan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ THEME: token warna + glass (dark & light) ═══════════════════════ */}
      <style jsx global>{`
        /* Token halaman Pendingan → token tema global (globals.css, STYLEGUIDE §2).
           Panel data solid (STYLEGUIDE §3: kaca hanya untuk bingkai aplikasi). */
        .pend-scope {
          --pend-text: var(--text);
          --pend-text-dim: var(--text-muted);
          --pend-accent: var(--accent);
          --pend-border: var(--border);
          --pend-row: var(--surface);
          --pend-input: var(--surface-3);
        }
        .pend-bg {
          background-color: var(--bg);
          background-image: var(--backdrop-image);
          background-attachment: fixed;
        }
        .pend-glass {
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-chrome);
        }
        .pend-emerald-text { color: var(--success-700); }
        /* Badge urgensi & arah: tint + teks status (selalu ada teks, bukan hanya warna) */
        .pend-urg-tinggi { background: var(--danger-50);  color: var(--danger-700); }
        .pend-urg-sedang { background: var(--warning-50); color: var(--warning-700); }
        .pend-urg-rendah { background: var(--surface-2);  color: var(--text-muted); }
        .pend-arah-kirim { background: var(--brand-50);   color: var(--brand-700); }
        .pend-arah-tarik { background: var(--plum-50);    color: var(--plum-700); }
      `}</style>
    </div>
  );
}

// ─── Tujuan row ─────────────────────────────────────────────────────────────
function TujuanRow({ tujuan, topUrgensi, selected, onSelect, onClear, busy }: {
  tujuan: TujuanWithCount; topUrgensi?: UrgensiLevel; selected: boolean; onSelect: () => void; onClear: () => void; busy: boolean;
}) {
  const urgDot: Record<string, string> = {
    tinggi: "bg-danger",
    sedang: "bg-warning",
    rendah: "bg-muted",
  };
  return (
    <div
      className={`flex items-center gap-2 px-2 py-2 rounded-xl transition-all cursor-pointer border ${
        selected ? "bg-accent/15 border-accent/40" : "border-transparent"
      }`}
      style={!selected ? { background: "var(--pend-row)" } : undefined}
      onClick={onSelect}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClear(); }} disabled={busy}
        title="Clear semua item tujuan ini (sudah kirim)"
        className="w-4 h-4 rounded border border-[color:var(--pend-text-dim)] hover:border-success hover:bg-success/20 transition-all shrink-0 disabled:opacity-40"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {topUrgensi && (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${urgDot[topUrgensi]}`} title={`Urgensi tertinggi: ${topUrgensi}`} />
          )}
          <span className="text-small font-mono font-semibold text-[color:var(--pend-accent)]">{tujuan.kode}</span>
          <span className="text-small truncate" style={{ color: "var(--pend-text)" }}>{tujuan.nama}</span>
        </div>
      </div>
      <span className="text-tiny font-mono text-[color:var(--pend-text-dim)] rounded-md px-1.5 py-0.5 shrink-0" style={{ background: "var(--pend-input)" }}>
        {tujuan.pendingCount}
      </span>
    </div>
  );
}

// ─── Item row ───────────────────────────────────────────────────────────────
const URGENSI_STYLE: Record<string, string> = {
  tinggi: "pend-urg-tinggi",
  sedang: "pend-urg-sedang",
  rendah: "pend-urg-rendah",
};

function ItemRow({ item, checked, onToggle, onEdit }: {
  item: PendinganItemFull; checked: boolean; onToggle: () => void; onEdit: () => void;
}) {
  const urg = (item.urgensi ?? "sedang") as string;
  const arah = (item.arah ?? "kirim") as string;
  return (
    <div className={`grid grid-cols-[auto_1.15fr_0.85fr_44px_60px_64px_1fr_28px] gap-2 items-center px-2 py-2 rounded-lg transition-all ${checked ? "opacity-60" : ""}`}
      style={{ background: checked ? "rgba(16,185,129,0.10)" : "var(--pend-row)" }}>
      <button onClick={onToggle}
        className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${
          checked ? "bg-success border-success" : "border-[color:var(--pend-text-dim)] hover:border-success"
        }`}>
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <span className={`text-base2 truncate ${checked ? "line-through" : ""}`} style={{ color: "var(--pend-text)" }}>{item.jenis}</span>
      <span className="text-small truncate text-[color:var(--pend-text-dim)]">{item.merk || "—"}</span>
      <span className="text-base2 font-mono text-center" style={{ color: "var(--pend-text)" }}>{item.qty}</span>
      <span className={`text-mini font-semibold uppercase tracking-wide rounded-md px-1.5 py-0.5 text-center ${arah === "tarik" ? "pend-arah-tarik" : "pend-arah-kirim"}`}>
        {arah}
      </span>
      <span className={`text-mini font-semibold uppercase tracking-wide rounded-md px-1.5 py-0.5 text-center ${URGENSI_STYLE[urg]}`}>
        {urg}
      </span>
      <span className="text-small text-[color:var(--pend-text-dim)] truncate">{item.keterangan || "—"}</span>
      <button
        onClick={onEdit}
        title="Edit item"
        className="w-6 h-6 rounded-md flex items-center justify-center text-[color:var(--pend-text-dim)] hover:text-[color:var(--pend-accent)] hover:bg-accent/10 transition-all"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  );
}
