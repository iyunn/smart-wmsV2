import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { DATSummaryDocument } from "@/components/reports/DATSummaryDocument";
import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import { getDATSummary } from "@/server/modules/reports/dat-summary";
import { type MonitoringFilters, TAG_FIELDS, describeFilters } from "@/lib/monitoringFilter";

// GET  /api/reports/dat-summary?cost_center=ALL|CGA1|CGA2|CGA3 → PDF Rekap DAT (tanpa filter lain).
// POST /api/reports/dat-summary { cost_center, quick, tags: [{ field, value }] }
//      → PDF Rekap DAT sesuai filter yang sedang dipakai di halaman Monitoring (sama dengan Export Excel).

async function pdfResponse(costCenter: string | null, filters?: MonitoringFilters) {
  const data = await getDATSummary(costCenter, filters);
  if (data.length === 0) return Response.json({ error: "Tidak ada data DAT yang sesuai filter." }, { status: 404 });
  const filterLabel = filters ? describeFilters(filters) : costCenter && costCenter !== "ALL" ? costCenter : "";
  const pdf = await renderToBuffer(DATSummaryDocument({ data, generatedAt: new Date().toISOString(), filterLabel }));
  const tag = filterLabel ? "Filter" : "ALL";
  const filename = `DAT-Summary-${costCenter && costCenter !== "ALL" ? costCenter : tag}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdf.length.toString(),
    },
  });
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return await pdfResponse(new URL(req.url).searchParams.get("cost_center"));
  } catch (err) {
    return serverError("report/dat-summary", err);
  }
}

const Body = z.object({
  cost_center: z.enum(["ALL", "CGA1", "CGA2", "CGA3"]).default("ALL"),
  quick: z.string().max(200).default(""),
  tags: z.array(z.object({ field: z.enum(TAG_FIELDS as [string, ...string[]]), value: z.string().trim().min(1).max(200) }).strict())
    .max(30).default([]),
}).strict();

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Filter tidak valid." }, { status: 400 });
  const b = parsed.data;
  try {
    return await pdfResponse(b.cost_center, {
      costCenter: b.cost_center,
      quickSearch: b.quick,
      tags: b.tags as MonitoringFilters["tags"],
    });
  } catch (err) {
    return serverError("report/dat-summary", err);
  }
}
