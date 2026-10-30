import { type Kysely, sql } from "kysely";

// ══════════════════════════════════════════════════════════════════════════
// 0003 — Tema custom per user (PRD D10, ARCHITECTURE D-37)
//
// app_users.theme_custom: warna dasar pilihan user untuk tema light dan/atau dark, mis.
//   {"light": {"accent": "#0F766E", "bg": "#F5F5F4"}, "dark": {...}}
// Hanya warna yang BERBEDA dari bawaan yang disimpan (biasanya < 1 KB). NULL = tema bawaan.
// Bentuk & isi divalidasi di API (src/lib/theme/custom.ts); constraint di sini hanya pagar
// terakhir supaya kolom tidak bisa diisi data besar/bukan objek.
// ══════════════════════════════════════════════════════════════════════════

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    alter table app_users
      add column theme_custom jsonb,
      add constraint app_users_theme_custom_check check (
        theme_custom is null
        or (jsonb_typeof(theme_custom) = 'object' and pg_column_size(theme_custom) <= 4096)
      )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table app_users drop column if exists theme_custom`.execute(db);
}
