import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { CACHE, cached, invalidate } from "@/server/modules/assets/cache";
import { distinctCleanValues } from "@/server/modules/assets/queries";

// GET    /api/sj/master/merk — daftar merk unik dari hasil klasifikasi (cache 5 menit)
// DELETE /api/sj/master/merk — invalidasi cache
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { value, hit } = await cached(CACHE.masterMerk, () => distinctCleanValues("merk"));
    return Response.json({ merk: value, cached: hit });
  } catch (err) {
    return serverError("sj/master/merk", err);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  invalidate(CACHE.masterMerk);
  return Response.json({ success: true, message: "Merk cache invalidated" });
}
