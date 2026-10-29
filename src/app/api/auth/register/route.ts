import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { NewAccountSchema, firstIssue } from "@/server/modules/users/schemas";

// POST /api/auth/register — daftar akun baru berstatus `pending` (wajib di-approve Super Admin),
// sama dengan alur V1. Role selalu `admin`; Super Admin bisa menaikkan role di Manajemen User.

export async function POST(req: Request) {
  const parsed = NewAccountSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { username, nik, email, password } = parsed.data;

  try {
    await db
      .insertInto("app_users")
      .values({
        username,
        nik,
        email,
        password_hash: await hashPassword(password),
        role: "admin",
        status: "pending",
      })
      .execute();
  } catch (err) {
    // 23505 = unique_violation (index lower(email) / lower(username))
    if ((err as { code?: string }).code === "23505") {
      return Response.json({ error: "Email atau username sudah terdaftar." }, { status: 409 });
    }
    throw err;
  }

  return Response.json({ ok: true }, { status: 201 });
}
