import { requireUser } from "@/server/auth/guard";
import { pgCode, readJson, serverError } from "@/server/http";
import { createTemplate, deleteTemplate, listTemplates } from "@/server/modules/sj/master";

// GET    /api/sj/templates            → { templates }
// POST   /api/sj/templates { nama, items } → { template }
// DELETE /api/sj/templates?id=…
export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ templates: await listTemplates() });
  } catch (err) {
    return serverError("sj/templates GET", err);
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = await readJson<{ nama?: string; items?: unknown[] }>(req);
  const nama = (body?.nama ?? "").trim();
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!nama) return Response.json({ error: "Nama template wajib diisi" }, { status: 400 });
  if (items.length === 0) return Response.json({ error: "Minimal 1 item dalam template" }, { status: 400 });

  // Hanya field yang relevan (tanpa serial_number/urutan)
  const cleanItems = (items as Record<string, unknown>[]).map((it) => ({
    jenis: String(it.jenis ?? ""),
    merk: String(it.merk ?? ""),
    qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
    satuan: String(it.satuan ?? "Unit"),
    is_baru: !!it.is_baru,
    is_aktiva: !!it.is_aktiva,
    keterangan: String(it.keterangan ?? ""),
  }));
  try {
    return Response.json({ template: await createTemplate(nama, cleanItems) });
  } catch (err) {
    if (pgCode(err) === "23505") {
      return Response.json({ error: `Template dengan nama "${nama}" sudah ada` }, { status: 409 });
    }
    return serverError("sj/templates POST", err);
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id wajib disertakan" }, { status: 400 });
  try {
    await deleteTemplate(id);
    return Response.json({ success: true });
  } catch (err) {
    return serverError("sj/templates DELETE", err);
  }
}
