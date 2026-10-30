import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";
import { WAREHOUSE_LABELS } from "@/lib/types";
import { extractCGACodeOrSelf } from "@/server/modules/assets/cga";

// Dashboard: ringkasan klasifikasi, breakdown per CGA, peringatan alokasi, rekap pengiriman.
// Bentuk respons sama dengan V1. Hitungan & agregasi dikerjakan PostgreSQL (D-10) — V1 menarik
// ribuan baris lewat pagination loop lalu menghitung di JavaScript.

const count = (n: unknown) => Number(n ?? 0);

export async function getDashboardStats() {
  // Tanggal berbasis WIB (UTC+7) — sama dengan V1.
  const now = new Date();
  const nowWIB = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayIso = nowWIB.toISOString().slice(0, 10);
  const monthStartIso = todayIso.slice(0, 7) + "-01";
  const bulanLabel = nowWIB.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const [counts, breakdownRows, mutasi, topJenis, daily] = await Promise.all([
    sql<{
      total_asset: string; total_unknown: string; dat_update: string | null;
      belum_input: string; belum_mutasi_oracle: string; belum_mutasi_wt: string;
    }>`
      select
        (select count(*) from assets_raw)                                                    as total_asset,
        (select count(*) from assets_clean where jenis = 'Unknown' or merk = 'Unknown')      as total_unknown,
        (select max(uploaded_at) from assets_raw)                                            as dat_update,
        (select count(*) from surat_jalan_items where is_aktiva = true and kode_asset is null)      as belum_input,
        (select count(*) from surat_jalan_items where is_aktiva = true and mutasi_oracle_status = false) as belum_mutasi_oracle,
        (select count(*) from surat_jalan_items where is_aktiva = true and mutasi_wt_status = false)     as belum_mutasi_wt
    `.execute(db),

    // Breakdown per CGA — sumber sama dengan Monitoring (assets_clean ⨝ assets_raw).
    db
      .selectFrom("assets_clean as c")
      .innerJoin("assets_raw as r", "r.id", "c.raw_id")
      .select([
        "r.toko",
        (eb) => eb.fn.countAll<string>().as("items"),
        sql<string>`coalesce(sum(r.kuantitas), 0)`.as("qty"),
        sql<string>`coalesce(sum(r.biaya_perolehan), 0)`.as("perolehan"),
        sql<string>`coalesce(sum(r.jumlah_tercatat), 0)`.as("tercatat"),
      ])
      .groupBy("r.toko")
      .execute(),

    // Card 1: item AT pada SJ keluar submitted/completed.
    sql<{ total: string; sudah: string; oldest_unmutated: string | null }>`
      select count(*) as total,
             count(*) filter (where i.mutasi_oracle_status) as sudah,
             min(s.tanggal) filter (where not coalesce(i.mutasi_oracle_status, false)) as oldest_unmutated
      from surat_jalan_items i join surat_jalan s on s.id = i.sj_id
      where i.is_aktiva = true and s.jenis <> 'masuk' and s.status in ('submitted', 'completed')
    `.execute(db),

    // Card 2: top 5 jenis keluar bulan berjalan (semua item, tanpa filter kode aset).
    sql<{ jenis: string; total: string }>`
      select btrim(i.jenis) as jenis, count(*) as total
      from surat_jalan_items i join surat_jalan s on s.id = i.sj_id
      where s.status in ('submitted', 'completed') and s.tanggal between ${monthStartIso}::date and ${todayIso}::date
        and coalesce(btrim(i.jenis), '') <> ''
      group by 1 order by 2 desc, 1 asc limit 5
    `.execute(db),

    // Card 3: jumlah item per tanggal bulan berjalan.
    sql<{ tanggal: string; total: string }>`
      select s.tanggal::text as tanggal, count(*) as total
      from surat_jalan_items i join surat_jalan s on s.id = i.sj_id
      where s.status in ('submitted', 'completed') and s.tanggal between ${monthStartIso}::date and ${todayIso}::date
      group by 1
    `.execute(db),
  ]);

  // ── Breakdown per CGA (regex sama dengan Monitoring) ──────────────────────
  const map = new Map<string, { code: string; label: string; items: number; qty: number; perolehan: number; tercatat: number }>();
  for (const r of breakdownRows) {
    const code = extractCGACodeOrSelf(r.toko);
    const b = map.get(code) ?? {
      code, label: (WAREHOUSE_LABELS as Record<string, string>)[code] ?? code, items: 0, qty: 0, perolehan: 0, tercatat: 0,
    };
    b.items += count(r.items);
    b.qty += count(r.qty);
    b.perolehan += count(r.perolehan);
    b.tercatat += count(r.tercatat);
    map.set(code, b);
  }
  const breakdown = [...map.values()].sort((a, b) => a.code.localeCompare(b.code));

  // ── Card 1: progres mutasi ────────────────────────────────────────────────
  const m = mutasi.rows[0];
  const totalAT = count(m?.total);
  const sudah = count(m?.sudah);
  let terlamaHari: number | null = null;
  if (m?.oldest_unmutated) {
    const diffMs = now.getTime() - new Date(m.oldest_unmutated).getTime();
    terlamaHari = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // ── Card 3: isi semua tanggal 1..hari ini dengan 0 ───────────────────────
  const dailyMap = new Map(daily.rows.map((r) => [r.tanggal, count(r.total)]));
  const dailyShipment: { tanggal: string; total: number }[] = [];
  {
    const [y, mo] = monthStartIso.split("-").map(Number);
    const [ey, em, ed] = todayIso.split("-").map(Number);
    let cy = y, cm = mo, cd = 1;
    while (cy < ey || (cy === ey && cm < em) || (cy === ey && cm === em && cd <= ed)) {
      const iso = `${cy}-${String(cm).padStart(2, "0")}-${String(cd).padStart(2, "0")}`;
      dailyShipment.push({ tanggal: iso, total: dailyMap.get(iso) ?? 0 });
      cd++;
      const daysInMonth = new Date(cy, cm, 0).getDate();
      if (cd > daysInMonth) { cd = 1; cm++; if (cm > 12) { cm = 1; cy++; } }
    }
  }

  const c = counts.rows[0];
  const totalAsset = count(c?.total_asset);
  const totalUnknown = count(c?.total_unknown);
  const totalClassified = totalAsset - totalUnknown;

  return {
    summary: {
      totalAsset,
      totalUnknown,
      totalClassified,
      completionPct: totalAsset === 0 ? 0 : Math.round((totalClassified / totalAsset) * 100),
    },
    dataStatus: { datUpdate: c?.dat_update ?? null, datClosing: null, lppUpdate: null, lppClosing: null },
    breakdown,
    warnings: {
      belumInputKodeAset: count(c?.belum_input),
      belumMutasiOracle: count(c?.belum_mutasi_oracle),
      belumMutasiWT: count(c?.belum_mutasi_wt),
    },
    rekapPengiriman: {
      mutasiProgress: {
        totalAT,
        sudahMutasi: sudah,
        belumMutasi: totalAT - sudah,
        progressPct: totalAT === 0 ? 0 : Math.round((sudah / totalAT) * 100),
        terlamaHari,
      },
      topJenisBelumAlokasi: topJenis.rows.map((r) => ({ jenis: r.jenis, total: count(r.total) })),
      dailyShipment,
      bulanLabel,
    },
  };
}
