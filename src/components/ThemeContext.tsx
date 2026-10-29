"use client";

/**
 * ThemeContext — kelola tema dark/light untuk seluruh app.
 *
 * Sumber kebenaran: kolom `theme` di app_users (ikut akun user), disimpan lewat PATCH /api/me.
 * Cache: localStorage 'swms-theme' untuk apply instan tanpa flash (FOUC)
 * sebelum profile ke-fetch dari DB.
 *
 * Cara pakai:
 *   - Wrap app dengan <ThemeProvider> di layout (di dalam SessionProvider).
 *   - Komponen pakai useTheme() untuk baca theme + toggle.
 *   - Tema diterapkan sebagai class 'dark'/'light' di <html>.
 *
 * Styling: pakai CSS variable yang di-scope ke .dark / .light (lihat globals.css).
 */

import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
  type ReactNode,
} from "react";
import { useSession } from "@/components/SessionContext";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = "swms-theme";

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useSession();
  const [theme, setThemeState] = useState<Theme>("dark");
  const dbSyncedRef = useRef(false);
  const userTouchedRef = useRef(false);

  // 1. Apply cache localStorage secepatnya (anti-flash) saat mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (cached === "dark" || cached === "light") {
        setThemeState(cached);
        applyThemeClass(cached);
      } else {
        applyThemeClass("dark");
      }
    } catch {
      applyThemeClass("dark");
    }
  }, []);

  // 2. Sync dari DB HANYA SEKALI saat profile pertama load, dan HANYA jika user
  //    belum toggle manual di sesi ini. localStorage tetap prioritas untuk
  //    pilihan terbaru (mencegah profile load menimpa pilihan yang baru dibuat).
  useEffect(() => {
    if (dbSyncedRef.current || userTouchedRef.current) return;
    const dbTheme = (profile as { theme?: Theme } | null)?.theme;
    if (dbTheme === "dark" || dbTheme === "light") {
      dbSyncedRef.current = true;
      // Kalau localStorage sudah ada nilainya, hormati itu (lebih baru dari DB
      // dalam kasus user baru toggle sebelum profile load). Kalau belum ada,
      // pakai nilai DB.
      let cached: string | null = null;
      try { cached = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
      if (cached !== "dark" && cached !== "light") {
        setThemeState(dbTheme);
        applyThemeClass(dbTheme);
        try { localStorage.setItem(STORAGE_KEY, dbTheme); } catch { /* ignore */ }
      }
    }
  }, [profile]);

  const persistTheme = useCallback(async (next: Theme) => {
    // Cache instan (sumber kebenaran utama)
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    // Simpan ke DB (ikut akun antar-device) — best-effort
    if (user?.id) {
      try {
        const res = await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: next }),
        });
        if (!res.ok) console.warn("[theme] gagal simpan ke DB:", res.status);
      } catch (err) {
        console.warn("[theme] gagal simpan ke DB:", err);
      }
    }
  }, [user]);

  const setTheme = useCallback((next: Theme) => {
    userTouchedRef.current = true;
    setThemeState(next);
    applyThemeClass(next);
    void persistTheme(next);
  }, [persistTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
