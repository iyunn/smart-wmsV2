import { db } from "@/server/db";
import { requireSuperAdmin } from "@/server/auth/guard";

// ══════════════════════════════════════════════════════════════════════════
// /api/admin/users — SEMENTARA (Tahap 3b). Daftar user sudah dibaca dari app_users lokal.
// Aksi ubah (approve/reject/role/tambah/hapus/reset password) dikerjakan di Tahap 3c;
// sampai saat itu dikembalikan 503 dengan pesan jelas (V1 memakai Supabase Auth yang sudah
// tidak dipakai V2).
// ══════════════════════════════════════════════════════════════════════════

export async function GET() {
  const me = await requireSuperAdmin();
  if (me instanceof Response) return me;

  const data = await db
    .selectFrom("app_users")
    .select(["id", "username", "nik", "email", "role", "status", "created_at"])
    .orderBy("created_at", "desc")
    .execute();
  return Response.json({ data });
}

const belumTersedia = () =>
  Response.json(
    { error: "Fitur ini sedang dipindahkan ke auth V2 (Tahap 3c). Untuk sementara hanya bisa melihat daftar user." },
    { status: 503 },
  );

export const POST = belumTersedia;
export const PATCH = belumTersedia;
export const DELETE = belumTersedia;
