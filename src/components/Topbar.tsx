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
    <header className="glass-bar h-16 flex items-center justify-between px-6 border-b border-line sticky top-0 z-20">
      {/* Title */}
      <div>
        <h1 className="text-heading text-[16px] font-bold tracking-tight leading-none">{title}</h1>
        <p className="text-muted text-[12px] mt-1 leading-none">
          {dateStr || "\u00A0"}
        </p>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Toggle theme (kiri dari user) */}
        <ThemeToggle collapsed />
        {/* Pengaturan tema (warna custom) */}
        <Link href="/pengaturan/tema" title="Atur warna tampilan" aria-label="Atur warna tampilan"
          className="p-2 rounded-lg text-muted hover:text-heading hover:bg-brand-50/60 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
        </Link>
        {/* Ganti password */}
        <Link href="/ganti-password" title="Ganti password" aria-label="Ganti password"
          className="p-2 rounded-lg text-muted hover:text-heading hover:bg-brand-50/60 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8" /><path d="m17 6 3 3" /><path d="m14.5 8.5 2 2" />
          </svg>
        </Link>
        {/* Nama user + role + logout */}
        <div className="flex items-center gap-2 pl-1 cursor-pointer group" onClick={signOut} title="Klik untuk logout">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand-500 to-brand-700 flex items-center justify-center text-[13px] font-bold text-white shadow-md shadow-brand-500/25">
            {profile?.username?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="hidden md:block">
            <p className="text-heading text-[13px] font-semibold leading-none">{profile?.username ?? "Admin"}</p>
            <p className="text-muted text-[12px] mt-1 leading-none">
              {profile?.role === "super_admin" ? "Super Admin" : "Admin"}
            </p>
          </div>
          {/* Ikon logout */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted group-hover:text-danger transition-colors ml-1">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>
      </div>
    </header>
  );
}
