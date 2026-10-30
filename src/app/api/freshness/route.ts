import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { getFreshness } from "@/server/modules/assets/queries";

// GET /api/freshness — waktu upload terakhir DAT & LPP (indikator di Sidebar, setiap halaman).
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json(await getFreshness());
  } catch (err) {
    return serverError("freshness", err);
  }
}
