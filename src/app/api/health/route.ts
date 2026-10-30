import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "kysely";
import { db } from "@/server/db";

// GET /api/health — publik (tanpa login), dipakai deploy.ps1 & pemantauan service.
// Sengaja tidak membocorkan detail: hanya status, versi rilis, dan apakah database terjangkau.
//   200 { status: "ok", release, db: "ok" } · 503 { status: "error", release, db: "down" }
export const dynamic = "force-dynamic";

let release: string | null = null;
function currentRelease(): string {
  if (release === null) {
    try {
      // release.json ditulis deploy.ps1 di folder rilis (cwd server standalone).
      release = String(JSON.parse(readFileSync(join(process.cwd(), "release.json"), "utf8")).release ?? "unknown");
    } catch {
      release = "dev";
    }
  }
  return release;
}

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    await sql`select 1`.execute(db);
    return Response.json({ status: "ok", release: currentRelease(), db: "ok" }, { headers });
  } catch (err) {
    console.error("[health]", err);
    return Response.json({ status: "error", release: currentRelease(), db: "down" }, { status: 503, headers });
  }
}
