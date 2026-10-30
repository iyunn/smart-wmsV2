import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { CACHE, cached, invalidate } from "@/server/modules/assets/cache";
import { distinctCleanValues } from "@/server/modules/assets/queries";

// GET    /api/sj/master/jenis — daftar jenis unik dari hasil klasifikasi (cache 5 menit)
// DELETE /api/sj/master/jenis — invalidasi cache
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { value, hit } = await cached(CACHE.masterJenis, () => distinctCleanValues("jenis"));
    return Response.json({ jenis: value, cached: hit });
  } catch (err) {
    return serverError("sj/master/jenis", err);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  invalidate(CACHE.masterJenis);
  return Response.json({ success: true, message: "Jenis cache invalidated" });
}
