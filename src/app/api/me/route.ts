import { z } from "zod";
import { db } from "@/server/db";
import { clearSessionCookie, getSessionToken, setSessionCookie } from "@/server/auth/cookies";
import { requireUser } from "@/server/auth/guard";
import { validateSession } from "@/server/auth/session";
import { type CustomTheme, sanitizeCustomTheme } from "@/lib/theme/custom";

// GET   /api/me — data akun yang sedang login (dipakai SessionContext di setiap halaman).
//                 Sekaligus memperpanjang cookie mengikuti sliding expiry sesi.
// PATCH /api/me — { theme?: "dark" | "light", themeCustom?: {light?, dark?} | null }
//                 simpan preferensi tema & warna custom (PRD D10) ke akun.

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
      themeCustom: u.themeCustom,
      mustChangePassword: u.mustChangePassword,
    },
  });
}

const HexMap = z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format #RRGGBB"));
const Patch = z
  .object({
    theme: z.enum(["dark", "light"]).optional(),
    themeCustom: z.object({ light: HexMap.optional(), dark: HexMap.optional() }).strict().nullable().optional(),
  })
  .strict()
  .refine((b) => b.theme !== undefined || b.themeCustom !== undefined, { message: "Tidak ada yang diubah." });

export async function PATCH(req: Request) {
  const user = await requireUser({ allowMustChange: true });
  if (user instanceof Response) return user;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const error = issue?.code === "unrecognized_keys" ? "Data tema tidak dikenal." : (issue?.message ?? "Tema tidak valid.");
    return Response.json({ error }, { status: 400 });
  }

  const set: { updated_at: Date; theme?: "dark" | "light"; theme_custom?: string | null } = { updated_at: new Date() };
  if (parsed.data.theme) set.theme = parsed.data.theme;
  let themeCustom: CustomTheme | null | undefined;
  if (parsed.data.themeCustom !== undefined) {
    // Kunci yang tidak dikenal dibuang; hasil kosong = kembali ke tema bawaan
    themeCustom = sanitizeCustomTheme(parsed.data.themeCustom);
    set.theme_custom = themeCustom ? JSON.stringify(themeCustom) : null;
  }

  await db.updateTable("app_users").set(set).where("id", "=", user.id).execute();
  return Response.json({ ok: true, ...(themeCustom !== undefined ? { themeCustom } : {}) });
}
