"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionContext";

// /ganti-password — ganti password sendiri. Wajib dibuka bila akun dibuat atau di-reset
// Super Admin (SessionContext mengarahkan otomatis ke sini). Tampilan mengikuti halaman login.

export default function GantiPasswordPage() {
  const { profile, loading: sessionLoading, signOut } = useSession();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const forced = profile?.mustChangePassword === true;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = useCallback(async () => {
    setError("");
    if (!form.current || !form.next || !form.confirm) { setError("Semua field wajib diisi."); return; }
    if (form.next.length < 8) { setError("Password baru minimal 8 karakter."); return; }
    if (form.next !== form.confirm) { setError("Konfirmasi password baru tidak cocok."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { window.location.assign("/login"); return; }
      if (!res.ok) { setError(data.error ?? "Gagal mengganti password."); return; }
      setDone(true);
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa jaringan lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[13px] placeholder:text-slate-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500/50 transition-all";

  if (sessionLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080e18] px-4">
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-white tracking-tight">Ganti Password</h1>
          <p className="text-[12px] text-white/40 mt-1">{profile ? `${profile.username} · ${profile.email}` : "SmartWMS"}</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-6">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-[13px] text-emerald-300">Password berhasil diganti. Sesi di perangkat lain sudah dikeluarkan.</p>
              <button onClick={() => window.location.assign("/")}
                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[13px] font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all">
                Lanjut ke Dashboard
              </button>
            </div>
          ) : (
            <>
              {forced && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 mb-4">
                  <p className="text-[11px] text-amber-200 leading-relaxed">
                    Password Anda dibuat atau di-reset oleh Super Admin. Ganti dulu sebelum melanjutkan.
                    Isi &quot;Password sekarang&quot; dengan password dari Super Admin.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2.5 mb-4">
                  <p className="text-[11px] text-rose-300 leading-relaxed">{error}</p>
                </div>
              )}

              <div className="space-y-3">
                {([
                  { key: "current", label: "Password sekarang", auto: "current-password" },
                  { key: "next",    label: "Password baru (min. 8 karakter)", auto: "new-password" },
                  { key: "confirm", label: "Ulangi password baru", auto: "new-password" },
                ] as const).map(({ key, label, auto }) => (
                  <div key={key}>
                    <label className="block text-[11px] font-medium text-white/50 mb-1.5">{label}</label>
                    <input type="password" autoComplete={auto} value={form[key]} onChange={set(key)}
                      onKeyDown={e => e.key === "Enter" && handleSubmit()} className={inputCls} />
                  </div>
                ))}

                <button onClick={handleSubmit} disabled={loading}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[13px] font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50">
                  {loading ? "Menyimpan..." : "Simpan password baru"}
                </button>
              </div>

              <div className="mt-5 pt-5 border-t border-white/[0.06] text-center text-[12px]">
                {forced ? (
                  <button onClick={signOut} className="text-white/40 hover:text-white/70 transition-colors">Keluar</button>
                ) : (
                  <Link href="/" className="text-cyan-400 hover:text-cyan-300 transition-colors">Kembali ke Dashboard</Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
