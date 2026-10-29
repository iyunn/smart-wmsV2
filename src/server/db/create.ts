import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./types";

// ══════════════════════════════════════════════════════════════════════════
// Pabrik koneksi Kysely — dipakai aplikasi (lewat ./index.ts) DAN skrip CLI
// (migrate, import data). Sengaja TANPA `import "server-only"` karena skrip
// CLI dijalankan Node biasa, bukan oleh Next.js. Lihat ARCHITECTURE D-20.
// ══════════════════════════════════════════════════════════════════════════

// Samakan bentuk data dengan V1 (Supabase/PostgREST) agar kontrak API tetap (D-08):
// - int8 & numeric → number. Default `pg` mengembalikan string demi presisi; kolom V1
//   (biaya_perolehan, total_qty, dst.) jauh di bawah 2^53, jadi aman.
// - date → string "YYYY-MM-DD". Default `pg` mengubahnya jadi Date jam 00:00 waktu
//   lokal server, yang bisa bergeser tanggal saat diserialisasi ke JSON (UTC).
// - timestamp TANPA zona → string "YYYY-MM-DDTHH:MM:SS[.ffffff]" persis format PostgREST V1.
//   Default `pg` menganggapnya jam LOKAL proses Node (WIB di PC server) lalu menggeser
//   7 jam saat jadi JSON. Isinya jam UTC (database dikunci UTC, D-22).
// - timestamptz tetap Date → di JSON menjadi string ISO, sama-sama bisa dibaca frontend.
// Kalau parser ini diubah, sesuaikan juga `.kysely-codegenrc.json` (D-21).
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => v.replace(" ", "T"));

export interface CreateDbOptions {
  /** Jumlah koneksi maksimum di pool. Default 10 (cukup untuk < 20 pengguna LAN). */
  max?: number;
}

export function createDb(connectionString: string, options: CreateDbOptions = {}) {
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} belum diset (lihat .env.example).`);
  }
  return value;
}
