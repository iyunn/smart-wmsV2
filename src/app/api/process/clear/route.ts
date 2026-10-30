import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { clearDAT } from "@/server/modules/upload/dat";

// POST /api/process/clear — kosongkan assets_raw (+ assets_clean CASCADE) sebelum upload DAT.
export async function POST() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    await clearDAT();
    return Response.json({ success: true });
  } catch (err) {
    console.error("[process/clear]", err);
    return Response.json(
      { success: false, error: `Gagal hapus data lama: ${err instanceof Error ? err.message : err}` },
      { status: 500 },
    );
  }
}
