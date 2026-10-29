import { type Kysely, sql } from "kysely";

// ══════════════════════════════════════════════════════════════════════════
// 0002 — Auth sendiri (ROADMAP Tahap 3a, ARCHITECTURE D-05)
//
// - app_users     : pengganti auth.users (Supabase) + profiles V1 dalam satu tabel.
//                   id SAMA dengan id akun Supabase; nilai role/status/theme sama dengan V1.
// - user_sessions : sesi login. Kolom id = SHA-256 dari token di cookie (token asli tidak
//                   pernah disimpan → bocornya tabel ini tidak memberi akses login).
// - profiles      : dihapus. Isinya diimpor ke app_users oleh `npm run db:import-v1`
//                   (bersama hash password dari auth.users).
// ══════════════════════════════════════════════════════════════════════════

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table app_users (
      id                    uuid default gen_random_uuid() not null,
      email                 text not null,
      username              text not null,
      nik                   text default '-'::text not null,
      password_hash         text not null,
      role                  text default 'admin'::text not null,
      status                text default 'pending'::text not null,
      theme                 text default 'dark'::text not null,
      must_change_password  boolean default false not null,
      failed_login_count    integer default 0 not null,
      locked_until          timestamp with time zone,
      last_login_at         timestamp with time zone,
      created_at            timestamp with time zone default now() not null,
      updated_at            timestamp with time zone default now() not null,
      constraint app_users_pkey primary key (id),
      constraint app_users_role_check check (role = any (array['super_admin'::text, 'admin'::text])),
      constraint app_users_status_check check (status = any (array['pending'::text, 'active'::text, 'rejected'::text])),
      constraint app_users_theme_check check (theme = any (array['dark'::text, 'light'::text])),
      constraint app_users_failed_login_count_check check (failed_login_count >= 0)
    )
  `.execute(db);
  // Login bisa pakai email ATAU username → keduanya unik tanpa beda huruf besar/kecil.
  await sql`create unique index app_users_email_key on app_users (lower(email))`.execute(db);
  await sql`create unique index app_users_username_key on app_users (lower(username))`.execute(db);
  await sql`create index idx_app_users_status on app_users (status)`.execute(db);

  await sql`
    create table user_sessions (
      id            text not null,
      user_id       uuid not null,
      created_at    timestamp with time zone default now() not null,
      expires_at    timestamp with time zone not null,
      last_seen_at  timestamp with time zone default now() not null,
      user_agent    text,
      ip            text,
      constraint user_sessions_pkey primary key (id),
      constraint user_sessions_user_id_fkey foreign key (user_id)
        references app_users (id) on delete cascade
    )
  `.execute(db);
  await sql`create index idx_user_sessions_user_id on user_sessions (user_id)`.execute(db);
  await sql`create index idx_user_sessions_expires_at on user_sessions (expires_at)`.execute(db);

  await sql`drop table profiles`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Kembalikan struktur profiles dari 0001 (kosong — isi diimpor ulang dengan db:import-v1).
  await sql`
    create table profiles (
      id          uuid not null,
      username    text not null,
      nik         text not null,
      email       text not null,
      role        text default 'admin'::text not null,
      status      text default 'pending'::text not null,
      created_at  timestamp with time zone default now(),
      updated_at  timestamp with time zone default now(),
      theme       text default 'dark'::text not null,
      constraint profiles_pkey primary key (id),
      constraint profiles_role_check check (role = any (array['super_admin'::text, 'admin'::text])),
      constraint profiles_status_check check (status = any (array['pending'::text, 'active'::text, 'rejected'::text])),
      constraint profiles_theme_check check (theme = any (array['dark'::text, 'light'::text]))
    )
  `.execute(db);
  await sql`create index idx_profiles_role on profiles using btree (role)`.execute(db);
  await sql`create index idx_profiles_status on profiles using btree (status)`.execute(db);
  await sql`drop table user_sessions`.execute(db);
  await sql`drop table app_users`.execute(db);
}
