import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_TOKEN_PATTERN } from "@/server/auth/constants";

// ══════════════════════════════════════════════════════════════════════════
// Penjaga rute (Next.js 16 "proxy", runtime Node.js) — ARCHITECTURE D-06.
// Hanya cek OPTIMISTIS: ada cookie sesi berbentuk sah → boleh lewat. Tidak ada query
// database di sini (proxy jalan di SETIAP request termasuk prefetch). Validasi sesi yang
// sebenarnya dilakukan requireUser() di setiap Route Handler dan /api/me di setiap halaman.
// ══════════════════════════════════════════════════════════════════════════

const PUBLIC_PAGES = ["/login", "/register"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/me", "/api/health"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isPublic =
    PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) || PUBLIC_API.includes(pathname);
  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && SESSION_TOKEN_PATTERN.test(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login lagi." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|worker\\.min\\.js|worker\\.min\\.mjs)$).*)",
  ],
};
