import { clearSessionCookie, getSessionToken } from "@/server/auth/cookies";
import { revokeSession } from "@/server/auth/session";

// POST /api/auth/logout — hapus sesi di database + cookie. Selalu berhasil (idempoten).
export async function POST() {
  await revokeSession(await getSessionToken());
  await clearSessionCookie();
  return Response.json({ ok: true });
}
