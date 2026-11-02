import { z } from "zod";
import { requireUser } from "@/server/auth/guard";
import { serverError } from "@/server/http";
import {
  BountyError, createBounty, deleteBounty, listBounty, settleBounty, undoSettleBounty, updateBounty,
} from "@/server/modules/bounty/service";

// /api/bounty — Bounty Hunter (ROADMAP 9e). Semua user aktif.
//   GET                                                   → { per_barang, as: [...], items: [...] }
//   POST   { as_inisial, as_nama?, jenis, qty, tujuan_id?, keterangan?, tanggal? } → { id }
//   PATCH  { id, aksi: "ubah", ...field yang diubah }
//   PATCH  { id, aksi: "selesai", qty, catatan? }      → tandai kembali (boleh sebagian)
//   PATCH  { id, aksi: "batal",   qty, catatan? }      → batalkan tanda selesai
//   DELETE { id, catatan? }                             → hapus (soft delete, tercatat di riwayat)

const Tanggal = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid.")
  .refine((s) => { const d = new Date(s + "T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, "Tanggal tidak valid.");
const Qty = z.number({ message: "Jumlah wajib angka." }).int("Jumlah harus bilangan bulat.").min(1, "Jumlah minimal 1.").max(9999, "Jumlah maksimal 9999.");
const Catatan = z.string().max(500, "Catatan maksimal 500 karakter.").default("");

const Fields = {
  as_inisial: z.string().trim().min(1, "Inisial AS wajib diisi.").max(32),
  as_nama: z.string().trim().max(100).optional(),
  jenis: z.string().trim().min(1, "Jenis barang wajib diisi.").max(100, "Jenis barang maksimal 100 karakter."),
  qty: Qty,
  tujuan_id: z.uuid("Toko tidak valid.").nullable().optional(),
  keterangan: z.string().max(500, "Keterangan maksimal 500 karakter.").optional(),
  tanggal: Tanggal.optional(),
};

const CreateBody = z.object(Fields).strict();
const PatchBody = z.discriminatedUnion("aksi", [
  z.object({ id: z.uuid(), aksi: z.literal("ubah"), ...Fields, as_inisial: Fields.as_inisial.optional(), jenis: Fields.jenis.optional(), qty: Qty.optional() }).strict(),
  z.object({ id: z.uuid(), aksi: z.literal("selesai"), qty: Qty, catatan: Catatan }).strict(),
  z.object({ id: z.uuid(), aksi: z.literal("batal"), qty: Qty, catatan: Catatan }).strict(),
]);
const DeleteBody = z.object({ id: z.uuid(), catatan: Catatan }).strict();

const firstIssue = (e: z.ZodError) => {
  const i = e.issues[0];
  if (!i) return "Data tidak valid.";
  if (i.code === "unrecognized_keys") return `Kolom tidak dikenal: ${i.keys.join(", ")}.`;
  if (i.code === "invalid_union" || i.path[0] === "aksi") return "Aksi tidak dikenal (ubah / selesai / batal).";
  return i.message;
};
const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });
const fail = (tag: string, err: unknown) =>
  err instanceof BountyError ? Response.json({ error: err.message }, { status: err.status }) : serverError(tag, err);

export async function GET() {
  const user = await requireUser();
  if (user instanceof Response) return user;
  try {
    return Response.json(await listBounty());
  } catch (err) {
    return fail("bounty GET", err);
  }
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(firstIssue(parsed.error));
  try {
    const id = await createBounty(parsed.data, user.username);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return fail("bounty POST", err);
  }
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(firstIssue(parsed.error));
  const b = parsed.data;
  try {
    if (b.aksi === "selesai") await settleBounty(b.id, b.qty, b.catatan, user.username);
    else if (b.aksi === "batal") await undoSettleBounty(b.id, b.qty, b.catatan, user.username);
    else {
      const { id, aksi: _aksi, ...patch } = b;
      await updateBounty(id, patch, user.username);
    }
    return Response.json({ success: true });
  } catch (err) {
    return fail("bounty PATCH", err);
  }
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(firstIssue(parsed.error));
  try {
    await deleteBounty(parsed.data.id, parsed.data.catatan, user.username);
    return Response.json({ success: true });
  } catch (err) {
    return fail("bounty DELETE", err);
  }
}
