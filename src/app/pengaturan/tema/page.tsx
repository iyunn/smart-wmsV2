"use client";

// ══════════════════════════════════════════════════════════════════════════
// /pengaturan/tema — warna custom per user (PRD D10, ARCHITECTURE D-37).
// Semua warna dasar tema light & dark bebas diubah; perubahan langsung terlihat di seluruh
// aplikasi (pratinjau) dan baru tersimpan ke akun saat "Simpan". Keluar tanpa menyimpan =
// kembali ke warna tersimpan. Jalan keluar bila layar tak terbaca: /pengaturan/tema?reset-theme
// ══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useTheme } from "@/components/ThemeContext";
import {
  CUSTOM_TOKENS, DEFAULT_TOKENS, HEX_COLOR, contrastRatio, diffFromDefault,
  type CustomTheme, type CustomThemeSet, type CustomTokenKey, type ThemeMode,
} from "@/lib/theme/custom";

type Full = Record<CustomTokenKey, string>;
type Draft = Record<ThemeMode, Full>;

const GROUPS = Array.from(new Set(CUSTOM_TOKENS.map((t) => t.group)));

function fullFrom(mode: ThemeMode, saved: CustomThemeSet | undefined): Full {
  return { ...DEFAULT_TOKENS[mode], ...(saved ?? {}) } as Full;
}

function toCustom(draft: Draft): CustomTheme | null {
  const light = diffFromDefault("light", draft.light);
  const dark = diffFromDefault("dark", draft.dark);
  if (!light && !dark) return null;
  return { ...(light ? { light } : {}), ...(dark ? { dark } : {}) };
}

function sameTheme(a: CustomTheme | null, b: CustomTheme | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export default function ThemeSettingsPage() {
  const { theme, setTheme, custom, previewCustom, saveCustom } = useTheme();
  const [draft, setDraft] = useState<Draft>(() => ({ light: fullFrom("light", undefined), dark: fullFrom("dark", undefined) }));
  const [hexText, setHexText] = useState<Partial<Record<CustomTokenKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [rescue, setRescue] = useState(false);
  const loadedFrom = useRef<string>("");

  // Isi draft dari warna tersimpan (dan setiap kali yang tersimpan berubah dari luar)
  useEffect(() => {
    const key = JSON.stringify(custom ?? null);
    if (key === loadedFrom.current) return;
    loadedFrom.current = key;
    setDraft({ light: fullFrom("light", custom?.light), dark: fullFrom("dark", custom?.dark) });
    setHexText({});
  }, [custom]);

  useEffect(() => { setRescue(window.location.search.includes("reset-theme")); }, []);

  const pending = useMemo(() => toCustom(draft), [draft]);
  const dirty = !sameTheme(pending, custom);
  const cur = draft[theme];

  // Ganti tab terang/gelap = ganti mode aplikasi; pasang lagi draft yang belum disimpan
  useEffect(() => {
    if (dirty) previewCustom(pending ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Keluar halaman tanpa simpan → pasang lagi warna tersimpan
  useEffect(() => () => previewCustom(null), [previewCustom]);


  const update = useCallback((key: CustomTokenKey, value: string) => {
    setDraft((d) => {
      const next = { ...d, [theme]: { ...d[theme], [key]: value.toUpperCase() } } as Draft;
      previewCustom(toCustom(next) ?? {});
      return next;
    });
    setMessage(null);
  }, [theme, previewCustom]);

  const resetMode = () => {
    setDraft((d) => {
      const next = { ...d, [theme]: { ...DEFAULT_TOKENS[theme] } } as Draft;
      previewCustom(toCustom(next) ?? {});
      return next;
    });
    setHexText({});
    setMessage(null);
  };

  const cancel = () => {
    setDraft({ light: fullFrom("light", custom?.light), dark: fullFrom("dark", custom?.dark) });
    setHexText({});
    previewCustom(null);
    setMessage(null);
  };

  const save = async (value: CustomTheme | null) => {
    setSaving(true);
    const r = await saveCustom(value);
    setSaving(false);
    if (r.ok) {
      setMessage({ kind: "ok", text: value ? "Warna tersimpan di akunmu (ikut di semua perangkat)." : "Kembali ke warna bawaan." });
      if (rescue) {
        setRescue(false);
        window.history.replaceState(null, "", "/pengaturan/tema");
      }
    } else {
      setMessage({ kind: "error", text: `Gagal menyimpan: ${r.error ?? "coba lagi"}` });
    }
  };

  const checks = [
    { label: "Teks isi di kartu", a: cur.text, b: cur.surface, need: 4.5 },
    { label: "Teks keterangan di kartu", a: cur["text-muted"], b: cur.surface, need: 4.5 },
    { label: "Aksen di kartu", a: cur.accent, b: cur.surface, need: 4.5 },
    { label: "Teks putih di tombol", a: "#FFFFFF", b: cur["accent-solid"], need: 4.5 },
    { label: "Judul di latar", a: cur["text-strong"], b: cur.bg, need: 4.5 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-heading">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Warna Tampilan" />
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {rescue && (
            <div className="rounded-xl border border-danger/30 bg-danger-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-danger-700">
                Mode penyelamatan: warna custom sedang tidak dipasang. Kembalikan ke bawaan bila warnamu membuat layar sulit dibaca.
              </p>
              <button onClick={() => save(null)} disabled={saving}
                className="px-4 py-2 rounded-xl bg-danger-700 text-[13px] font-semibold text-white disabled:opacity-50">
                Kembalikan ke bawaan
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-bold tracking-tight text-heading">Warna tampilan</h1>
              <p className="mt-1 text-[13px] text-muted max-w-2xl">
                Atur warna sesukamu untuk tema terang dan gelap. Perubahan langsung terlihat di seluruh aplikasi
                dan baru tersimpan setelah menekan <b>Simpan</b>. Hanya berlaku untuk akunmu.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Tema yang diedit">
              {(["light", "dark"] as const).map((m) => (
                <button key={m} role="tab" aria-selected={theme === m} onClick={() => setTheme(m)}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${theme === m ? "bg-brand-50 text-brand-700" : "text-muted hover:text-heading"}`}>
                  {m === "light" ? "Terang" : "Gelap"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            {/* ── Editor ───────────────────────────────────────────── */}
            <section className="rounded-2xl border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <p className="text-[14px] font-semibold text-heading">
                  Mengedit tema {theme === "light" ? "terang" : "gelap"}
                  {custom?.[theme] && <span className="ml-2 text-[12px] font-medium text-accent">(custom)</span>}
                </p>
                <button onClick={resetMode} className="text-[12px] font-medium text-muted hover:text-heading underline underline-offset-2">
                  Kembalikan tema {theme === "light" ? "terang" : "gelap"} ke bawaan
                </button>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {GROUPS.map((g) => (
                  <div key={g} className="px-5 py-4">
                    <p className="mb-3 text-[12px] font-semibold text-muted">{g}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {CUSTOM_TOKENS.filter((t) => t.group === g).map((t) => {
                        const value = cur[t.key];
                        const isDefault = value.toUpperCase() === DEFAULT_TOKENS[theme][t.key].toUpperCase();
                        const text = hexText[t.key] ?? value;
                        return (
                          <div key={t.key} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5">
                            <input type="color" value={value.toLowerCase()} aria-label={t.label}
                              onChange={(e) => { setHexText((h) => ({ ...h, [t.key]: undefined })); update(t.key, e.target.value); }}
                              className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-transparent p-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-heading truncate">{t.label}</p>
                              <p className="text-[12px] text-muted truncate" title={t.hint}>{t.hint}</p>
                            </div>
                            <input value={text} maxLength={7} spellCheck={false} aria-label={`Kode warna ${t.label}`}
                              onChange={(e) => {
                                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                                setHexText((h) => ({ ...h, [t.key]: v }));
                                if (HEX_COLOR.test(v)) update(t.key, v);
                              }}
                              onBlur={() => setHexText((h) => ({ ...h, [t.key]: undefined }))}
                              className={`w-[88px] rounded-lg border bg-field px-2 py-1.5 font-mono text-[12px] text-body ${HEX_COLOR.test(text) ? "border-line-strong" : "border-danger"}`} />
                            {!isDefault && (
                              <button onClick={() => { setHexText((h) => ({ ...h, [t.key]: undefined })); update(t.key, DEFAULT_TOKENS[theme][t.key]); }}
                                title="Kembalikan warna ini ke bawaan" aria-label={`Kembalikan ${t.label} ke bawaan`}
                                className="shrink-0 rounded-lg p-1.5 text-muted hover:text-heading hover:bg-brand-50/60">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Pratinjau & simpan ──────────────────────────────────── */}
            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
                <p className="text-[14px] font-semibold text-heading">Contoh tampilan</p>
                <div className="space-y-1">
                  <p className="text-[20px] font-bold text-heading tabular-nums">1.561 <span className="text-[13px] font-medium text-muted">barang</span></p>
                  <p className="text-[13px] text-body">Teks isi tabel dan paragraf.</p>
                  <p className="text-[12px] text-muted">Keterangan dan header kolom.</p>
                  <p className="text-[13px] font-mono text-accent">SJ-Manual/CGA/2026/10/0001</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-success-50 px-2 py-0.5 text-[12px] font-semibold text-success-700">CGA1 · Selesai</span>
                  <span className="rounded-md bg-warning-50 px-2 py-0.5 text-[12px] font-semibold text-warning-700">CGA2 · Draft</span>
                  <span className="rounded-md bg-danger-50 px-2 py-0.5 text-[12px] font-semibold text-danger-700">CGA3 · Hapus</span>
                  <span className="rounded-md bg-plum-50 px-2 py-0.5 text-[12px] font-semibold text-plum-700">LPP</span>
                </div>
                <div className="rounded-xl border border-line bg-panel">
                  <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[13px] font-semibold text-brand-700">● Menu aktif</div>
                  <div className="px-3 py-2 text-[13px] text-muted">Menu biasa</div>
                </div>
                <input readOnly value="Kolom isian" className="w-full rounded-lg border border-line-strong bg-field px-3 py-2 text-[13px] text-body" />
                <button type="button" className="w-full rounded-xl bg-linear-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white">
                  Tombol utama
                </button>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-[14px] font-semibold text-heading">Keterbacaan</p>
                <p className="mt-1 text-[12px] text-muted">Hanya info — warna tetap boleh dipakai.</p>
                <ul className="mt-3 space-y-1.5">
                  {checks.map((c) => {
                    const r = contrastRatio(c.a, c.b);
                    const ok = r >= c.need;
                    return (
                      <li key={c.label} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-body">{c.label}</span>
                        <span className={`font-semibold tabular-nums ${ok ? "text-success-700" : "text-warning-700"}`}>
                          {r.toFixed(1)}:1 {ok ? "· jelas" : "· kurang jelas"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
                {message && (
                  <p role="status" className={`text-[12px] font-medium ${message.kind === "ok" ? "text-success-700" : "text-danger-700"}`}>{message.text}</p>
                )}
                <button onClick={() => save(pending)} disabled={!dirty || saving}
                  className="w-full rounded-xl bg-linear-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                  {saving ? "Menyimpan…" : dirty ? "Simpan warna" : "Tersimpan"}
                </button>
                <div className="flex gap-2">
                  <button onClick={cancel} disabled={!dirty || saving}
                    className="flex-1 rounded-xl border border-line-strong px-3 py-2 text-[13px] font-medium text-body disabled:opacity-50">
                    Batalkan perubahan
                  </button>
                  <button onClick={() => save(null)} disabled={saving || !custom}
                    className="flex-1 rounded-xl border border-danger/40 px-3 py-2 text-[13px] font-medium text-danger-700 disabled:opacity-50">
                    Semua ke bawaan
                  </button>
                </div>
                <p className="text-[12px] text-muted">
                  Layar jadi sulit dibaca? Buka <span className="font-mono text-body">/pengaturan/tema?reset-theme</span> untuk
                  menampilkan warna bawaan sementara, lalu tekan &ldquo;Kembalikan ke bawaan&rdquo;.
                </p>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
