"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "", nik: "", email: "", password: "", confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleRegister = useCallback(async () => {
    setError("");
    const { username, nik, email, password, confirm } = form;

    if (!username || !nik || !email || !password || !confirm) {
      setError("Semua field wajib diisi."); return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter."); return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok."); return;
    }

    setLoading(true);
    try {
      // Akun dibuat berstatus pending — wajib di-approve Super Admin (sama dengan V1).
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), nik: nik.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Pendaftaran gagal. Coba lagi.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa jaringan lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080e18] px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Pendaftaran Berhasil!</h2>
          <p className="text-[12px] text-white/50 leading-relaxed mb-6">
            Akun Anda sedang menunggu persetujuan Super Admin.<br/>
            Anda akan dihubungi setelah akun diaktifkan.
          </p>
          <Link href="/login"
            className="inline-block px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[13px] font-semibold">
            Kembali ke Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080e18] px-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-white">SmartWMS</h1>
          <p className="text-[11px] text-white/40 mt-0.5">Smart Asset Monitoring & Reconciliation</p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-6">
          <h2 className="text-[15px] font-semibold text-white mb-1">Daftar Akun Baru</h2>
          <p className="text-[11px] text-white/40 mb-5">Akun perlu disetujui Super Admin sebelum bisa digunakan</p>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2.5 mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400 shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[11px] text-rose-300">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {([
              { key: "username", label: "Username",         type: "text",     placeholder: "nama_pengguna" },
              { key: "nik",      label: "NIK",              type: "text",     placeholder: "1234567890123456" },
              { key: "email",    label: "Email",            type: "email",    placeholder: "nama@perusahaan.com" },
              { key: "password", label: "Password",         type: "password", placeholder: "Min. 8 karakter" },
              { key: "confirm",  label: "Konfirmasi Password", type: "password", placeholder: "Ulangi password" },
            ] as const).map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-[11px] font-medium text-white/50 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  onKeyDown={e => e.key === "Enter" && handleRegister()}
                  placeholder={placeholder}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white/80 text-[13px] placeholder:text-slate-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>
            ))}

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[13px] font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                  </svg>
                  Mendaftar...
                </>
              ) : "Daftar Sekarang"}
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-white/[0.06] text-center">
            <p className="text-[12px] text-white/40">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-white/20 mt-5">
          PT. Indomarco Prismatama — General Affairs
        </p>
      </div>
    </div>
  );
}
