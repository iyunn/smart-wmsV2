import "server-only";
import { getSessionToken } from "./cookies";
import { type SessionUser, validateSession } from "./session";

// Pemeriksaan sesi SEBENARNYA (ARCHITECTURE D-06). proxy.ts hanya mengecek ada/tidaknya
// cookie; setiap Route Handler yang menyentuh data wajib memanggil requireUser() /
// requireSuperAdmin() sebelum membaca/menulis apa pun.
//
//   const user = await requireUser();
//   if (user instanceof Response) return user;

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return (await validateSession(token))?.user ?? null;
}

export async function requireUser(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  return user ?? Response.json({ error: "Sesi berakhir. Silakan login lagi." }, { status: 401 });
}

export async function requireSuperAdmin(): Promise<SessionUser | Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return user.role === "super_admin"
    ? user
    : Response.json({ error: "Hanya Super Admin yang boleh melakukan ini." }, { status: 403 });
}
