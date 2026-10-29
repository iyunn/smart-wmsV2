import "server-only";
import { getSessionToken } from "./cookies";
import { type SessionUser, validateSession } from "./session";

// Pemeriksaan sesi SEBENARNYA (ARCHITECTURE D-06). proxy.ts hanya mengecek ada/tidaknya
// cookie; setiap Route Handler yang menyentuh data wajib memanggil requireUser() /
// requireSuperAdmin() sebelum membaca/menulis apa pun.
//
//   const user = await requireUser();
//   if (user instanceof Response) return user;
//
// Akun dengan must_change_password (dibuat/di-reset Super Admin) DITOLAK 403 di semua route
// kecuali yang memanggil requireUser({ allowMustChange: true }) — mis. ganti password & tema.

interface GuardOptions {
  /** Izinkan akun yang wajib ganti password (hanya untuk route ganti password / preferensi). */
  allowMustChange?: boolean;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return (await validateSession(token))?.user ?? null;
}

export async function requireUser(opts: GuardOptions = {}): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sesi berakhir. Silakan login lagi." }, { status: 401 });
  if (user.mustChangePassword && !opts.allowMustChange) {
    return Response.json(
      { error: "Ganti password dulu sebelum melanjutkan.", code: "MUST_CHANGE_PASSWORD" },
      { status: 403 },
    );
  }
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser | Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return user.role === "super_admin"
    ? user
    : Response.json({ error: "Hanya Super Admin yang boleh melakukan ini." }, { status: 403 });
}
