"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionContext";
import ThemeToggle from "@/components/ThemeToggle";

export default function Topbar({ title }: { title: string }) {
  const [dateStr, setDateStr] = useState("");
  const { profile, signOut } = useSession();

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    );
  }, []);

  // Sinkronkan judul tab browser dengan halaman aktif.
  // Semua halaman ber-Topbar mengirim prop `title`, jadi cukup di-set dari sini —
  // tidak perlu metadata per halaman (semua halaman client component).
  // Cleanup: saat pindah ke halaman tanpa Topbar (login/register/reset password),
  // judul dikembalikan ke default agar tidak menyangkut judul halaman sebelumnya.
  useEffect(() => {
    if (title) document.title = `${title} — SmartWMS`;
    return () => { document.title = "SmartWMS — Smart Asset Monitoring & Reconciliation"; };
  }, [title]);

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b sticky top-0 z-20 backdrop-blur-md" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Title */}
      <div>
        <h1 className="text-white text-[16px] font-semibold tracking-tight leading-none">{title}</h1>
        <p className="text-slate-500 text-[10px] mt-0.5">
          {dateStr || "\u00A0"}
        </p>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Toggle theme (kiri dari user) */}
        <ThemeToggle collapsed />
        {/* Ganti password */}
        <Link href="/ganti-password" title="Ganti password" aria-label="Ganti password"
          className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8" /><path d="m17 6 3 3" /><path d="m14.5 8.5 2 2" />
          </svg>
        </Link>
        {/* Nama user + role + logout */}
        <div className="flex items-center gap-2 pl-1 cursor-pointer group" onClick={signOut} title="Klik untuk logout">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-[13px] font-bold shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
            {profile?.username?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="hidden md:block">
            <p className="text-white text-[12px] font-medium leading-none">{profile?.username ?? "Admin"}</p>
            <p className="text-slate-500 text-[10px] mt-0.5">
              {profile?.role === "super_admin" ? "Super Admin" : "Admin"}
            </p>
          </div>
          {/* Ikon logout */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover:text-white transition-colors ml-1">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
      </div>
    </header>
  );
}
