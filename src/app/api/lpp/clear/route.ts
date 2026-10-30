import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { clearLPP } from "@/server/modules/upload/lpp";

// POST /api/lpp/clear — kosongkan lpp_raw sebelum batch pertama upload LPP (full replace).
export async function POST() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    await clearLPP();
    return Response.json({ success: true });
  } catch (err) {
    return serverError("lpp/clear", err, { success: false });
  }
}
