import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guard";
import { UserError, resetPassword } from "@/server/modules/users/service";

// POST /api/admin/users/reset-password { id } → { password } (password sementara, tampil SEKALI).
// User wajib mengganti saat login berikutnya; semua sesinya dicabut; kunci percobaan dibuka.

const Body = z.object({ id: z.uuid() });

export async function POST(req: Request) {
  const me = await requireSuperAdmin();
  if (me instanceof Response) return me;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data tidak valid." }, { status: 400 });
  try {
    const password = await resetPassword(me.id, parsed.data.id);
    return Response.json({ password }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
