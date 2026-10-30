import { z } from "zod";
import { requireUser } from "@/server/auth/guard";
import { readJson, serverError } from "@/server/http";
import { createRule, deleteRule, listRules, updateRule } from "@/server/modules/classification/rules";

// /api/keyword-rules — CRUD aturan klasifikasi (V1: browser langsung ke Supabase).
//   GET                                  → { rules }
//   POST   { keyword, rule_type, value } → { rule }
//   PATCH  { id, keyword, rule_type, value }
//   DELETE ?id=…                         → { rule } (dipakai client untuk revert reclassify)

const RuleBody = z.object({
  keyword: z.string().trim().min(1, "Keyword tidak boleh kosong."),
  rule_type: z.enum(["jenis", "merk", "no_merk"]),
  value: z.string().default(""),
}).refine((b) => b.rule_type === "no_merk" || b.value.trim() !== "", { message: "Value wajib diisi" });

const issue = (e: z.ZodError) => e.issues[0]?.message ?? "Data tidak valid.";

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json({ rules: await listRules() });
  } catch (err) {
    return serverError("keyword-rules", err);
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = RuleBody.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: issue(parsed.error) }, { status: 400 });
  try {
    return Response.json({ rule: await createRule(parsed.data) }, { status: 201 });
  } catch (err) {
    return serverError("keyword-rules", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const body = await readJson<{ id?: string }>(req);
  const parsed = RuleBody.safeParse(body);
  if (!body.id || !z.uuid().safeParse(body.id).success) return Response.json({ error: "id tidak valid" }, { status: 400 });
  if (!parsed.success) return Response.json({ error: issue(parsed.error) }, { status: 400 });
  try {
    const n = await updateRule(body.id, parsed.data);
    if (n === 0) return Response.json({ error: "Rule tidak ditemukan." }, { status: 404 });
    return Response.json({ success: true });
  } catch (err) {
    return serverError("keyword-rules", err);
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.uuid().safeParse(id).success) return Response.json({ error: "id tidak valid" }, { status: 400 });
  try {
    const rule = await deleteRule(id);
    if (!rule) return Response.json({ error: "Rule tidak ditemukan." }, { status: 404 });
    return Response.json({ rule });
  } catch (err) {
    return serverError("keyword-rules", err);
  }
}
