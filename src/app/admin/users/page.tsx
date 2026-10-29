"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useSession } from "@/components/SessionContext";

interface Profile {
  id: string;
  username: string;
  nik: string;
  email: string;
  role: "super_admin" | "admin";
  status: "pending" | "active" | "rejected";
  created_at: string;
  last_login_at: string | null;
  must_change_password: boolean;
  locked: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  pending:  "bg-warning/10 text-warning border-warning/20",
  active:   "bg-success/10 text-success border-success/20",
  rejected: "bg-danger/10 text-danger border-danger/20",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu", active: "Aktif", rejected: "Ditolak",
};

// ── Modal Tambah User ─────────────────────────────────────────────────────
function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ username: "", nik: "", email: "", password: "", role: "admin" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.username || !form.nik || !form.email || !form.password) {
      setError("Semua field wajib diisi."); return;
    }
    if (form.password.length < 8) { setError("Password minimal 8 karakter."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal membuat user."); return; }
      onSuccess();
      onClose();
    } catch { setError("Terjadi kesalahan."); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h3 className="text-sub font-semibold text-heading mb-1">Tambah User Baru</h3>
        <p className="text-small text-dim mb-4">User langsung aktif dan wajib mengganti password ini saat login pertama</p>

        {error && (
          <div className="text-small text-danger bg-danger/[0.06] border border-danger/20 rounded-xl px-3 py-2.5 mb-4">{error}</div>
        )}

        <div className="space-y-3">
          {([
            { key: "username", label: "Username",  type: "text",     placeholder: "nama_pengguna" },
            { key: "nik",      label: "NIK",       type: "text",     placeholder: "1234567890123456" },
            { key: "email",    label: "Email",     type: "email",    placeholder: "nama@perusahaan.com" },
            { key: "password", label: "Password",  type: "password", placeholder: "Min. 8 karakter" },
          ] as const).map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-small font-medium text-muted mb-1">{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder}
                className="w-full bg-field border border-line text-body text-base2 placeholder:text-dim rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50 transition-all" />
            </div>
          ))}
          <div>
            <label className="block text-small font-medium text-muted mb-1">Role</label>
            <select value={form.role} onChange={set("role")}
              className="w-full bg-field border border-line text-body text-base2 rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50 transition-all">
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-line bg-field text-muted text-base2 hover:bg-field transition-all">
            Batal
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-heading text-base2 font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all disabled:opacity-50">
            {loading ? "Menyimpan..." : "Buat User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Konfirmasi Hapus ────────────────────────────────────────────────
function DeleteModal({ user, onClose, onSuccess }: { user: Profile; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal hapus."); return; }
      onSuccess();
      onClose();
    } catch { setError("Terjadi kesalahan."); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-6">
        <h3 className="text-sub font-semibold text-heading mb-2">Hapus User?</h3>
        <p className="text-base2 text-muted mb-1">
          <span className="text-heading font-medium">{user.username}</span> ({user.email})
        </p>
        <p className="text-small text-danger/80 mb-5">⚠ User akan dihapus permanen dari sistem.</p>
        {error && <p className="text-small text-danger mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-line bg-field text-muted text-base2 hover:bg-field transition-all">
            Batal
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-danger/20 border border-danger/30 text-danger text-base2 font-semibold hover:bg-danger/30 transition-all disabled:opacity-50">
            {loading ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Reset Password ──────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onSuccess }: { user: Profile; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Gagal reset password."); return; }
      setTempPassword(data.password);
      onSuccess();
    } catch { setError("Terjadi kesalahan."); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(tempPassword); setCopied(true); } catch { /* clipboard diblokir: salin manual */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h3 className="text-sub font-semibold text-heading mb-2">Reset Password</h3>
        <p className="text-base2 text-muted mb-3">
          <span className="text-heading font-medium">{user.username}</span> ({user.email})
        </p>

        {tempPassword ? (
          <>
            <p className="text-small text-muted mb-2">Password sementara (hanya tampil sekali — berikan langsung ke user):</p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-center font-mono text-lead tracking-wider text-heading bg-field border border-line rounded-lg px-3 py-2 select-all">
                {tempPassword}
              </code>
              <button onClick={copy} className="px-3 py-2 rounded-lg text-small font-medium border border-line bg-field text-muted hover:text-heading transition-all">
                {copied ? "Tersalin" : "Salin"}
              </button>
            </div>
            <p className="text-small text-dim mb-5">User wajib mengganti password saat login. Semua sesi lamanya sudah dikeluarkan dan kunci percobaan login dibuka.</p>
            <button onClick={onClose} className="w-full px-4 py-2 rounded-xl border border-line bg-field text-muted text-base2 hover:text-heading transition-all">
              Tutup
            </button>
          </>
        ) : (
          <>
            <p className="text-small text-muted mb-5">Password lama tidak bisa dipakai lagi. Sistem membuat password sementara dan user wajib menggantinya saat login.</p>
            {error && <p className="text-small text-danger mb-3">{error}</p>}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-line bg-field text-muted text-base2 hover:bg-field transition-all">
                Batal
              </button>
              <button onClick={handleReset} disabled={loading}
                className="flex-1 px-4 py-2 rounded-xl bg-warning/15 border border-warning/30 text-warning text-base2 font-semibold hover:bg-warning/25 transition-all disabled:opacity-50">
                {loading ? "Mereset..." : "Reset password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const router = useRouter();
  const { profile: myProfile, isSuperAdmin, loading: sessionLoading } = useSession();

  const [users, setUsers]         = useState<Profile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [actionId, setActionId]   = useState<string | null>(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [resetTarget, setResetTarget]   = useState<Profile | null>(null);
  const [pageError, setPageError]       = useState("");

  useEffect(() => {
    if (!sessionLoading && !isSuperAdmin) router.push("/");
  }, [sessionLoading, isSuperAdmin, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setPageError(json.error ?? "Gagal memuat daftar user.");
    setUsers(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const updateUser = useCallback(async (id: string, patch: Partial<Pick<Profile, "status" | "role">>) => {
    setActionId(id);
    setPageError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPageError(data.error ?? "Gagal menyimpan perubahan.");
      }
    } catch {
      setPageError("Tidak bisa terhubung ke server.");
    }
    await fetchUsers();
    setActionId(null);
  }, [fetchUsers]);

  const pending = users.filter(u => u.status === "pending");
  const others  = users.filter(u => u.status !== "pending");

  if (sessionLoading || !isSuperAdmin) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-heading">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Manajemen User" />
        <main className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-heading">Manajemen User</h1>
              <p className="mt-0.5 text-xs text-dim">Kelola pendaftaran dan akses user SmartWMS</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-heading text-base2 font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Tambah User
            </button>
          </div>

          {pageError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-danger/20 bg-danger/[0.06] px-4 py-3">
              <p className="text-small text-danger">{pageError}</p>
              <button onClick={() => setPageError("")} className="text-small text-danger/70 hover:text-danger" aria-label="Tutup pesan">✕</button>
            </div>
          )}

          {/* Pending approval */}
          {pending.length > 0 && (
            <div>
              <h2 className="text-base2 font-semibold uppercase tracking-widest text-warning/70 mb-3">
                Menunggu Persetujuan ({pending.length})
              </h2>
              <div className="rounded-2xl border border-warning/10 bg-warning/[0.02] overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_120px_180px] gap-3 px-5 py-3 border-b border-line text-tiny font-semibold uppercase tracking-widest text-dim">
                  <span>User</span><span>NIK</span><span>Role</span><span className="text-right">Aksi</span>
                </div>
                {pending.map(u => (
                  <div key={u.id} className="grid grid-cols-[1fr_120px_120px_180px] gap-3 items-center px-5 py-3 border-b border-line last:border-0">
                    <div>
                      <p className="text-base2 font-medium text-heading">{u.username}</p>
                      <p className="text-tiny text-dim">{u.email}</p>
                    </div>
                    <span className="text-small text-muted font-mono">{u.nik}</span>
                    <span className="text-small text-muted">Admin</span>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => updateUser(u.id, { status: "active" })} disabled={actionId === u.id}
                        className="px-3 py-1.5 rounded-lg text-small font-semibold bg-success/10 border border-success/20 text-success hover:bg-success/20 transition-all disabled:opacity-50">
                        {actionId === u.id ? "..." : "✓ Setujui"}
                      </button>
                      <button onClick={() => updateUser(u.id, { status: "rejected" })} disabled={actionId === u.id}
                        className="px-3 py-1.5 rounded-lg text-small font-semibold bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all disabled:opacity-50">
                        Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Semua user */}
          <div>
            <h2 className="text-base2 font-semibold uppercase tracking-widest text-dim mb-3">
              Semua User ({users.length})
            </h2>
            <div className="rounded-2xl border border-line bg-surface overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_110px_100px_220px] gap-3 px-5 py-3 border-b border-line text-tiny font-semibold uppercase tracking-widest text-dim">
                <span>User</span><span>NIK</span><span>Role</span><span>Status</span><span className="text-right">Aksi</span>
              </div>
              {loading ? (
                <div className="px-5 py-8 text-center text-base2 text-dim">Memuat...</div>
              ) : users.length === 0 ? (
                <div className="px-5 py-8 text-center text-base2 text-dim">Belum ada user</div>
              ) : users.map(u => {
                const isMe = u.id === myProfile?.id;
                return (
                  <div key={u.id} className="grid grid-cols-[1fr_120px_110px_100px_220px] gap-3 items-center px-5 py-3 border-b border-line last:border-0 hover:bg-panel">
                    <div>
                      <p className="text-base2 font-medium text-heading">
                        {u.username} {isMe && <span className="text-tiny text-accent ml-1">(Anda)</span>}
                      </p>
                      <p className="text-tiny text-dim">{u.email}</p>
                      {(u.locked || u.must_change_password) && (
                        <p className="mt-0.5 flex flex-wrap gap-1">
                          {u.locked && <span className="text-nano font-semibold text-danger bg-danger/10 border border-danger/20 rounded px-1.5 py-px">Terkunci sementara</span>}
                          {u.must_change_password && <span className="text-nano font-semibold text-warning bg-warning/10 border border-warning/20 rounded px-1.5 py-px">Wajib ganti password</span>}
                        </p>
                      )}
                    </div>
                    <span className="text-small text-muted font-mono">{u.nik}</span>
                    <span className="text-small text-muted">{u.role === "super_admin" ? "Super Admin" : "Admin"}</span>
                    <span className={`inline-flex w-fit items-center text-tiny font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${STATUS_BADGE[u.status]}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                    <div className="flex items-center justify-end gap-1.5">
                      {!isMe && u.status === "active" && u.role !== "super_admin" && (
                        <button onClick={() => updateUser(u.id, { role: "super_admin" })} disabled={actionId === u.id}
                          className="px-2.5 py-1 rounded-lg text-tiny font-medium bg-info/10 border border-info/20 text-info hover:bg-info/20 transition-all disabled:opacity-50">
                          → Super Admin
                        </button>
                      )}
                      {!isMe && u.role === "super_admin" && (
                        <button onClick={() => updateUser(u.id, { role: "admin" })} disabled={actionId === u.id}
                          className="px-2.5 py-1 rounded-lg text-tiny font-medium bg-field border border-line text-muted hover:bg-field transition-all disabled:opacity-50">
                          → Admin
                        </button>
                      )}
                      {!isMe && u.status === "active" && (
                        <button onClick={() => updateUser(u.id, { status: "rejected" })} disabled={actionId === u.id}
                          className="px-2.5 py-1 rounded-lg text-tiny font-medium bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 transition-all disabled:opacity-50">
                          Nonaktifkan
                        </button>
                      )}
                      {!isMe && u.status !== "active" && (
                        <button onClick={() => updateUser(u.id, { status: "active" })} disabled={actionId === u.id}
                          className="px-2.5 py-1 rounded-lg text-tiny font-medium bg-success/10 border border-success/20 text-success hover:bg-success/20 transition-all disabled:opacity-50">
                          Aktifkan
                        </button>
                      )}
                      {!isMe && (
                        <button onClick={() => setResetTarget(u)} disabled={actionId === u.id}
                          className="p-1.5 rounded-lg text-warning/60 hover:text-warning hover:bg-warning/10 transition-all disabled:opacity-50"
                          title="Reset password" aria-label={`Reset password ${u.username}`}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8" /><path d="m17 6 3 3" /><path d="m14.5 8.5 2 2" />
                          </svg>
                        </button>
                      )}
                      {!isMe && (
                        <button onClick={() => setDeleteTarget(u)} disabled={actionId === u.id}
                          className="p-1.5 rounded-lg text-danger/50 hover:text-danger hover:bg-danger/10 transition-all disabled:opacity-50" title="Hapus user">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                      {isMe && <span className="text-tiny text-dim italic">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </main>
      </div>

      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onSuccess={fetchUsers} />
      )}
      {deleteTarget && (
        <DeleteModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={fetchUsers} />
      )}
      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onSuccess={fetchUsers} />
      )}
    </div>
  );
}
