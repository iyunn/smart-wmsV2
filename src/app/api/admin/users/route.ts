import { z } from "zod";
import { requireSuperAdmin } from "@/server/auth/guard";
import {
  EmailSchema, NewAccountSchema, NikSchema, RoleSchema, StatusSchema, UsernameSchema, firstIssue,
} from "@/server/modules/users/schemas";
import { UserError, createUser, deleteUser, listUsers, updateUser, updateUserProfile } from "@/server/modules/users/service";

// /api/admin/users — Manajemen User (Super Admin). Kontrak request sama dengan V1:
//   GET                                   → { data: user[] }
//   POST   { username, nik, email, password, role } → buat akun aktif (wajib ganti password)
//   PATCH  { id, role?, status? }         → ubah role / approve / tolak / nonaktifkan / aktifkan
//   PATCH  { id, username?, nik?, email? } → edit data akun (boleh akun sendiri) — tidak boleh
//          dicampur dengan role/status dalam satu request
//   DELETE { id }                         → hapus permanen
// Aturan pengaman ada di src/server/modules/users/service.ts.

const fail = (err: unknown) => {
  if (err instanceof UserError) return Response.json({ error: err.message }, { status: err.status });
  throw err;
};

export async function GET() {
  const me = await requireSuperAdmin();
  if (me instanceof Response) return me;
  return Response.json({ data: await listUsers() });
}

const CreateBody = NewAccountSchema.extend({ role: RoleSchema.default("admin") });

export async function POST(req: Request) {
  const me = await requireSuperAdmin();
  if (me instanceof Response) return me;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  try {
    const id = await createUser(parsed.data);
    return Response.json({ success: true, id }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

const PatchBody = z.object({ id: z.uuid(), role: RoleSchema.optional(), status: StatusSchema.optional() }).strict();
const ProfileBody = z
  .object({ id: z.uuid(), username: UsernameSchema.optional(), nik: NikSchema.optional(), email: EmailSchema.optional() })
  .strict();

export async function PATCH(req: Request) {
  const me = await requireSuperAdmin();
  if (me instanceof Response) return me;
  const body = await req.json().catch(() => null);
  const isProfileEdit =
    body && typeof body === "object" && ("username" in body || "nik" in body || "email" in body);
  try {
    if (isProfileEdit) {
      const parsed = ProfileBody.safeParse(body);
      if (!parsed.success) {
        const unknownKey = parsed.error.issues.some((i) => i.code === "unrecognized_keys");
        return Response.json(
          { error: unknownKey ? "Edit data akun tidak bisa digabung dengan ubah role/status." : firstIssue(parsed.error) },
          { status: 400 },
        );
      }
      const { id, ...patch } = parsed.data;
      await updateUserProfile(id, patch);
      return Response.json({ success: true });
    }
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Data tidak valid." }, { status: 400 });
    const { id, ...patch } = parsed.data;
    await updateUser(me.id, id, patch);
    return Response.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}

const DeleteBody = z.object({ id: z.uuid() });

export async function DELETE(req: Request) {
  const me = await requireSuperAdmin();
  if (me instanceof Response) return me;
  const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Data tidak valid." }, { status: 400 });
  try {
    await deleteUser(me.id, parsed.data.id);
    return Response.json({ success: true });
  } catch (err) {
    return fail(err);
  }
}
