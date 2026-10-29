import { z } from "zod";
import { db } from "@/server/db";
import { clearSessionCookie, getSessionToken, setSessionCookie } from "@/server/auth/cookies";
import { requireUser } from "@/server/auth/guard";
import { validateSession } from "@/server/auth/session";

// GET   /api/me — data akun yang sedang login (dipakai SessionContext di setiap halaman).
//                 Sekaligus memperpanjang cookie mengikuti sliding expiry sesi.
// PATCH /api/me — { theme: "dark" | "light" } simpan preferensi tema ke akun.

export async function GET() {
  const token = await getSessionToken();
  const session = token ? await validateSession(token) : null;
  if (!session) {
    // Cookie basi/palsu dihapus supaya proxy tidak terus menganggap user sudah login.
    if (token) await clearSessionCookie();
    return Response.json({ error: "Belum login." }, { status: 401 });
  }
  await setSessionCookie(token!, session.expiresAt);

  const u = session.user;
  return Response.json({
    user: { id: u.id, email: u.email },
    // Bentuk `profile` sama dengan tabel profiles V1 → komponen lama tidak perlu diubah.
    profile: {
      id: u.id,
      username: u.username,
      nik: u.nik,
      email: u.email,
      role: u.role,
      status: u.status,
      theme: u.theme,
      mustChangePassword: u.mustChangePassword,
    },
  });
}

const Patch = z.object({ theme: z.enum(["dark", "light"]) });

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Tema tidak valid." }, { status: 400 });

  await db
    .updateTable("app_users")
    .set({ theme: parsed.data.theme, updated_at: new Date() })
    .where("id", "=", user.id)
    .execute();
  return Response.json({ ok: true });
}
