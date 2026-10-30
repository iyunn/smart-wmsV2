import { requireSuperAdmin, requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import {
  SJError, createSJ, deleteSJ, getSJDetail, listSJ, patchSJHeader, updateSJFull,
  type SJHeaderInput, type SJItemInput,
} from "@/server/modules/sj/surat-jalan";

// /api/sj — Surat Jalan (keluar & masuk). Kontrak sama dengan V1 (D-08); logika di
// modules/sj/surat-jalan.ts.

type Body = Partial<SJHeaderInput> & {
  id?: string;
  jenis?: string;
  items?: SJItemInput[];
  reschedule_only?: boolean;
  archive_only?: boolean;
  is_archived?: boolean;
};

const fail = (tag: string, err: unknown) =>
  err instanceof SJError ? Response.json({ error: err.message }, { status: err.status }) : serverError(tag, err);

// GET /api/sj → { sj: [...] } (daftar)  |  GET /api/sj?id=… → { sj } (detail + items)
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const sj = await getSJDetail(id);
      if (!sj) return Response.json({ error: "Surat jalan tidak ditemukan." }, { status: 404 });
      return Response.json({ sj });
    }
    return Response.json({ sj: await listSJ() });
  } catch (err) {
    return serverError("sj GET", err);
  }
}

// POST /api/sj → { sj, no_sj }
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const b = await readJson<Body>(req);
  if (!b.tanggal || !b.tujuan_id) {
    return Response.json({ error: "Tanggal dan tujuan wajib diisi" }, { status: 400 });
  }
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return Response.json({ error: "Minimal 1 item barang" }, { status: 400 });
  }
  try {
    const { sj, no_sj } = await createSJ(
      {
        tanggal: b.tanggal, tujuan_id: b.tujuan_id, pembawa: b.pembawa, penerima: b.penerima,
        approved_by: b.approved_by, status: b.status, jenis: b.jenis,
      },
      b.items,
    );
    return Response.json({ sj, no_sj });
  } catch (err) {
    return fail("sj POST", err);
  }
}

// PATCH /api/sj — 3 mode: archive_only, reschedule_only, edit penuh. → { sj }
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const b = await readJson<Body>(req);
  if (!b.id) return Response.json({ error: "ID wajib" }, { status: 400 });

  try {
    if (b.archive_only) {
      const sj = await patchSJHeader(b.id, { is_archived: !!b.is_archived });
      if (!sj) return Response.json({ error: "Surat jalan tidak ditemukan." }, { status: 404 });
      return Response.json({ sj });
    }
    if (b.reschedule_only) {
      if (!b.tanggal) return Response.json({ error: "Tanggal wajib diisi" }, { status: 400 });
      const sj = await patchSJHeader(b.id, { tanggal: b.tanggal });
      if (!sj) return Response.json({ error: "Surat jalan tidak ditemukan." }, { status: 404 });
      return Response.json({ sj });
    }

    if (!b.tanggal || !b.tujuan_id) {
      return Response.json({ error: "Tanggal dan tujuan wajib diisi" }, { status: 400 });
    }
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return Response.json({ error: "Minimal 1 item barang" }, { status: 400 });
    }
    const sj = await updateSJFull(
      b.id,
      {
        tanggal: b.tanggal, tujuan_id: b.tujuan_id, pembawa: b.pembawa, penerima: b.penerima,
        approved_by: b.approved_by, status: b.status, jenis: b.jenis,
      },
      b.items,
    );
    return Response.json({ sj });
  } catch (err) {
    return fail("sj PATCH", err);
  }
}

// DELETE /api/sj?id=… — hanya super admin (V1: tombol hapus disembunyikan untuk admin,
// tapi API-nya terbuka). Item ikut terhapus (CASCADE), staging terkait dibersihkan.
export async function DELETE(req: Request) {
  const user = await requireSuperAdmin();
  if (user instanceof Response) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "ID wajib" }, { status: 400 });
  try {
    await deleteSJ(id);
    return Response.json({ success: true });
  } catch (err) {
    return serverError("sj DELETE", err);
  }
}
