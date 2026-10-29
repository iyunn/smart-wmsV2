import { z } from "zod";
import { checkPasswordStrength } from "@/server/auth/policy";

// Validasi input akun — dipakai register (publik) dan Manajemen User (Super Admin).

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, "Username minimal 3 karakter.")
  .max(32, "Username maksimal 32 karakter.")
  .regex(/^[A-Za-z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, dan strip.");

export const NikSchema = z.string().trim().min(1, "NIK wajib diisi.").max(32, "NIK maksimal 32 karakter.");

export const EmailSchema = z.string().trim().pipe(z.email("Format email tidak valid.").max(254));

export const PasswordSchema = z.string().superRefine((pw, ctx) => {
  const problem = checkPasswordStrength(pw);
  if (problem === "too_short") ctx.addIssue({ code: "custom", message: "Password minimal 8 karakter." });
  if (problem === "too_long") ctx.addIssue({ code: "custom", message: "Password terlalu panjang (maksimal 72 karakter)." });
});

export const RoleSchema = z.enum(["super_admin", "admin"]);
export const StatusSchema = z.enum(["pending", "active", "rejected"]);

export const NewAccountSchema = z.object({
  username: UsernameSchema,
  nik: NikSchema,
  email: EmailSchema,
  password: PasswordSchema,
});

/** Pesan error pertama dari zod, untuk ditampilkan ke user. */
export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Data tidak valid.";
}
