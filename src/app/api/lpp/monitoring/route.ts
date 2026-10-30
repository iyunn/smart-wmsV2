import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { listLPP } from "@/server/modules/upload/lpp";

// GET /api/lpp/monitoring — semua baris LPP.
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ items: await listLPP() });
  } catch (err) {
    return serverError("lpp/monitoring", err);
  }
}
