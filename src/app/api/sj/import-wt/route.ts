import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { importWT, type ImportWTInput } from "@/server/modules/sj/import-wt";

// POST /api/sj/import-wt — SJ hasil parse PDF Web Tracking → SJ SmartWMS (status submitted).
// → { success, no_sj, no_sj_wt, tujuan_created, items_count }
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const b = await readJson<Partial<ImportWTInput>>(req);
  if (!b.tujuan_kode || !b.tanggal || !Array.isArray(b.items) || b.items.length === 0) {
    return Response.json({ error: "Data tidak lengkap" }, { status: 400 });
  }
  try {
    return Response.json(
      await importWT({
        tujuan_kode: String(b.tujuan_kode),
        tujuan_nama: b.tujuan_nama,
        tanggal: b.tanggal,
        pembawa: b.pembawa,
        no_sj_wt: b.no_sj_wt,
        items: b.items,
      }),
    );
  } catch (err) {
    return serverError("sj/import-wt", err);
  }
}
