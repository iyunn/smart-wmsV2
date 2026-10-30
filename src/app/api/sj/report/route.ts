import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { ReportError, listReportItems, patchAllocation, type AllocationPatch } from "@/server/modules/sj/report";

// GET   /api/sj/report → { items, total } — 1 baris per item SJ (Rekap Alokasi & export Excel)
// PATCH /api/sj/report { item_id, kode_asset?, mutasi_oracle_status?, mutasi_wt_status? }
//       → { success, tagged } | 409 { error, locked: true } bila item sudah terkunci
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const items = await listReportItems();
    return Response.json({ items, total: items.length });
  } catch (err) {
    return serverError("sj/report GET", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const b = await readJson<Partial<AllocationPatch>>(req);
  if (!b.item_id) return Response.json({ error: "item_id wajib" }, { status: 400 });
  try {
    return Response.json(
      await patchAllocation({
        item_id: b.item_id,
        kode_asset: b.kode_asset,
        mutasi_oracle_status: b.mutasi_oracle_status,
        mutasi_wt_status: b.mutasi_wt_status,
      }),
    );
  } catch (err) {
    if (err instanceof ReportError) {
      return Response.json({ error: err.message, ...err.extra }, { status: err.status });
    }
    return serverError("sj/report PATCH", err);
  }
}
