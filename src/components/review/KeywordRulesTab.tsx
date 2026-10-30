"use client";

import { memo, useCallback, useEffect, useState } from "react";

// Cache saran nilai & dropdown SJ di-invalidate oleh server setiap kali rule berubah
// (src/server/modules/classification/rules.ts) — client tidak perlu memanggilnya lagi.
import type { KeywordRule } from "@/lib/reviewTypes";
import { useKeywordRuleValues } from "@/hooks/useKeywordRuleValues";
import AutocompleteInput from "@/components/review/AutocompleteInput";

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditRuleModalProps {
  rule: KeywordRule;
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-all duration-150 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 hover:border-white/20";
const selectCls =
  "w-full rounded-lg border border-white/10 bg-[#0f1724] px-3 py-2 text-sm text-white outline-none transition-all duration-150 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 hover:border-white/20 appearance-none cursor-pointer";

const EditRuleModal = memo(({ rule, onClose, onSaved }: EditRuleModalProps) => {
  const [keyword, setKeyword] = useState(rule.keyword);
  const [ruleType, setRuleType] = useState<"jenis" | "merk" | "no_merk">(rule.rule_type as "jenis" | "merk" | "no_merk");
  const [value, setValue] = useState(rule.value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [valueMismatch, setValueMismatch] = useState(false);

  const isNoMerk = ruleType === "no_merk";
  const suggestionType = isNoMerk ? null : ruleType as "jenis" | "merk";
  const { values: suggestions, loading: loadingSuggestions } = useKeywordRuleValues(suggestionType);

  // ── Filter suggestions: exclude value rule yang sedang di-edit ─────────
  // Supaya kalau user edit rule "CPU" tanpa ubah value, tidak ke-detect mismatch dengan dirinya sendiri
  // Logic: kalau ada multiple rule dengan value sama persis, OK; kalau cuma 1 (yaitu rule ini), filter out
  // Untuk simplicity: tetap pakai suggestions apa adanya, mismatch check tetap valid karena
  // case-sensitive equal akan return null (existing === trimmed check di AutocompleteInput)
  // Selama user tidak ubah casing value, tidak akan trigger mismatch.

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (isNoMerk && value !== "Non-Merk") setValue("Non-Merk");
  }, [isNoMerk, value]);

  const handleSave = useCallback(async () => {
    if (!keyword.trim()) { setError("Keyword wajib diisi"); return; }
    if (!isNoMerk && !value.trim()) { setError("Value wajib diisi"); return; }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/keyword-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, keyword, rule_type: ruleType, value }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `Gagal menyimpan (HTTP ${res.status}).`);
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }, [keyword, ruleType, value, rule.id, isNoMerk, onClose, onSaved]);

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const isSaveDisabled = saving || valueMismatch;

  return (
    <div onClick={handleBackdrop} style={{ animation: "fadeIn 180ms ease both" }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div style={{ animation: "slideUp 220ms cubic-bezier(0.16,1,0.3,1) both" }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0c1421]/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Edit Keyword Rule</h2>
            <p className="mt-0.5 text-xs text-white/40">Perubahan akan diterapkan saat Reclassify dijalankan</p>
          </div>
          <button onClick={onClose} className="ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13" /></svg>
          </button>
        </div>
        <div className="mx-6 h-px bg-white/5" />
        <div className="flex flex-col gap-4 px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-widest uppercase text-cyan-400/80">Keyword <span className="text-cyan-400">*</span></label>
            <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} className={inputCls}
              placeholder="e.g. DAIKIN, AC SPLIT WALL" suppressHydrationWarning />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold tracking-widest uppercase text-cyan-400/80">Tipe Rule <span className="text-cyan-400">*</span></label>
            <div className="relative">
              <select value={ruleType}
                onChange={(e) => setRuleType(e.target.value as "jenis" | "merk" | "no_merk")}
                className={selectCls} suppressHydrationWarning>
                <option value="merk">Merk</option>
                <option value="jenis">Jenis</option>
                <option value="no_merk">No Merk (barang generic / tidak bermerek)</option>
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l4 4 4-4" /></svg>
            </div>
          </div>

          {!isNoMerk && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase text-cyan-400/80">
                {ruleType === "merk" ? "Merk" : "Jenis Barang"} <span className="text-cyan-400">*</span>
              </label>
              <AutocompleteInput
                value={value}
                onChange={setValue}
                suggestions={suggestions}
                loading={loadingSuggestions}
                placeholder={ruleType === "merk" ? "Contoh: DAIKIN" : "Contoh: AC Split"}
                className={inputCls}
                onMismatchChange={({ hasMismatch }) => setValueMismatch(hasMismatch)}
              />
              <p className="text-[10.5px] text-white/30 leading-relaxed">
                Value yang sama (case-insensitive) wajib pakai casing yang sudah ada — untuk konsistensi data.
              </p>
            </div>
          )}

          {isNoMerk && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Aset yang cocok dengan keyword ini akan ditandai sebagai <span className="font-semibold text-amber-300">Non-Merk</span>.
              </p>
            </div>
          )}

          {error && <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-white/5 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">Batal</button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            title={valueMismatch ? "Casing tidak konsisten — pilih suggestion existing dulu" : undefined}
            className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-5 py-2 text-sm font-medium text-cyan-300 shadow-sm transition-all hover:bg-cyan-500/20 hover:text-cyan-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-cyan-500/10"
          >
            {saving ? (<><svg className="animate-spin" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 1.5A5 5 0 1 1 1.5 6.5" /></svg>Menyimpan…</>) : (<><svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6.5l3.5 3.5 5.5-6" /></svg>Simpan</>)}
          </button>
        </div>
      </div>
    </div>
  );
});
EditRuleModal.displayName = "EditRuleModal";

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmProps {
  rule: KeywordRule;
  onClose: () => void;
  onDeleted: (rule: KeywordRule) => void;
}

const DeleteConfirmModal = memo(({ rule, onClose, onDeleted }: DeleteConfirmProps) => {
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState<"confirm" | "reverting">("confirm");

  const handleDelete = useCallback(async () => {
    setDeleting(true);

    const res = await fetch(`/api/keyword-rules?id=${encodeURIComponent(rule.id!)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { setDeleting(false); return; }

    setStatus("reverting");
    try {
      const body: Record<string, string> = {};
      if (rule.rule_type === "merk")    body.revert_merk  = rule.value;
      else if (rule.rule_type === "no_merk") body.revert_merk = "Non-Merk";
      else                              body.revert_jenis = rule.value;

      await fetch("/api/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (_) {}

    setDeleting(false);
    onDeleted(rule);
    onClose();
  }, [rule, onClose, onDeleted]);

  const handleBackdrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !deleting) onClose();
  }, [onClose, deleting]);

  return (
    <div onClick={handleBackdrop} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c1421]/95 shadow-2xl backdrop-blur-xl p-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            status === "reverting"
              ? "border-violet-500/20 bg-violet-500/10"
              : "border-rose-500/20 bg-rose-500/10"
          }`}>
            {status === "reverting" ? (
              <svg className="animate-spin text-violet-400" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 2a8 8 0 1 0 8 8" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-400">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
          </div>
          <div>
            {status === "reverting" ? (
              <>
                <h3 className="text-base font-semibold text-white">Reverting aset terdampak…</h3>
                <p className="mt-1 text-xs text-white/40">Aset yang terklasifikasi oleh rule ini sedang dikembalikan ke Unknown</p>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-white">Hapus Rule?</h3>
                <p className="mt-1 text-xs text-white/40">
                  Rule <span className="font-mono text-white/70">{rule.keyword}</span> akan dihapus dan aset yang terklasifikasi oleh rule ini akan di-revert ke Unknown secara otomatis.
                </p>
              </>
            )}
          </div>
        </div>
        {status === "confirm" && (
          <div className="flex gap-2 mt-5">
            <button onClick={onClose} disabled={deleting}
              className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/50 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-40">
              Batal
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/20 transition-all disabled:opacity-50">
              {deleting ? "Menghapus…" : "Hapus & Revert"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
DeleteConfirmModal.displayName = "DeleteConfirmModal";

// ─── Rule Type Badge ──────────────────────────────────────────────────────────

const RuleTypeBadge = memo(({ type }: { type: string }) => {
  const config = type === "merk"
    ? { label: "Merk", className: "text-violet-400 bg-violet-400/10 border-violet-400/20" }
    : type === "no_merk"
    ? { label: "No Merk", className: "text-slate-400 bg-slate-400/10 border-slate-400/20" }
    : { label: "Jenis", className: "text-blue-400 bg-blue-400/10 border-blue-400/20" };

  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${config.className}`}>
      {config.label}
    </span>
  );
});
RuleTypeBadge.displayName = "RuleTypeBadge";

// ─── Main Component ───────────────────────────────────────────────────────────

interface KeywordRulesTabProps {
  onRulesChanged?: () => void;
}

export default function KeywordRulesTab({ onRulesChanged }: KeywordRulesTabProps) {
  const [rules, setRules] = useState<KeywordRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<KeywordRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KeywordRule | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/keyword-rules").catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    setRules((json?.rules as KeywordRule[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSaved = useCallback(() => {
    fetchRules();
    onRulesChanged?.();
  }, [fetchRules, onRulesChanged]);

  const handleDeleted = useCallback((_rule: KeywordRule) => {
    fetchRules();
    onRulesChanged?.();
  }, [fetchRules, onRulesChanged]);

  const filtered = rules.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return r.keyword.toLowerCase().includes(q) || r.value.toLowerCase().includes(q);
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-xl shadow-black/30">

      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
        <span className="text-[11px] text-white/40">
          <span className="text-white/70 font-mono">{filtered.length}</span> rule
        </span>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari keyword, value..." suppressHydrationWarning
            className="bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[12px] placeholder:text-slate-600 rounded-xl pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all" />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_80px_1fr_80px] gap-4 border-b border-white/[0.06] px-5 py-3">
        {["Keyword", "Tipe", "Value", ""].map((h, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase tracking-widest text-white/25">{h}</span>
        ))}
      </div>

      {loading ? (
        <div className="divide-y divide-white/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-3 rounded bg-white/5" style={{ width: `${20 + (i % 3) * 15}%` }} />
              <div className="h-5 w-12 rounded bg-white/5" />
              <div className="h-3 rounded bg-white/5" style={{ width: `${15 + (i % 2) * 10}%` }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm font-medium text-white/40">
            {search ? "Tidak ada rule yang cocok" : "Belum ada keyword rule"}
          </p>
          <p className="mt-1 text-xs text-white/20">
            {search ? "Coba kata kunci lain" : "Tambah rule dari tab Review Aset"}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {filtered.map((rule) => (
            <div key={rule.id}
              className="grid grid-cols-[1fr_80px_1fr_80px] gap-4 items-center px-5 py-3.5 hover:bg-white/[0.02] transition-colors group">
              <span className="font-mono text-[12px] text-cyan-400/80 truncate">{rule.keyword}</span>
              <div><RuleTypeBadge type={rule.rule_type} /></div>
              <span className="text-slate-300 text-[12px] truncate">{rule.value}</span>
              <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setEditTarget(rule)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/[0.05] transition-all"
                  title="Edit rule">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button onClick={() => setDeleteTarget(rule)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-500 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/[0.05] transition-all"
                  title="Hapus rule">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editTarget && <EditRuleModal rule={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />}
      {deleteTarget && <DeleteConfirmModal rule={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}
    </div>
  );
}
