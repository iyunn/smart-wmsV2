import { z } from "zod";
import { getSessionToken } from "@/server/auth/cookies";
import { requireUser } from "@/server/auth/guard";
import { PasswordSchema, firstIssue } from "@/server/modules/users/schemas";
import { UserError, changeOwnPassword } from "@/server/modules/users/service";

// POST /api/me/password { currentPassword, newPassword } — ganti password sendiri.
// Dipakai juga untuk alur wajib ganti password (akun dibuat/di-reset Super Admin).
// Sesi lain milik user ini dicabut; sesi sekarang tetap.

const Body = z.object({
  currentPassword: z.string().min(1, "Password sekarang wajib diisi."),
  newPassword: PasswordSchema,
});

export async function POST(req: Request) {
  const user = await requireUser({ allowMustChange: true });
  if (user instanceof Response) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    await changeOwnPassword(user.id, parsed.data.currentPassword, parsed.data.newPassword, await getSessionToken());
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
