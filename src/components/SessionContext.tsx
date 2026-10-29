"use client";

/**
 * SessionContext — expose user + profile (username, role) ke semua komponen.
 * Wrap di layout.tsx agar tersedia di seluruh app.
 *
 * V2 (Tahap 3b): sumber data GET /api/me (auth lokal, cookie httpOnly), bukan Supabase.
 * Bentuk nilai context SAMA dengan V1 (user, profile, loading, signOut, isSuperAdmin,
 * isAdmin) sehingga Topbar, Sidebar, Daftar SJ, dan Manajemen User tidak perlu diubah.
 */

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from "react";

export interface UserProfile {
  id: string;
  username: string;
  nik: string;
  email: string;
  role: "super_admin" | "admin";
  status: "pending" | "active" | "rejected";
  theme?: "dark" | "light";
  mustChangePassword?: boolean;
}

/** Pengganti tipe `User` Supabase — hanya field yang dipakai aplikasi. */
export interface SessionUser {
  id: string;
  email: string;
}

interface SessionContextValue {
  user:    SessionUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Ambil ulang data akun (mis. setelah profil diubah). */
  refresh: () => Promise<void>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

const SessionContext = createContext<SessionContextValue>({
  user: null, profile: null, loading: true,
  signOut: async () => {}, refresh: async () => {},
  isSuperAdmin: false, isAdmin: false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        setProfile(null);
        return;
      }
      const data = (await res.json()) as { user: SessionUser; profile: UserProfile };
      setUser(data.user);
      setProfile(data.profile);
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setProfile(null);
      window.location.href = "/login";
    }
  }, []);

  const isSuperAdmin = profile?.role === "super_admin" && profile?.status === "active";
  const isAdmin      = (profile?.role === "admin" || isSuperAdmin) && profile?.status === "active";

  return (
    <SessionContext.Provider value={{ user, profile, loading, signOut, refresh, isSuperAdmin, isAdmin }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
