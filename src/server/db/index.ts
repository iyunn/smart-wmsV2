import "server-only";
import { createDb, requireEnv } from "./create";

// ══════════════════════════════════════════════════════════════════════════
// Instance database untuk aplikasi (Route Handler / Server Component / Action).
//   import { db } from "@/server/db";
//
// Satu pool untuk seluruh proses. Saat `next dev`, modul bisa dimuat ulang
// (hot reload) — instance disimpan di globalThis supaya pool tidak dibuat
// berkali-kali sampai koneksi PostgreSQL habis.
// ══════════════════════════════════════════════════════════════════════════

const globalForDb = globalThis as unknown as { __smartwmsDb?: ReturnType<typeof createDb> };

export const db = globalForDb.__smartwmsDb ?? createDb(requireEnv("DATABASE_URL"));

if (process.env.NODE_ENV !== "production") {
  globalForDb.__smartwmsDb = db;
}
