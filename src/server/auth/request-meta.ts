import type { SessionMeta } from "./session";

/** Info perangkat untuk dicatat di sesi (membantu Super Admin mengenali sesi). */
export function requestMeta(req: Request): SessionMeta {
  return {
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip"),
  };
}
