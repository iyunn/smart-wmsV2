import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { type ReviewSort, listReviewAssets } from "@/server/modules/assets/queries";

// GET /api/review/assets?sort=original_description|jenis|merk|confidence_score&dir=asc|desc
// → { rows, total } — aset Unknown untuk halaman Review (V1: browser langsung ke Supabase).
const SORTS = new Set<ReviewSort>(["original_description", "jenis", "merk", "confidence_score"]);

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const sp = new URL(req.url).searchParams;
  const sort = (SORTS.has(sp.get("sort") as ReviewSort) ? sp.get("sort") : "original_description") as ReviewSort;
  const dir = sp.get("dir") === "desc" ? "desc" : "asc";
  try {
    return Response.json(await listReviewAssets(sort, dir));
  } catch (err) {
    return serverError("review/assets", err);
  }
}
