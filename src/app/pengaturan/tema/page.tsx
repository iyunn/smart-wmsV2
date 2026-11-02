"use client";

// ══════════════════════════════════════════════════════════════════════════
// /pengaturan/tema — warna custom per user (PRD D10, ARCHITECTURE D-37).
// Semua warna dasar tema light & dark bebas diubah; perubahan langsung terlihat di seluruh
// aplikasi (pratinjau) dan baru tersimpan ke akun saat "Simpan". Keluar tanpa menyimpan =
// kembali ke warna tersimpan. Jalan keluar bila layar tak terbaca: /pengaturan/tema?reset-theme
// Tahap 9b: preset sekali klik (src/lib/theme/presets.ts) dan bagikan warna lewat file/kode JSON
// (src/lib/theme/share.ts) — keduanya hanya mengisi draft; tersimpan tetap lewat "Simpan".
// Tahap 9b-2: pemilih warna = roda warna sendiri (src/components/ColorPicker.tsx).
// ══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ColorPicker from "@/components/ColorPicker";
import { useTheme } from "@/components/ThemeContext";
import {
  CUSTOM_TOKENS, DEFAULT_TOKENS, HEX_COLOR, contrastRatio, diffFromDefault,
  type CustomTheme, type CustomThemeSet, type CustomTokenKey, type ThemeMode,
} from "@/lib/theme/custom";
import { THEME_PRESETS, type ThemePreset } from "@/lib/theme/presets";
import { exportTheme, parseThemeImport } from "@/lib/theme/share";

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

function draftFrom(theme: CustomTheme | null): Draft {
  return { light: fullFrom("light", theme?.light), dark: fullFrom("dark", theme?.dark) };
}

const PRESET_THEMES = THEME_PRESETS.map((p) => ({ preset: p, theme: toCustom(draftFrom({ light: p.light, dark: p.dark })) }));

export default function ThemeSettingsPage() {
  const { theme, setTheme, custom, previewCustom, saveCustom } = useTheme();
  // Draft langsung dari warna tersimpan: bila diisi bawaan dulu, render pertama dianggap "ada perubahan"
  // dan warna bawaan sempat dipasang ke seluruh app (bug: buka lagi halaman ini → tema kembali bawaan).
  const [draft, setDraft] = useState<Draft>(() => ({ light: fullFrom("light", custom?.light), dark: fullFrom("dark", custom?.dark) }));
  const [hexText, setHexText] = useState<Partial<Record<CustomTokenKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [rescue, setRescue] = useState(false);
  const loadedFrom = useRef<string>(JSON.stringify(custom ?? null));

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

  // Ganti tab terang/gelap = ganti mode aplikasi; pasang lagi draft yang belum disimpan.
  // Hanya saat mode BERUBAH — bukan saat halaman dibuka (tidak ada draft yang perlu dipasang).
  const prevTheme = useRef(theme);
  useEffect(() => {
    if (prevTheme.current === theme) return;
    prevTheme.current = theme;
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

  /** Ganti seluruh draft (preset / impor) → pratinjau langsung, belum tersimpan. */
  const replaceDraft = (theme: CustomTheme | null, note: string) => {
    const next = draftFrom(theme);
    setDraft(next);
    setHexText({});
    previewCustom(toCustom(next) ?? {});
    setMessage({ kind: "ok", text: note });
  };

  const applyPreset = (p: ThemePreset, theme: CustomTheme | null) =>
    replaceDraft(theme, `Preset "${p.name}" dipasang untuk tema terang & gelap — tekan Simpan untuk menyimpan.`);

  // ── Bagikan warna ───────────────────────────────────────────────────────
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const importText = (text: string, source: string) => {
    const r = parseThemeImport(text);
    if (!r.ok) { setMessage({ kind: "error", text: r.error }); return false; }
    replaceDraft(r.theme, `Warna dari ${source} dimuat — periksa pratinjau, lalu tekan Simpan.`);
    return true;
  };

  const downloadFile = () => {
    const blob = new Blob([exportTheme(pending)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smartwms-warna.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(exportTheme(pending));
      setMessage({ kind: "ok", text: "Kode warna disalin — tempel di halaman Warna Tampilan akun lain." });
    } catch {
      setMessage({ kind: "error", text: "Browser menolak menyalin otomatis — pakai Unduh file." });
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 20_000) { setMessage({ kind: "error", text: "File terlalu besar — bukan file warna SmartWMS." }); return; }
    importText(await f.text(), `file "${f.name}"`);
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

          {/* ── Preset ─────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-line bg-surface px-5 py-4" aria-label="Preset warna">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold text-heading">Preset</p>
              <p className="text-[12px] text-muted">Satu klik mengisi tema terang &amp; gelap. Masih bisa diubah sebelum disimpan.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
              {PRESET_THEMES.map(({ preset, theme: pt }) => {
                const c = { ...DEFAULT_TOKENS[theme], ...preset[theme] } as Full;
                const active = sameTheme(pt, pending);
                return (
                  <button key={preset.id} type="button" onClick={() => applyPreset(preset, pt)} aria-pressed={active}
                    className={`group rounded-xl border p-2.5 text-left transition-colors ${active ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"}`}>
                    <div className="flex h-12 overflow-hidden rounded-lg border" style={{ background: c.bg, borderColor: c.border }}>
                      <div className="m-1.5 flex flex-1 flex-col justify-center gap-1 rounded-md px-2" style={{ background: c.surface }}>
                        <span className="h-1.5 w-3/4 rounded-full" style={{ background: c["text-strong"] }} />
                        <span className="h-1.5 w-1/2 rounded-full" style={{ background: c.accent }} />
                      </div>
                      <div className="my-1.5 mr-1.5 flex w-6 flex-col gap-1">
                        <span className="flex-1 rounded" style={{ background: c["accent-solid"] }} />
                        <span className="flex-1 rounded" style={{ background: c.cga1 }} />
                      </div>
                    </div>
                    <p className="mt-2 text-[13px] font-semibold text-heading">{preset.name}{active && <span className="ml-1.5 text-[11px] font-medium text-accent">dipakai</span>}</p>
                    <p className="text-[12px] text-muted leading-snug">{preset.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

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
                            <ColorPicker value={value} label={t.label} swatches={Object.values(cur)}
                              onChange={(hex) => { setHexText((h) => ({ ...h, [t.key]: undefined })); update(t.key, hex); }} />
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

              <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
                <div>
                  <p className="text-[14px] font-semibold text-heading">Bagikan warna</p>
                  <p className="mt-1 text-[12px] text-muted">Kirim warna yang sedang tampil ke rekan, atau pakai warna dari mereka.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={downloadFile} className="rounded-xl border border-line-strong px-3 py-2 text-[13px] font-medium text-body hover:text-heading">
                    Unduh file
                  </button>
                  <button onClick={copyCode} className="rounded-xl border border-line-strong px-3 py-2 text-[13px] font-medium text-body hover:text-heading">
                    Salin kode
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-line-strong px-3 py-2 text-[13px] font-medium text-body hover:text-heading">
                    Buka file
                  </button>
                  <button onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}
                    className="rounded-xl border border-line-strong px-3 py-2 text-[13px] font-medium text-body hover:text-heading">
                    Tempel kode
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} aria-label="Pilih file warna" />
                {pasteOpen && (
                  <div className="space-y-2">
                    <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} spellCheck={false}
                      aria-label="Kode warna" placeholder='{"format":"smartwms-tema", ...}'
                      className="w-full rounded-lg border border-line-strong bg-field px-3 py-2 font-mono text-[12px] text-body placeholder:text-dim" />
                    <button onClick={() => { if (importText(pasteText, "kode")) { setPasteText(""); setPasteOpen(false); } }}
                      disabled={!pasteText.trim()}
                      className="w-full rounded-xl bg-linear-to-br from-brand-500 to-brand-700 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                      Pakai kode ini
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
