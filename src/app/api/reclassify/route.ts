import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { reclassify } from "@/server/modules/classification/reclassify";

// POST /api/reclassify — { revert_merk?, revert_jenis? } klasifikasi ulang aset Unknown / revert.
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const body = await readJson<{ revert_merk?: string; revert_jenis?: string }>(req);
    return Response.json(await reclassify({ revertMerk: body.revert_merk, revertJenis: body.revert_jenis }));
  } catch (err) {
    return serverError("reclassify", err, { success: false });
  }
}
