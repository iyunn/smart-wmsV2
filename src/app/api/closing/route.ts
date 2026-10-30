import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { type ClosingStat, listClosing, upsertClosing } from "@/server/modules/upload/lpp";

// GET  /api/closing — data trend DAT closing per bulan per CGA
// POST /api/closing — { bulan: "YYYY-MM", stats: [{ cga, total_items, total_qty, total_nilai, total_tercatat }] }
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ data: await listClosing() });
  } catch (err) {
    return serverError("closing", err);
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { bulan, stats } = await readJson<{ bulan?: string; stats?: ClosingStat[] }>(req);
    if (!bulan || !stats || !Array.isArray(stats) || stats.length === 0) {
      return Response.json({ error: "bulan dan stats wajib diisi" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(bulan)) {
      return Response.json({ error: "Format bulan harus YYYY-MM" }, { status: 400 });
    }
    if (stats.some((s) => !s?.cga)) {
      return Response.json({ error: "Setiap stats wajib punya cga" }, { status: 400 });
    }
    const n = await upsertClosing(bulan, stats);
    return Response.json({ success: true, bulan, cga_count: n });
  } catch (err) {
    return serverError("closing", err);
  }
}
