import { z } from "zod";
import { authenticate } from "@/server/auth/login";
import { setSessionCookie } from "@/server/auth/cookies";
import { requestMeta } from "@/server/auth/request-meta";

// POST /api/auth/login — { identifier: email atau username, password }

const Body = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

const jam = (d: Date) =>
  new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Email/username dan password wajib diisi." }, { status: 400 });
  }

  const r = await authenticate(parsed.data.identifier, parsed.data.password, requestMeta(req));

  if (r.ok) {
    await setSessionCookie(r.token, r.expiresAt);
    return Response.json({ ok: true, mustChangePassword: r.mustChangePassword });
  }

  switch (r.reason) {
    case "locked":
      return Response.json(
        { error: `Terlalu banyak percobaan gagal. Coba lagi setelah pukul ${jam(r.until)} WIB.` },
        { status: 423 },
      );
    case "pending":
      return Response.json({ error: "Akun Anda masih menunggu persetujuan Super Admin." }, { status: 403 });
    case "rejected":
      return Response.json({ error: "Akun Anda tidak aktif. Hubungi Super Admin." }, { status: 403 });
    default:
      return Response.json({ error: "Email/username atau password salah." }, { status: 401 });
  }
}
