import { promises as fs } from "node:fs";
import path from "node:path";
import { sql } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { createDb, requireEnv } from "./create";

// ══════════════════════════════════════════════════════════════════════════
// Runner migrasi skema (ARCHITECTURE D-04). Dijalankan lewat npm:
//   npm run db:migrate            → terapkan semua migrasi yang belum jalan
//   npm run db:migrate -- down    → batalkan 1 migrasi terakhir
//   npm run db:migrate -- status  → daftar migrasi + status
//   npm run db:migrate -- check   → tes koneksi & versi PostgreSQL
//
// Memakai DATABASE_URL_OWNER (role pemilik database) karena migrasi butuh hak
// CREATE/ALTER. Aplikasi sendiri memakai DATABASE_URL (role smartwms_app).
// ══════════════════════════════════════════════════════════════════════════

const command = process.argv[2] ?? "latest";

async function main() {
  const db = createDb(requireEnv("DATABASE_URL_OWNER"), { max: 1 });
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // npm script selalu dijalankan dari root repo
      migrationFolder: path.resolve(process.cwd(), "src/server/db/migrations"),
    }),
  });

  try {
    if (command === "check") {
      const { rows } = await sql<{ version: string; db: string; usr: string }>`
        select version() as version, current_database() as db, current_user as usr
      `.execute(db);
      console.log(`✓ Terhubung ke database "${rows[0].db}" sebagai "${rows[0].usr}"`);
      console.log(`  ${rows[0].version}`);
      return;
    }

    if (command === "status") {
      const list = await migrator.getMigrations();
      if (list.length === 0) console.log("Belum ada file migrasi.");
      for (const m of list) {
        console.log(`${m.executedAt ? "✓" : "·"} ${m.name}${m.executedAt ? `  (${m.executedAt.toISOString()})` : ""}`);
      }
      return;
    }

    if (command !== "latest" && command !== "down") {
      throw new Error(`Perintah tidak dikenal: "${command}". Pakai: latest | down | status | check`);
    }

    const { error, results } =
      command === "down" ? await migrator.migrateDown() : await migrator.migrateToLatest();

    for (const r of results ?? []) {
      const mark = r.status === "Success" ? "✓" : r.status === "Error" ? "✗" : "·";
      console.log(`${mark} ${r.direction === "Down" ? "batal" : "jalan"}: ${r.migrationName}`);
    }
    if (error) throw error;
    if (!results?.length) console.log("Tidak ada migrasi baru — skema sudah terbaru.");
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error("✗ Migrasi gagal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
