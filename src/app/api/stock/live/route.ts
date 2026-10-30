import { requireUser } from "@/server/auth/guard";
import { getLiveStock } from "@/server/modules/reports/stock-live";

export type { JenisStock, LiveStockResponse, MerkCount, SubCoceCount } from "@/server/modules/reports/stock-live";

// GET /api/stock/live — stock per jenis (CGA1 + CGA2).
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json(await getLiveStock());
  } catch (err) {
    console.error("[stock/live]", err);
    return Response.json(
      { success: false, jenisList: [], totalStock: 0, totalCGA1: 0, totalCGA2: 0, updatedAt: null, error: err instanceof Error ? err.message : "Error" },
      { status: 500 },
    );
  }
}
