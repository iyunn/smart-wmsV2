import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";

// Cookie sesi: httpOnly (tidak terbaca JavaScript di browser), SameSite=Lax (tidak ikut
// terkirim dari form situs lain), Secure hanya bila SESSION_COOKIE_SECURE=true (butuh HTTPS;
// di LAN kantor masih HTTP). Hanya bisa di-set dari Route Handler / Server Action.

const secure = () => process.env.SESSION_COOKIE_SECURE === "true";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secure(),
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secure(),
    path: "/",
    maxAge: 0,
  });
}
