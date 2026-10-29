import { z } from "zod";
import { db } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { checkPasswordStrength } from "@/server/auth/policy";

// POST /api/auth/register — daftar akun baru berstatus `pending` (wajib di-approve Super Admin),
// sama dengan alur V1. Role selalu `admin`; Super Admin bisa menaikkan role di Manajemen User.

const Body = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(32, "Username maksimal 32 karakter.")
    .regex(/^[A-Za-z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, dan strip."),
  nik: z.string().trim().min(1, "NIK wajib diisi.").max(32, "NIK maksimal 32 karakter."),
  email: z.email("Format email tidak valid.").max(254),
  password: z.string(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const { username, nik, email, password } = parsed.data;

  const weak = checkPasswordStrength(password);
  if (weak) {
    return Response.json(
      { error: weak === "too_short" ? "Password minimal 8 karakter." : "Password terlalu panjang (maksimal 72 karakter)." },
      { status: 400 },
    );
  }

  try {
    await db
      .insertInto("app_users")
      .values({
        username,
        nik,
        email: email.trim(),
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
