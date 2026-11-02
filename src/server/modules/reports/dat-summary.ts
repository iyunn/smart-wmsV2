import "server-only";
import { db } from "@/server/db";
import { WAREHOUSE_COST_CENTERS } from "@/lib/types";
import { type MonitoringFilters, filterAssets } from "@/lib/monitoringFilter";

// Data Rekap DAT (PDF): toko → kategori_oracle → jenis. Agregasi sama dengan V1.
// Dengan `filters` (Export PDF dari Monitoring), baris disaring dengan fungsi yang SAMA dengan
// tabel di layar (src/lib/monitoringFilter.ts) sebelum diagregasi.

type JenisData = { jenis: string; item: number; qty: number; perolehan: number; tercatat: number };
type KategoriData = { kategori: string; items: JenisData[]; totalItem: number; totalQty: number; totalPerolehan: number; totalTercatat: number };
export type TokoData = { toko: string; tokoCode: string; kategoris: KategoriData[]; totalItem: number; totalQty: number; totalPerolehan: number; totalTercatat: number };

export async function getDATSummary(costCenter: string | null, filters?: MonitoringFilters): Promise<TokoData[]> {
  const centers = costCenter && costCenter !== "ALL" ? [costCenter] : [...WAREHOUSE_COST_CENTERS];

  const all = await db
    .selectFrom("assets_raw as r")
    .leftJoin("assets_clean as c", "c.raw_id", "r.id")
    .leftJoin("asset_notes as n", "n.kode_asset", "r.kode_asset")
    .select([
      "r.toko", "r.kategori_oracle", "r.kuantitas", "r.biaya_perolehan", "r.jumlah_tercatat", "c.jenis",
      "c.merk", "r.kode_asset", "r.deskripsi", "r.invoice_number", "n.catatan",
    ])
    // V1: toko ILIKE 'CGA1%' OR ... (awalan, tanpa beda huruf besar/kecil)
    .where((eb) => eb.or(centers.map((c) => eb("r.toko", "ilike", `${c.replace(/[\\%_]/g, "\\$&")}%`))))
    .orderBy("r.kode_asset")
    .execute();

  // Disaring dengan nilai yang dinormalkan sama seperti data Monitoring (listMonitoringAssets):
  // jenis/merk kosong → "Unknown", teks lain kosong → "" — supaya hasil filter identik dengan layar.
  const rows = filters
    ? filterAssets(
        all.map((r) => ({
          row: r,
          toko: r.toko ?? "",
          jenis: r.jenis ?? "Unknown",
          merk: r.merk ?? "Unknown",
          kode_asset: r.kode_asset ?? "",
          kategori_oracle: r.kategori_oracle ?? "",
          deskripsi: r.deskripsi ?? "",
          invoice_number: r.invoice_number ?? "",
          catatan: r.catatan ?? "",
        })),
        filters,
      ).map((v) => v.row)
    : all;

  const tokoMap = new Map<string, Map<string, Map<string, JenisData>>>();
  for (const row of rows) {
    const toko = row.toko ?? "Unknown";
    const kategori = row.kategori_oracle ?? "Unknown";
    const jenis = row.jenis ?? "Unknown";
    if (!tokoMap.has(toko)) tokoMap.set(toko, new Map());
    const kMap = tokoMap.get(toko)!;
    if (!kMap.has(kategori)) kMap.set(kategori, new Map());
    const jMap = kMap.get(kategori)!;
    if (!jMap.has(jenis)) jMap.set(jenis, { jenis, item: 0, qty: 0, perolehan: 0, tercatat: 0 });
    const d = jMap.get(jenis)!;
    d.item++;
    d.qty += row.kuantitas ?? 1;
    d.perolehan += row.biaya_perolehan ?? 0;
    d.tercatat += row.jumlah_tercatat ?? 0;
  }

  const report: TokoData[] = [];
  for (const [toko, kMap] of tokoMap) {
    const tokoCode = toko.split(" - ")[0]?.trim() ?? toko;
    const kategoris: KategoriData[] = [];
    let ti = 0, tq = 0, tp = 0, tt = 0;
    for (const [kategori, jMap] of kMap) {
      const items = [...jMap.values()].sort((a, b) => a.jenis.localeCompare(b.jenis));
      const t = items.reduce((acc, i) => ({
        item: acc.item + i.item, qty: acc.qty + i.qty, perolehan: acc.perolehan + i.perolehan, tercatat: acc.tercatat + i.tercatat,
      }), { item: 0, qty: 0, perolehan: 0, tercatat: 0 });
      kategoris.push({ kategori, items, totalItem: t.item, totalQty: t.qty, totalPerolehan: t.perolehan, totalTercatat: t.tercatat });
      ti += t.item; tq += t.qty; tp += t.perolehan; tt += t.tercatat;
    }
    kategoris.sort((a, b) => a.kategori.localeCompare(b.kategori));
    report.push({ toko, tokoCode, kategoris, totalItem: ti, totalQty: tq, totalPerolehan: tp, totalTercatat: tt });
  }
  report.sort((a, b) => a.tokoCode.localeCompare(b.tokoCode));
  return report;
}
