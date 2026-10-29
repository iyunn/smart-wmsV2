#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
# Snapshot skema + jumlah baris dari Supabase (V1) — READ-ONLY.
# ROADMAP Tahap 2a. Jalankan dari root repo:   bash scripts/v1/snapshot.sh
#
# Butuh di .env.local:
#   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres
#   (Supabase Dashboard → Connect → "Session pooler". BUKAN port 6543 / transaction pooler.)
# Hasil (aman di-commit, tidak berisi data/password):
#   db/v1-snapshot/schema.sql      — struktur tabel, index, constraint, function, policy
#   db/v1-snapshot/row-counts.txt  — jumlah baris per tabel + info akun
# ══════════════════════════════════════════════════════════════════════════
set -euo pipefail

PGBIN="${PGBIN:-/c/Program Files/PostgreSQL/18/bin}"
OUT="db/v1-snapshot"

if [[ ! -f .env.local ]]; then
  echo "✗ .env.local tidak ditemukan. Jalankan dari root repo." >&2; exit 1
fi

# Ambil nilai tanpa men-source seluruh file (password bisa berisi karakter shell);
# buang \r kalau .env.local disimpan dengan CRLF, dan tanda kutip pembungkus.
COUNT="$(grep -cE '^SUPABASE_DB_URL=' .env.local || true)"
if [[ "$COUNT" -gt 1 ]]; then
  echo "✗ Ada $COUNT baris SUPABASE_DB_URL di .env.local — sisakan satu saja." >&2; exit 1
fi
SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | head -n1 | cut -d= -f2- | tr -d '\r' || true)"
SUPABASE_DB_URL="${SUPABASE_DB_URL%\"}"; SUPABASE_DB_URL="${SUPABASE_DB_URL#\"}"
SUPABASE_DB_URL="${SUPABASE_DB_URL%\'}"; SUPABASE_DB_URL="${SUPABASE_DB_URL#\'}"
if [[ -z "$SUPABASE_DB_URL" ]]; then
  echo "✗ SUPABASE_DB_URL belum diisi di .env.local (lihat .env.example)." >&2; exit 1
fi
if [[ "$SUPABASE_DB_URL" == *"[YOUR-PASSWORD]"* || "$SUPABASE_DB_URL" == *"["*"]"*"@"* ]]; then
  echo "✗ Placeholder [YOUR-PASSWORD] belum diganti (hapus juga tanda [ ])." >&2; exit 1
fi

if [[ ! -x "$PGBIN/pg_dump" && ! -x "$PGBIN/pg_dump.exe" ]]; then
  echo "✗ pg_dump tidak ditemukan di: $PGBIN" >&2
  echo "  Set lokasi lain, contoh: PGBIN=\"/c/Program Files/PostgreSQL/17/bin\" bash scripts/v1/snapshot.sh" >&2
  exit 1
fi

mkdir -p "$OUT"

echo "→ Dump skema public..."
"$PGBIN/pg_dump" "$SUPABASE_DB_URL" \
  --schema-only --schema=public --no-owner --no-privileges \
  --file="$OUT/schema.sql"

echo "→ Hitung jumlah baris..."
"$PGBIN/psql" "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 \
  -f scripts/v1/snapshot-counts.sql > "$OUT/row-counts.txt"

echo "✓ Selesai:"
echo "  $OUT/schema.sql      ($(wc -l < "$OUT/schema.sql") baris)"
echo "  $OUT/row-counts.txt"
echo
cat "$OUT/row-counts.txt"
