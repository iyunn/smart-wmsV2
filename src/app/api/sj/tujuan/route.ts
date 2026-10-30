import { requireUser } from "@/server/auth/guard";
import { pgCode, readJson, serverError } from "@/server/http";
import { createTujuan, deleteTujuan, listTujuan, updateTujuan } from "@/server/modules/sj/master";

// /api/sj/tujuan — master tujuan/cost center penerima SJ.
type Body = { id?: string; kode?: string; nama?: string; kota?: string | null; kecamatan?: string | null };

const friendly = (tag: string, err: unknown) => {
  if (pgCode(err) === "23505") return Response.json({ error: "Kode tujuan ini sudah dipakai." }, { status: 409 });
  if (pgCode(err) === "23503") {
    return Response.json({ error: "Tujuan masih dipakai di Surat Jalan, tidak bisa dihapus." }, { status: 409 });
  }
  return serverError(tag, err);
};

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ tujuan: await listTujuan() });
  } catch (err) {
    return serverError("sj/tujuan", err);
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const b = await readJson<Body>(req);
  if (!b.kode?.trim() || !b.nama?.trim()) return Response.json({ error: "Kode dan nama wajib diisi" }, { status: 400 });
  try {
    return Response.json({ tujuan: await createTujuan({ kode: b.kode, nama: b.nama, kota: b.kota, kecamatan: b.kecamatan }) });
  } catch (err) {
    return friendly("sj/tujuan", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const b = await readJson<Body>(req);
  if (!b.id) return Response.json({ error: "ID wajib" }, { status: 400 });
  if (!b.kode?.trim() || !b.nama?.trim()) return Response.json({ error: "Kode dan nama wajib diisi" }, { status: 400 });
  try {
    const tujuan = await updateTujuan(b.id, { kode: b.kode, nama: b.nama, kota: b.kota, kecamatan: b.kecamatan });
    if (!tujuan) return Response.json({ error: "Tujuan tidak ditemukan" }, { status: 404 });
    return Response.json({ tujuan });
  } catch (err) {
    return friendly("sj/tujuan", err);
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "ID wajib" }, { status: 400 });
  try {
    await deleteTujuan(id);
    return Response.json({ success: true });
  } catch (err) {
    return friendly("sj/tujuan", err);
  }
}
