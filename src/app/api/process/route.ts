import { requireUser } from "@/server/auth/guard";
import { pgCode, readJson } from "@/server/http";
import { type DATRow, processDATBatch } from "@/server/modules/upload/dat";

// POST /api/process — { data: DATRow[], isLastBatch? } satu batch upload DAT (dari batchProcessor.ts).
// Kontrak V1 dipertahankan: kesalahan DATA (mis. kode_asset kembar) → 200 { success:false, error }
// supaya batchProcessor tidak mengulang; kesalahan server tak terduga → 500 (boleh diulang).
export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  const { data, isLastBatch } = await readJson<{ data?: DATRow[]; isLastBatch?: boolean }>(req);
  if (!data || data.length === 0) {
    return Response.json({ success: false, error: "No data provided" });
  }
  try {
    return Response.json(await processDATBatch(data, !!isLastBatch));
  } catch (err) {
    const code = pgCode(err);
    // 22xxx = data tidak valid, 23xxx = pelanggaran constraint (kembar, NOT NULL, dll.)
    if (code && (code.startsWith("22") || code.startsWith("23"))) {
      console.error("[process] batch ditolak:", err);
      return Response.json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
    console.error("[process] error:", err);
    return Response.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
