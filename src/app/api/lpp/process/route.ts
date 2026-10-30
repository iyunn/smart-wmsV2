import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { type LPPRow, insertLPPBatch } from "@/server/modules/upload/lpp";

// POST /api/lpp/process — { data: LPPRow[], isLastBatch? } satu batch upload LPP.
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { data, isLastBatch } = await readJson<{ data?: LPPRow[]; isLastBatch?: boolean }>(req);
    if (!Array.isArray(data) || data.length === 0) {
      return Response.json({ success: false, error: "Data batch kosong" }, { status: 400 });
    }
    const inserted = await insertLPPBatch(data);
    return Response.json({ success: true, inserted, isLastBatch: !!isLastBatch });
  } catch (err) {
    return serverError("lpp/process", err, { success: false });
  }
}
