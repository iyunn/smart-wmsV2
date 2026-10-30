import { renderToBuffer } from "@react-pdf/renderer";
import { DATSummaryDocument } from "@/components/reports/DATSummaryDocument";
import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { getDATSummary } from "@/server/modules/reports/dat-summary";

// GET /api/reports/dat-summary?cost_center=ALL|CGA1|CGA2|CGA3 → PDF Rekap DAT.
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    const costCenter = new URL(req.url).searchParams.get("cost_center");
    const data = await getDATSummary(costCenter);
    const pdf = await renderToBuffer(DATSummaryDocument({ data, generatedAt: new Date().toISOString() }));
    const filename = `DAT-Summary-${costCenter ?? "ALL"}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdf.length.toString(),
      },
    });
  } catch (err) {
    return serverError("report/dat-summary", err);
  }
}
