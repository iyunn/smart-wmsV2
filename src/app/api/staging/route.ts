import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { countStagingWithKode, deleteStaging, listStaging, syncStagingToNotes, updateStaging } from "@/server/modules/sj/staging";

// /api/staging — staging area barang masuk (lihat modules/sj/staging.ts).
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ data: await listStaging() });
  } catch (err) {
    return serverError("staging", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id, catatan, kode_asset } = await readJson<{ id?: string; catatan?: string | null; kode_asset?: string | null }>(req);
  if (!id) return Response.json({ error: "id wajib diisi" }, { status: 400 });
  try {
    await updateStaging(id, { catatan, kode_asset });
    return Response.json({ success: true });
  } catch (err) {
    return serverError("staging", err);
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { id } = await readJson<{ id?: string }>(req);
  if (!id) return Response.json({ error: "id wajib diisi" }, { status: 400 });
  try {
    await deleteStaging(id);
    return Response.json({ success: true });
  } catch (err) {
    return serverError("staging", err);
  }
}

// POST { action: "sync" } — pindahkan catatan ke Monitoring untuk kode yang sudah ada di DAT/CGA.
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = await readJson<{ action?: string }>(req);
  if (body.action !== "sync") return Response.json({ error: "action tidak valid" }, { status: 400 });
  try {
    const pending = await countStagingWithKode();
    if (pending === 0) {
      return Response.json({ success: true, synced: 0, message: "Tidak ada item untuk disinkronkan." });
    }
    return Response.json({ success: true, synced: await syncStagingToNotes() });
  } catch (err) {
    return serverError("staging", err);
  }
}
