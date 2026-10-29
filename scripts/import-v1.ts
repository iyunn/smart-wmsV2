import { pipeline } from "node:stream/promises";
import pg from "pg";
import { from as copyFrom, to as copyTo } from "pg-copy-streams";

// ══════════════════════════════════════════════════════════════════════════
// Impor data V1 (Supabase) → PostgreSQL lokal — ROADMAP Tahap 2c, dipakai lagi saat cutover.
//
//   npm run db:import-v1 -- --confirm smartwms_dev
//
// Cara kerja:
//   1. Sumber dibaca dalam SATU transaksi READ ONLY + REPEATABLE READ → semua tabel diambil
//      dari snapshot yang sama (tidak ada data yang setengah ter-update). Supabase tidak diubah.
//   2. Tujuan dikerjakan dalam SATU transaksi: TRUNCATE semua tabel V1 → COPY per tabel
//      (urut induk → anak sesuai foreign key) → verifikasi. Gagal di titik mana pun = ROLLBACK,
//      database lokal kembali seperti sebelum impor.
//   3. Data dipindah dengan COPY format teks PostgreSQL → nilai pindah apa adanya (jsonb, numeric,
//      timestamp, teks berisi tab/baris baru), tanpa konversi tipe di JavaScript.
//   4. Verifikasi per tabel: jumlah baris + checksum isi (md5 seluruh baris, urut). Harus identik.
//
// Wajib `--confirm <nama_database_tujuan>` karena seluruh isi tabel tujuan DIHAPUS dulu.
//
// Akun (Tahap 3a): public.profiles + hash password dari auth.users (Supabase) digabung menjadi
// app_users (id sama). Akun tanpa password di Supabase diberi hash "!" (tidak bisa login) +
// must_change_password, menunggu reset oleh Super Admin. Semua sesi lokal ikut dihapus.
// ══════════════════════════════════════════════════════════════════════════

/** Urutan induk → anak. Tabel baru di V1/V2 wajib ditambahkan di sini (skrip menolak bila berbeda). */
const TABLES = [
  "sj_tujuan",
  "sj_item_templates",
  "keyword_rules",
  "assets_raw",
  "assets_clean",
  "classification_logs",
  "asset_notes",
  "dat_closing",
  "lpp_raw",
  "surat_jalan",
  "surat_jalan_items",
  "pendingan_items",
  "staging_area",
] as const;

const IGNORED_TARGET_TABLES = new Set(["kysely_migration", "kysely_migration_lock"]);

/** Tabel V1 yang tidak disalin 1:1 (ditangani khusus) dan tabel V2 yang tidak ada di V1. */
const SOURCE_ONLY = ["profiles"];
const TARGET_ONLY = ["app_users", "user_sessions"];

/** profiles + auth.users (Supabase) → app_users. Kolom & urutan sama dengan APP_USER_COLUMNS. */
const APP_USER_COLUMNS = [
  "id", "email", "username", "nik", "password_hash", "role", "status", "theme",
  "must_change_password", "created_at", "updated_at",
];
const SOURCE_APP_USERS = `
  select p.id, p.email, p.username, p.nik,
         coalesce(u.encrypted_password, '!')           as password_hash,
         p.role, p.status, p.theme,
         (u.encrypted_password is null)                as must_change_password,
         coalesce(p.created_at, u.created_at)          as created_at,
         coalesce(p.updated_at, p.created_at, u.created_at) as updated_at
  from public.profiles p
  join auth.users u on u.id = p.id`;

function env(name: string): string {
  const v = process.env[name]?.trim().replace(/^["']|["']$/g, "");
  if (!v) throw new Error(`${name} belum diisi di .env.local`);
  return v;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/**
 * Tutup koneksi tanpa menunggu selamanya. Bila COPY gagal di tengah jalan, koneksi SUMBER masih
 * dalam mode "COPY OUT" — query apa pun (termasuk ROLLBACK) akan mengantre tanpa batas. Transaksi
 * sumber READ ONLY, jadi aman diputus paksa: server membatalkannya sendiri saat koneksi hilang.
 */
async function closeQuietly(client: pg.Client, ms = 3000): Promise<void> {
  const ended = client.end().catch(() => {});
  const timedOut = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms).unref());
  if ((await Promise.race([ended, timedOut])) === "timeout") {
    (client as unknown as { connection?: { stream?: { destroy(): void } } }).connection?.stream?.destroy();
  }
}

async function listTables(c: pg.Client): Promise<string[]> {
  const r = await c.query<{ t: string }>(
    `select table_name as t from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
  );
  return r.rows.map((x) => x.t);
}

async function listColumns(c: pg.Client, table: string): Promise<string[]> {
  const r = await c.query<{ c: string }>(
    `select column_name as c from information_schema.columns
     where table_schema = 'public' and table_name = $1 order by ordinal_position`,
    [table],
  );
  return r.rows.map((x) => x.c);
}

/** Jumlah baris + md5 seluruh baris (urut berdasarkan teks baris) dengan kolom dalam urutan yang sama. */
async function fingerprint(c: pg.Client, from: string, cols: string[]) {
  const row = `row(${cols.map(q).join(", ")})::text`;
  const r = await c.query<{ n: string; h: string | null }>(
    `select count(*)::text as n, md5(string_agg(${row}, E'\\n' order by ${row})) as h from ${from}`,
  );
  return { rows: Number(r.rows[0].n), hash: r.rows[0].h ?? "(kosong)" };
}

async function main() {
  const source = new pg.Client({ connectionString: env("SUPABASE_DB_URL"), application_name: "smartwms-import-v1" });
  const target = new pg.Client({ connectionString: env("DATABASE_URL_OWNER"), application_name: "smartwms-import-v1" });
  await source.connect();
  await target.connect();

  try {
    const targetDb = (await target.query<{ d: string }>("select current_database() as d")).rows[0].d;
    if (argValue("--confirm") !== targetDb) {
      throw new Error(
        `Semua tabel di database "${targetDb}" akan DIKOSONGKAN lalu diisi ulang dari Supabase.\n` +
          `  Jalankan ulang dengan: npm run db:import-v1 -- --confirm ${targetDb}`,
      );
    }

    // Kedua sisi pakai UTC agar representasi teks timestamptz identik (checksum & COPY).
    await source.query("set timezone to 'UTC'");
    await target.query("set timezone to 'UTC'");

    // ── Cek skema sama ────────────────────────────────────────────────────
    const expectedSrc = [...TABLES, ...SOURCE_ONLY];
    const expectedDst = [...TABLES, ...TARGET_ONLY];
    const srcTables = await listTables(source);
    const dstTables = (await listTables(target)).filter((t) => !IGNORED_TARGET_TABLES.has(t));
    const diff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
    const problems = [
      ...diff(srcTables, expectedSrc).map((t) => `tabel "${t}" ada di Supabase tapi tidak ada di daftar impor`),
      ...diff(expectedSrc, srcTables).map((t) => `tabel "${t}" tidak ada di Supabase`),
      ...diff(expectedDst, dstTables).map((t) => `tabel "${t}" belum ada di lokal (jalankan npm run db:migrate)`),
      ...diff(dstTables, expectedDst).map((t) => `tabel lokal "${t}" tidak ada di daftar impor`),
    ];
    const columns = new Map<string, string[]>();
    for (const t of TABLES) {
      if (!srcTables.includes(t) || !dstTables.includes(t)) continue;
      const s = await listColumns(source, t);
      const d = await listColumns(target, t);
      const missing = diff(s, d), extra = diff(d, s);
      if (missing.length) problems.push(`${t}: kolom ${missing.join(", ")} ada di Supabase tapi tidak di lokal`);
      if (extra.length) problems.push(`${t}: kolom ${extra.join(", ")} ada di lokal tapi tidak di Supabase`);
      columns.set(t, d); // urutan kolom lokal; nama sama di kedua sisi
    }
    if (dstTables.includes("app_users")) {
      const d = await listColumns(target, "app_users");
      const missing = diff(APP_USER_COLUMNS, d);
      if (missing.length) problems.push(`app_users: kolom ${missing.join(", ")} belum ada di lokal`);
    }
    if (problems.length) throw new Error("Skema tidak cocok:\n  - " + problems.join("\n  - "));

    // Email/username wajib unik (tanpa beda huruf besar/kecil) karena dipakai untuk login.
    const dupes = await source.query<{ k: string; v: string; n: string }>(`
      select 'email' as k, lower(email) as v, count(*)::text as n from public.profiles group by 2 having count(*) > 1
      union all
      select 'username', lower(username), count(*)::text from public.profiles group by 2 having count(*) > 1`);
    if (dupes.rows.length) {
      throw new Error(
        "Akun di Supabase punya email/username kembar (harus unik untuk login V2):\n  - " +
          dupes.rows.map((d) => `${d.k} "${d.v}" dipakai ${d.n} akun`).join("\n  - ") +
          "\n  Ubah salah satunya di V1 (Manajemen User) lalu ulangi impor.",
      );
    }

    // ── Impor ─────────────────────────────────────────────────────────────
    await source.query("begin isolation level repeatable read read only");
    await target.query("begin");
    await target.query(`truncate ${[...TABLES, ...TARGET_ONLY].map((t) => `public.${q(t)}`).join(", ")}`);
    console.log(`→ Impor ke "${targetDb}" (semua tabel dikosongkan dalam transaksi)\n`);

    const started = Date.now();
    const report: { table: string; src: number; dst: number; ok: boolean }[] = [];

    for (const t of TABLES) {
      const cols = columns.get(t)!.map(q).join(", ");
      const out = source.query(copyTo(`copy (select ${cols} from public.${q(t)}) to stdout`));
      const into = target.query(copyFrom(`copy public.${q(t)} (${cols}) from stdin`));
      await pipeline(out, into);

      const src = await fingerprint(source, `public.${q(t)}`, columns.get(t)!);
      const dst = await fingerprint(target, `public.${q(t)}`, columns.get(t)!);
      const ok = src.rows === dst.rows && src.hash === dst.hash;
      report.push({ table: t, src: src.rows, dst: dst.rows, ok });
      console.log(`${ok ? "✓" : "✗"} ${t.padEnd(20)} ${String(dst.rows).padStart(6)} baris${ok ? "" : `  (Supabase ${src.rows}, checksum ${src.hash === dst.hash ? "sama" : "BEDA"})`}`);
    }

    // ── Akun: profiles + auth.users → app_users ─────────────────────────────
    {
      const cols = APP_USER_COLUMNS.map(q).join(", ");
      await pipeline(
        source.query(copyTo(`copy (${SOURCE_APP_USERS}) to stdout`)),
        target.query(copyFrom(`copy public.app_users (${cols}) from stdin`)),
      );
      const src = await fingerprint(source, `(${SOURCE_APP_USERS}) as x`, APP_USER_COLUMNS);
      const dst = await fingerprint(target, "public.app_users", APP_USER_COLUMNS);
      const ok = src.rows === dst.rows && src.hash === dst.hash;
      report.push({ table: "app_users", src: src.rows, dst: dst.rows, ok });
      console.log(`${ok ? "✓" : "✗"} ${"app_users".padEnd(20)} ${String(dst.rows).padStart(6)} baris  (profiles + auth.users)`);

      const orphan = await source.query<{ tanpa_auth: string; tanpa_profil: string; tanpa_password: string }>(`
        select (select count(*) from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id))::text as tanpa_auth,
               (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id))::text as tanpa_profil,
               (select count(*) from public.profiles p join auth.users u on u.id = p.id where u.encrypted_password is null)::text as tanpa_password`);
      const o = orphan.rows[0];
      if (o.tanpa_auth !== "0") console.log(`  ⚠ ${o.tanpa_auth} profil tanpa akun Supabase — tidak diimpor`);
      if (o.tanpa_profil !== "0") console.log(`  ⚠ ${o.tanpa_profil} akun Supabase tanpa profil — tidak diimpor`);
      if (o.tanpa_password !== "0") console.log(`  ⚠ ${o.tanpa_password} akun tanpa password — perlu reset oleh Super Admin`);
    }

    const total = report.reduce((n, r) => n + r.dst, 0);
    if (report.some((r) => !r.ok)) {
      throw new Error("Ada tabel yang tidak identik — impor dibatalkan (ROLLBACK).");
    }

    await target.query("commit");
    await source.query("commit");
    console.log(`\n✓ Selesai: ${report.length} tabel, ${total} baris, jumlah & checksum identik (${((Date.now() - started) / 1000).toFixed(1)} detik).`);
    console.log("  Semua sesi login lokal ikut dihapus — login ulang setelah impor.");
  } catch (err) {
    // Tujuan: ROLLBACK normal → database lokal kembali seperti sebelum impor.
    await target.query("rollback").catch(() => {});
    throw err;
  } finally {
    // Sumber TIDAK di-ROLLBACK lewat query (bisa menggantung, lihat closeQuietly); cukup diputus.
    await closeQuietly(source);
    await closeQuietly(target);
  }
}

main().catch((err) => {
  console.error("\n✗ Impor gagal:", err instanceof Error ? err.message : err);
  console.error("  Database lokal tidak berubah.");
  process.exit(1);
});
