import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { listMonitoringAssets, saveAssetNote } from "@/server/modules/assets/queries";

// GET   /api/monitoring — semua aset DAT + catatan (filter di client)
// PATCH /api/monitoring — { kode_asset, catatan } simpan/hapus catatan
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const assets = await listMonitoringAssets();
    return Response.json({ assets, total: assets.length });
  } catch (err) {
    return serverError("monitoring", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const { kode_asset, catatan } = await readJson<{ kode_asset?: string; catatan?: string }>(req);
    if (!kode_asset) return Response.json({ error: "kode_asset wajib" }, { status: 400 });
    const saved = await saveAssetNote(kode_asset, catatan ?? "");
    return Response.json({ success: true, catatan: saved });
  } catch (err) {
    return serverError("monitoring", err);
  }
}
