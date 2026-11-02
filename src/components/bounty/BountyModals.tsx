"use client";

// Modal halaman Bounty Hunter (ROADMAP 9e-2): catat/ubah, tandai kembali, batalkan, hapus.
// Semua aturan (jumlah, inisial, tanggal) juga dicek server — di sini hanya bantuan isian.

import { useMemo, useState, type ReactNode } from "react";
import SearchableDropdown from "@/components/sj/SearchableDropdown";
import type { SJTujuan } from "@/lib/sjTypes";
import { BOUNTY_PER_BARANG, buildWaMessage, formatRupiah, normalizeInisial, sisaBarang, todayWib, waLink } from "@/lib/bounty";
import type { BountyItem } from "@/hooks/useBounty";

type Send = (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) => Promise<string | null>;

const inputCls =
  "w-full rounded-lg border border-line-strong bg-field px-3 py-2 text-[13px] text-body placeholder:text-dim focus:outline-none focus:border-accent";
const labelCls = "mb-1 block text-[12px] font-semibold text-muted";

function Shell({ title, subtitle, children, onClose, width = "max-w-md" }: {
  title: string; subtitle?: ReactNode; children: ReactNode; onClose: () => void; width?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`w-full ${width} max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl`}>
        <h3 className="text-[16px] font-bold text-heading">{title}</h3>
        {subtitle && <div className="mt-1 text-[13px] text-muted">{subtitle}</div>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Actions({ onClose, busy, submitLabel, danger = false, disabled = false }: {
  onClose: () => void; busy: boolean; submitLabel: string; danger?: boolean; disabled?: boolean;
}) {
  return (
    <div className="mt-5 flex gap-2">
      <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line-strong px-4 py-2.5 text-[13px] font-medium text-body hover:text-heading">
        Batal
      </button>
      <button type="submit" disabled={busy || disabled}
        className={`flex-1 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50 ${danger ? "bg-danger-700" : "bg-linear-to-br from-brand-500 to-brand-700"}`}>
        {busy ? "Menyimpan…" : submitLabel}
      </button>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return text ? <p role="alert" className="mb-3 rounded-xl border border-danger/30 bg-danger-50 px-3 py-2 text-[13px] text-danger-700">{text}</p> : null;
}

function QtyField({ value, onChange, max, id }: { value: number; onChange: (n: number) => void; max: number; id: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Kurangi" onClick={() => onChange(Math.max(1, value - 1))}
        className="h-10 w-10 shrink-0 rounded-lg border border-line-strong text-[16px] text-body hover:text-heading">−</button>
      <input id={id} type="number" inputMode="numeric" min={1} max={max} value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(max, Math.floor(Number(e.target.value) || 1))))}
        className="w-20 rounded-lg border border-line-strong bg-field px-2 py-2 text-center text-[13px] tabular-nums text-body focus:outline-none focus:border-accent" />
      <button type="button" aria-label="Tambah" onClick={() => onChange(Math.min(max, value + 1))}
        className="h-10 w-10 shrink-0 rounded-lg border border-line-strong text-[16px] text-body hover:text-heading">+</button>
    </div>
  );
}

// ── Catat / ubah bounty ────────────────────────────────────────────────────
export function BountyFormModal({ item, asList, jenisList, tujuanList, send, onClose }: {
  item: BountyItem | null;            // null = catat baru
  asList: string[];
  jenisList: string[];
  tujuanList: SJTujuan[];
  send: Send;
  onClose: () => void;
}) {
  const [asInisial, setAsInisial] = useState(item?.as_inisial ?? "");
  const [jenis, setJenis] = useState(item?.jenis ?? "");
  const [qty, setQty] = useState(item?.qty ?? 1);
  const [tujuanId, setTujuanId] = useState(item?.tujuan?.id ?? "");
  const [tanggal, setTanggal] = useState(item?.tanggal ?? todayWib());
  const [keterangan, setKeterangan] = useState(item?.keterangan ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const asOptions = useMemo(() => {
    const typed = normalizeInisial(asInisial);
    const list = asList.map((a) => ({ value: a, label: a }));
    return typed && !asList.includes(typed) ? [{ value: typed, label: typed, sublabel: "AS baru" }, ...list] : list;
  }, [asList, asInisial]);
  const jenisOptions = useMemo(() => jenisList.map((j) => ({ value: j, label: j })), [jenisList]);
  const tujuanOptions = useMemo(() => tujuanList.map((t) => ({ value: t.id, label: `${t.kode} — ${t.nama}` })), [tujuanList]);
  const isNewAs = !!asInisial && !asList.includes(normalizeInisial(asInisial));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!asInisial.trim()) return setError("Pilih atau ketik inisial AS.");
    if (!jenis.trim()) return setError("Pilih jenis barang.");
    if (item && qty < item.qty_selesai) return setError(`Jumlah tidak boleh kurang dari yang sudah kembali (${item.qty_selesai}).`);
    const fields = {
      as_inisial: normalizeInisial(asInisial), jenis: jenis.trim(), qty,
      tujuan_id: tujuanId || null, keterangan: keterangan.trim(), tanggal,
    };
    let body: Record<string, unknown>;
    if (item) {
      const before = {
        as_inisial: item.as_inisial, jenis: item.jenis, qty: item.qty,
        tujuan_id: item.tujuan?.id ?? null, keterangan: item.keterangan, tanggal: item.tanggal,
      };
      const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== before[k as keyof typeof before]));
      if (Object.keys(changed).length === 0) return onClose();
      body = { id: item.id, aksi: "ubah", ...changed };
    } else {
      body = fields;
    }
    setBusy(true);
    const err = await send(item ? "PATCH" : "POST", body);
    setBusy(false);
    if (err) setError(err); else onClose();
  };

  return (
    <Shell title={item ? "Ubah catatan bounty" : "Catat bounty baru"} onClose={onClose} width="max-w-lg"
      subtitle={item ? `${item.as_inisial} · ${item.jenis}` : "Barang yang dipinjam AS atau dijanjikan dikembalikan."}>
      <form onSubmit={submit}>
        <ErrorBox text={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className={labelCls}>AS (inisial)</span>
            <SearchableDropdown options={asOptions} value={normalizeInisial(asInisial)} onChange={setAsInisial}
              placeholder="Pilih AS, atau ketik inisial baru" allowCustom />
            <p className="mt-1 text-[12px] text-dim">
              {isNewAs ? <>AS baru <b className="text-body">{normalizeInisial(asInisial)}</b> akan ditambahkan.</> : "Belum ada di daftar? Ketik inisialnya lalu Enter."}
            </p>
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Jenis barang</span>
            <SearchableDropdown options={jenisOptions} value={jenis} onChange={setJenis} placeholder="Pilih jenis barang" allowCustom />
          </div>
          <div>
            <label htmlFor="bounty-qty" className={labelCls}>Jumlah</label>
            <QtyField id="bounty-qty" value={qty} onChange={setQty} max={9999} />
            <p className="mt-1 text-[12px] text-dim">Bounty {formatRupiah(qty * BOUNTY_PER_BARANG)}</p>
          </div>
          <div>
            <label htmlFor="bounty-tanggal" className={labelCls}>Tanggal ditetapkan</label>
            <input id="bounty-tanggal" type="date" value={tanggal} max={todayWib()} onChange={(e) => setTanggal(e.target.value)} className={inputCls} required />
          </div>
          <div className="sm:col-span-2">
            <span className={labelCls}>Toko <span className="font-normal text-dim">(opsional)</span></span>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchableDropdown options={tujuanOptions} value={tujuanId} onChange={setTujuanId} placeholder="Pilih toko" />
              </div>
              {tujuanId && (
                <button type="button" onClick={() => setTujuanId("")} className="rounded-lg border border-line-strong px-3 text-[12px] text-muted hover:text-heading">
                  Kosongkan
                </button>
              )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bounty-ket" className={labelCls}>Keterangan <span className="font-normal text-dim">(opsional)</span></label>
            <textarea id="bounty-ket" rows={3} maxLength={500} value={keterangan} onChange={(e) => setKeterangan(e.target.value)}
              placeholder="mis. printer toko rusak, janji bawa yang rusak minggu depan" className={inputCls} />
          </div>
        </div>
        <Actions onClose={onClose} busy={busy} submitLabel={item ? "Simpan perubahan" : "Catat bounty"} />
      </form>
    </Shell>
  );
}

// ── Tandai kembali (boleh sebagian) ────────────────────────────────────────
export function SettleModal({ item, send, onClose }: { item: BountyItem; send: Send; onClose: () => void }) {
  const sisa = sisaBarang(item);
  const [qty, setQty] = useState(sisa);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await send("PATCH", { id: item.id, aksi: "selesai", qty, catatan: catatan.trim() });
    setBusy(false);
    if (err) setError(err); else onClose();
  };

  return (
    <Shell title="Tandai sudah kembali" onClose={onClose}
      subtitle={<><b className="text-body">{item.as_inisial}</b> · {item.jenis} — sisa {sisa} dari {item.qty}</>}>
      <form onSubmit={submit}>
        <ErrorBox text={error} />
        <label htmlFor="settle-qty" className={labelCls}>Jumlah yang kembali</label>
        {sisa > 1 ? <QtyField id="settle-qty" value={qty} onChange={setQty} max={sisa} /> : <p className="text-[13px] text-body">1 {item.jenis}</p>}
        <p className="mt-1 text-[12px] text-dim">
          {qty < sisa ? `Sisa ${sisa - qty} tetap tercatat sebagai utang.` : "Utang ini lunas."} Bounty turun {formatRupiah(qty * BOUNTY_PER_BARANG)}.
        </p>
        <label htmlFor="settle-note" className={`${labelCls} mt-4`}>Catatan <span className="font-normal text-dim">(opsional)</span></label>
        <input id="settle-note" maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)}
          placeholder="mis. dikembalikan ke Budi, barang rusak sudah diterima" className={inputCls} />
        <Actions onClose={onClose} busy={busy} submitLabel={qty < sisa ? `Tandai ${qty} kembali` : "Tandai lunas"} />
      </form>
    </Shell>
  );
}

// ── Batalkan tanda kembali ─────────────────────────────────────────────────
export function UndoModal({ item, send, onClose }: { item: BountyItem; send: Send; onClose: () => void }) {
  const [qty, setQty] = useState(item.qty_selesai);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await send("PATCH", { id: item.id, aksi: "batal", qty, catatan: catatan.trim() });
    setBusy(false);
    if (err) setError(err); else onClose();
  };

  return (
    <Shell title="Batalkan tanda kembali" onClose={onClose}
      subtitle={<><b className="text-body">{item.as_inisial}</b> · {item.jenis} — {item.qty_selesai} dari {item.qty} sudah ditandai kembali</>}>
      <form onSubmit={submit}>
        <ErrorBox text={error} />
        <label htmlFor="undo-qty" className={labelCls}>Jumlah yang dibatalkan</label>
        {item.qty_selesai > 1 ? <QtyField id="undo-qty" value={qty} onChange={setQty} max={item.qty_selesai} /> : <p className="text-[13px] text-body">1 {item.jenis}</p>}
        <label htmlFor="undo-note" className={`${labelCls} mt-4`}>Alasan <span className="font-normal text-dim">(opsional)</span></label>
        <input id="undo-note" maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. salah centang" className={inputCls} />
        <Actions onClose={onClose} busy={busy} submitLabel="Batalkan tanda" />
      </form>
    </Shell>
  );
}

// ── Hapus ──────────────────────────────────────────────────────────────────
export function DeleteModal({ item, send, onClose }: { item: BountyItem; send: Send; onClose: () => void }) {
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const err = await send("DELETE", { id: item.id, catatan: catatan.trim() });
    setBusy(false);
    if (err) setError(err); else onClose();
  };

  return (
    <Shell title="Hapus catatan bounty?" onClose={onClose}
      subtitle={<><b className="text-body">{item.as_inisial}</b> · {item.jenis} × {item.qty}</>}>
      <form onSubmit={submit}>
        <ErrorBox text={error} />
        <p className="text-[13px] text-body">
          Catatan hilang dari daftar dan bounty AS berkurang. Pakai <b>Tandai kembali</b> bila barangnya sudah dikembalikan —
          hapus hanya untuk catatan yang salah input.
        </p>
        <label htmlFor="del-note" className={`${labelCls} mt-4`}>Alasan <span className="font-normal text-dim">(opsional)</span></label>
        <input id="del-note" maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. dobel input" className={inputCls} />
        <Actions onClose={onClose} busy={busy} submitLabel="Hapus" danger />
      </form>
    </Shell>
  );
}

// ── Tagih lewat WhatsApp ───────────────────────────────────────────────────
// Teks dibuat dari utang yang BELUM lunas sesuai filter AS/cari yang aktif; bisa diedit dulu.
// "Buka WhatsApp" membuka wa.me (WhatsApp Desktop/Web di PC ini) → pilih kontak atau grup AS.
export function WaModal({ items, scope, onClose }: { items: BountyItem[]; scope: string; onClose: () => void }) {
  const initial = useMemo(() => buildWaMessage(items), [items]);
  const [text, setText] = useState(initial);
  const [note, setNote] = useState("");

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setNote("Teks disalin — tempel di chat WhatsApp."); }
    catch { setNote("Browser menolak menyalin otomatis — blok teks lalu Ctrl+C."); }
  };

  return (
    <Shell title="Tagih via WhatsApp" onClose={onClose} width="max-w-xl"
      subtitle={<>Utang belum lunas — {scope}. Teks boleh diubah sebelum dikirim.</>}>
      {initial ? (
        <>
          <label htmlFor="wa-text" className={labelCls}>Isi pesan</label>
          <textarea id="wa-text" rows={14} value={text} onChange={(e) => { setText(e.target.value); setNote(""); }}
            className={`${inputCls} font-mono text-[12px] leading-relaxed`} />
          <p className="mt-1 text-[12px] text-dim">*teks* = tebal, _teks_ = miring di WhatsApp. {text.length.toLocaleString("id-ID")} karakter.</p>
          {note && <p role="status" className="mt-2 text-[12px] font-medium text-success-700">{note}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line-strong px-4 py-2.5 text-[13px] font-medium text-body hover:text-heading">
              Tutup
            </button>
            <button type="button" onClick={copy} className="ml-auto rounded-xl border border-line-strong px-4 py-2.5 text-[13px] font-semibold text-body hover:text-heading">
              Salin teks
            </button>
            <a href={waLink(text)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-success-700 px-4 py-2.5 text-[13px] font-semibold text-white">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" /></svg>
              Buka WhatsApp
            </a>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-body">Tidak ada utang yang belum lunas untuk {scope}. 🎉</p>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onClose} className="rounded-xl border border-line-strong px-4 py-2.5 text-[13px] font-medium text-body hover:text-heading">Tutup</button>
          </div>
        </>
      )}
    </Shell>
  );
}
