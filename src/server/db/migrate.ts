import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sql } from "kysely";
import { type Migration, type MigrationProvider, Migrator } from "kysely/migration";
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

const MIGRATION_FOLDER = path.resolve(process.cwd(), "src/server/db/migrations"); // npm script jalan dari root repo
const MIGRATION_FILE = /\.(ts|mts|js|mjs)$/;

/**
 * Pengganti FileMigrationProvider bawaan Kysely. Provider bawaan memanggil
 * `import("D:\\...\\0001_x.ts")`, yang DITOLAK Node.js di Windows ("Received protocol 'd:'")
 * karena path absolut harus berupa file:// URL. Di sini path diubah lewat pathToFileURL.
 * Nama migrasi = nama file tanpa ekstensi (sama dengan perilaku provider bawaan).
 */
class FileUrlMigrationProvider implements MigrationProvider {
  constructor(private readonly folder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const files = (await readdir(this.folder))
      .filter((f) => MIGRATION_FILE.test(f) && !f.endsWith(".d.ts"))
      .sort();

    const migrations: Record<string, Migration> = {};
    for (const file of files) {
      const mod = await import(pathToFileURL(path.join(this.folder, file)).href);
      // Modul TS yang di-compile tsx sebagai CommonJS muncul di bawah `default`.
      const migration: Migration | undefined = typeof mod.up === "function" ? mod : mod.default;
      if (typeof migration?.up !== "function") {
        throw new Error(`File migrasi ${file} tidak mengekspor function up().`);
      }
      migrations[file.replace(MIGRATION_FILE, "")] = migration;
    }
    return migrations;
  }
}

async function main() {
  const db = createDb(requireEnv("DATABASE_URL_OWNER"), { max: 1 });
  const migrator = new Migrator({
    db,
    provider: new FileUrlMigrationProvider(MIGRATION_FOLDER),
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
