import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { invalidateClassificationCaches, ruleValues } from "@/server/modules/classification/rules";

// GET    /api/keyword-rules/values?type=jenis|merk — nilai unik untuk saran input (cache 5 menit)
// DELETE /api/keyword-rules/values                  — invalidasi cache (dipanggil client V1)
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const ruleType = new URL(req.url).searchParams.get("type");
  if (ruleType !== "jenis" && ruleType !== "merk") {
    return Response.json({ error: "Query param 'type' wajib (jenis atau merk)" }, { status: 400 });
  }
  try {
    const { value, hit } = await ruleValues(ruleType);
    return Response.json({ values: value, source: hit ? "cache" : "db" });
  } catch (err) {
    return serverError("keyword-rules/values", err);
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  invalidateClassificationCaches();
  return Response.json({ success: true, message: "Cache invalidated" });
}
