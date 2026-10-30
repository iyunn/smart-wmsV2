import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { runReconciliation } from "@/server/modules/reports/reconciliation";

// GET /api/reconciliation — DAT vs LPP per kode_asset (5 kondisi).
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json(await runReconciliation());
  } catch (err) {
    return serverError("reconciliation", err);
  }
}
