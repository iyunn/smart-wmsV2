# SmartWMS V2

Sistem monitoring, rekonsiliasi, dan Surat Jalan aset gudang CGA (CGA1/CGA2/CGA3) untuk divisi
General Affairs — versi lokal/on-premise yang berjalan di PC kantor dan diakses lewat LAN.

> Lanjutan dari SmartWMS V1 (cloud, Vercel + Supabase):
> [`iyunn/smart-warehouse-management-system`](https://github.com/iyunn/smart-warehouse-management-system),
> versi Tugas Akhir di tag `v1.0-cloud-ta`.

## Status

Dalam pengembangan. Tahap aktif dan progres: [`docs/v2/ROADMAP.md`](docs/v2/ROADMAP.md).
Sejak Tahap 4 seluruh data diakses lewat PostgreSQL lokal (Kysely); Supabase hanya dipakai sebagai
sumber `npm run db:import-v1` sampai cutover.

## Dokumen

| Dokumen | Isi |
|---|---|
| [`docs/v2/PRD.md`](docs/v2/PRD.md) | Scope, requirement, kriteria cutover |
| [`docs/v2/ARCHITECTURE.md`](docs/v2/ARCHITECTURE.md) | Keputusan teknis (D-xx), struktur folder, konvensi kode |
| [`docs/v2/ROADMAP.md`](docs/v2/ROADMAP.md) | Tahapan kerja & status |
| [`docs/v2/STYLEGUIDE.md`](docs/v2/STYLEGUIDE.md) | Aturan tampilan (light & dark) |
| [`docs/v2/DEPLOY-LOKAL.md`](docs/v2/DEPLOY-LOKAL.md) | Runbook server: instalasi, update, rollback, troubleshooting |
| [`docs/chat-rule.md`](docs/chat-rule.md) | Pola kerja pengembangan |
| [`docs/development-journal.md`](docs/development-journal.md) | Riwayat pengembangan (append-only) |
| [`docs/project_context.md`](docs/project_context.md) | Snapshot fitur & skema (V1, sampai cutover) |

## Stack target

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL 18 · Kysely · Windows Service (WinSW)

## Menjalankan (development)

Prasyarat: Node.js 24 LTS, PostgreSQL 18.

```bash
cp .env.example .env.local        # isi password & key
psql -U postgres -v dbname=smartwms_dev -v owner_pw='...' -v app_pw='...' -f deploy/windows/setup-db.sql
npm install
npm run db:migrate -- check       # tes koneksi
npm run db:migrate                # terapkan migrasi
npm run dev                       # http://localhost:3001
```

| Script | Fungsi |
|---|---|
| `npm run dev` | Server development (port 3001) |
| `npm run db:migrate [-- latest\|down\|status\|check]` | Migrasi skema |
| `npm run db:codegen` | Generate tipe `src/server/db/types.ts` dari skema |
| `npm run db:import-v1 -- --confirm <db>` | Salin data Supabase V1 → database lokal (menimpa isi tabel) |
| `npm test` | Unit test (Vitest) |

## Menjalankan (produksi, PC server)

PowerShell Administrator, dari folder repo — detail di [`docs/v2/DEPLOY-LOKAL.md`](docs/v2/DEPLOY-LOKAL.md):

```powershell
powershell -ExecutionPolicy Bypass -File deploy\windows\setup-server.ps1   # sekali
powershell -ExecutionPolicy Bypass -File deploy\windows\deploy.ps1         # setiap rilis
```

Aplikasi berjalan sebagai Windows Service `SmartWMS` di `http://<IP-server>:3000`.
