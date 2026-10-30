"use client";

/**
 * ThemeContext — tema dark/light + warna custom per user untuk seluruh app.
 *
 * Sumber kebenaran: kolom `theme` & `theme_custom` di app_users (ikut akun, antar-perangkat),
 * disimpan lewat PATCH /api/me.
 * Cache: localStorage 'swms-theme' & 'swms-theme-custom' → dipasang skrip anti-flash di
 * layout.tsx SEBELUM halaman tampil (tanpa kedipan warna).
 *
 * Cara pakai:
 *   - useTheme().theme / toggleTheme / setTheme        → mode light/dark
 *   - useTheme().custom / previewCustom / saveCustom    → warna custom (PRD D10)
 * Tema diterapkan sebagai class 'dark'/'light' (+ 'theme-custom') dan CSS variable di <html>.
 * Styling: token di globals.css; warna turunan custom dihitung di blok `:root.theme-custom`.
 */

import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
  type ReactNode,
} from "react";
import { useSession } from "@/components/SessionContext";
import {
  type CustomTheme, type ThemeMode, CUSTOM_STORAGE_KEY, applyCustomTheme, sanitizeCustomTheme,
} from "@/lib/theme/custom";

export type Theme = ThemeMode;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  /** Warna custom yang tersimpan (null = tema bawaan) */
  custom: CustomTheme | null;
  /** Pasang warna sementara tanpa menyimpan (pratinjau). null = kembali ke yang tersimpan */
  previewCustom: (next: CustomTheme | null) => void;
  /** Simpan warna custom ke akun. null = hapus semua (kembali ke bawaan). */
  saveCustom: (next: CustomTheme | null) => Promise<{ ok: boolean; error?: string }>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
  custom: null,
  previewCustom: () => {},
  saveCustom: async () => ({ ok: false }),
});

const STORAGE_KEY = "swms-theme";

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

function readCachedCustom(): CustomTheme | null {
  try { return sanitizeCustomTheme(JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY) ?? "null")); }
  catch { return null; }
}

function writeCachedCustom(custom: CustomTheme | null) {
  try {
    if (custom) localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(custom));
    else localStorage.removeItem(CUSTOM_STORAGE_KEY);
  } catch { /* ignore */ }
}

/** `?reset-theme` di URL = jangan pasang warna custom (jalan keluar bila layar tak terbaca). */
function rescueMode(): boolean {
  return typeof location !== "undefined" && location.search.includes("reset-theme");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useSession();
  const [theme, setThemeState] = useState<Theme>("dark");
  const [custom, setCustom] = useState<CustomTheme | null>(null);
  const themeRef = useRef<Theme>("dark");
  const customRef = useRef<CustomTheme | null>(null);
  const dbSyncedRef = useRef(false);
  const customSyncedRef = useRef(false);
  const userTouchedRef = useRef(false);

  const paint = useCallback((mode: Theme, c: CustomTheme | null) => {
    applyThemeClass(mode);
    applyCustomTheme(mode, rescueMode() ? null : c);
  }, []);

  // 1. Cache localStorage saat mount (skrip anti-flash sudah memasangnya; ini menyamakan state)
  useEffect(() => {
    let cached: string | null = null;
    try { cached = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    const mode: Theme = cached === "light" ? "light" : "dark";
    const c = readCachedCustom();
    themeRef.current = mode;
    customRef.current = c;
    setThemeState(mode);
    setCustom(c);
    paint(mode, c);
  }, [paint]);

  // 2a. Mode dari DB HANYA SEKALI saat profil pertama dimuat, dan hanya bila belum ada pilihan
  //     di perangkat ini (localStorage lebih baru bila user baru saja menekan toggle).
  useEffect(() => {
    if (dbSyncedRef.current || userTouchedRef.current) return;
    const dbTheme = profile?.theme;
    if (dbTheme === "dark" || dbTheme === "light") {
      dbSyncedRef.current = true;
      let cached: string | null = null;
      try { cached = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
      if (cached !== "dark" && cached !== "light") {
        themeRef.current = dbTheme;
        setThemeState(dbTheme);
        paint(dbTheme, customRef.current);
        try { localStorage.setItem(STORAGE_KEY, dbTheme); } catch { /* ignore */ }
      }
    }
  }, [profile, paint]);

  // 2b. Warna custom dari DB sekali per pemuatan halaman: DB = sumber kebenaran antar-perangkat
  useEffect(() => {
    if (customSyncedRef.current || !profile) return;
    customSyncedRef.current = true;
    const fromDb = sanitizeCustomTheme(profile.themeCustom ?? null);
    customRef.current = fromDb;
    setCustom(fromDb);
    writeCachedCustom(fromDb);
    paint(themeRef.current, fromDb);
  }, [profile, paint]);

  const patchMe = useCallback(async (body: Record<string, unknown>) => {
    if (!user?.id) return { ok: false, error: "Belum login." };
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return { ok: false, error: (j as { error?: string }).error ?? `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Gagal terhubung ke server." };
    }
  }, [user]);

  const setTheme = useCallback((next: Theme) => {
    userTouchedRef.current = true;
    themeRef.current = next;
    setThemeState(next);
    paint(next, customRef.current);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    void patchMe({ theme: next }).then((r) => { if (!r.ok) console.warn("[theme] gagal simpan ke DB:", r.error); });
  }, [paint, patchMe]);

  const toggleTheme = useCallback(() => {
    setTheme(themeRef.current === "dark" ? "light" : "dark");
  }, [setTheme]);

  const previewCustom = useCallback((next: CustomTheme | null) => {
    applyCustomTheme(themeRef.current, next ?? customRef.current);
  }, []);

  const saveCustom = useCallback(async (next: CustomTheme | null) => {
    const clean = sanitizeCustomTheme(next);
    const r = await patchMe({ themeCustom: clean });
    if (r.ok) {
      customRef.current = clean;
      setCustom(clean);
      writeCachedCustom(clean);
      applyCustomTheme(themeRef.current, clean);
    }
    return r;
  }, [patchMe]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, custom, previewCustom, saveCustom }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
