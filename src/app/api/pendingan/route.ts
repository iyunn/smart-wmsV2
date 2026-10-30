import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { deletePendingan, insertPendingan, listPendingan, updatePendingan } from "@/server/modules/sj/master";

// /api/pendingan — item pendingan alokasi per tujuan.
const VALID_URGENSI = ["tinggi", "sedang", "rendah"];
const VALID_ARAH = ["kirim", "tarik"];

type ItemIn = { jenis?: string; merk?: string; qty?: number; keterangan?: string; urgensi?: string; arah?: string };

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const tujuanId = new URL(req.url).searchParams.get("tujuan_id");
    return Response.json({ items: await listPendingan(tujuanId) });
  } catch (err) {
    return serverError("pendingan", err);
  }
}

// Body: { tujuan_id, items: [...] } (batch) ATAU { tujuan_id, jenis, merk, qty, ... } (single)
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = await readJson<ItemIn & { tujuan_id?: string; items?: ItemIn[] }>(req);
  if (!body.tujuan_id) return Response.json({ error: "tujuan_id wajib diisi" }, { status: 400 });

  const raw: ItemIn[] = Array.isArray(body.items) ? body.items : [body];
  const rows = raw
    .filter((it) => it.jenis && it.jenis.trim())
    .map((it) => ({
      tujuan_id: body.tujuan_id!,
      jenis: it.jenis!.trim(),
      merk: (it.merk ?? "").trim(),
      qty: Math.max(1, Number(it.qty) || 1),
      keterangan: (it.keterangan ?? "").trim(),
      urgensi: VALID_URGENSI.includes(it.urgensi ?? "") ? it.urgensi! : "sedang",
      arah: VALID_ARAH.includes(it.arah ?? "") ? it.arah! : "kirim",
    }));
  if (rows.length === 0) return Response.json({ error: "Minimal satu item dengan jenis valid" }, { status: 400 });
  try {
    return Response.json({ items: await insertPendingan(rows) }, { status: 201 });
  } catch (err) {
    return serverError("pendingan", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = await readJson<ItemIn & { id?: string }>(req);
  if (!body.id) return Response.json({ error: "id wajib diisi" }, { status: 400 });

  const patch: Parameters<typeof updatePendingan>[1] = {};
  if (typeof body.jenis === "string") {
    const jenis = body.jenis.trim();
    if (!jenis) return Response.json({ error: "Jenis tidak boleh kosong" }, { status: 400 });
    patch.jenis = jenis;
  }
  if (typeof body.merk === "string") patch.merk = body.merk.trim();
  if (typeof body.keterangan === "string") patch.keterangan = body.keterangan.trim();
  if (body.qty !== undefined) patch.qty = Math.max(1, Number(body.qty) || 1);
  if (VALID_URGENSI.includes(body.urgensi ?? "")) patch.urgensi = body.urgensi;
  if (VALID_ARAH.includes(body.arah ?? "")) patch.arah = body.arah;
  if (Object.keys(patch).length === 0) return Response.json({ error: "Tidak ada field untuk diupdate" }, { status: 400 });
  try {
    const item = await updatePendingan(body.id, patch);
    if (!item) return Response.json({ error: "Item tidak ditemukan" }, { status: 404 });
    return Response.json({ item });
  } catch (err) {
    return serverError("pendingan", err);
  }
}

// DELETE ?id=… atau body { ids: string[] }
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const idParam = new URL(req.url).searchParams.get("id");
  let ids: string[] = [];
  if (idParam) ids = [idParam];
  else {
    const body = await readJson<{ ids?: unknown }>(req);
    if (Array.isArray(body.ids)) ids = body.ids.filter((x): x is string => typeof x === "string");
  }
  if (ids.length === 0) return Response.json({ error: "Tidak ada id untuk dihapus" }, { status: 400 });
  try {
    await deletePendingan(ids);
    return Response.json({ deleted: ids.length });
  } catch (err) {
    return serverError("pendingan", err);
  }
}
