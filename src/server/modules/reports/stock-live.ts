import "server-only";
import { db } from "@/server/db";
import { extractCGA } from "@/server/modules/assets/cga";

// Live Stock: jumlah item per jenis, CGA1 + CGA2 saja (CGA3 = calon musnah, bukan stock).
// Agregasi sama persis dengan V1 (dihitung di JS dari 1 query join); tipe respons
// diekspor ulang dari sini supaya halaman tetap bisa mengimpornya.

export interface MerkCount { merk: string; count: number }
export interface SubCoceCount { subCoce: string; count: number }
export interface JenisStock {
  jenis: string; kategori: string; total: number; cga1: number; cga2: number;
  merkBreakdown: MerkCount[];
  nonProdsus: number; nonProdsusCga1: number; nonProdsusCga2: number;
  prodsus: number; prodsusCga1: number; prodsusCga2: number;
  prodsusBreakdown: SubCoceCount[];
}
export interface LiveStockResponse {
  success: boolean; jenisList: JenisStock[]; totalStock: number; totalCGA1: number; totalCGA2: number;
  updatedAt: string | null; error?: string;
}

export async function getLiveStock(): Promise<LiveStockResponse> {
  const [rows, last] = await Promise.all([
    db
      .selectFrom("assets_clean as c")
      .innerJoin("assets_raw as r", "r.id", "c.raw_id")
      .select(["c.jenis", "c.merk", "r.toko", "r.kategori_oracle", "r.sub_coce"])
      .orderBy("r.kode_asset")
      .execute(),
    db.selectFrom("assets_raw").select((eb) => eb.fn.max("uploaded_at").as("t")).executeTakeFirst(),
  ]);

  const jenisMap = new Map<string, {
    total: number; cga1: number; cga2: number; kategori: string; merk: Map<string, number>;
    nonProdsus: number; nonProdsusCga1: number; nonProdsusCga2: number;
    prodsus: number; prodsusCga1: number; prodsusCga2: number; subCoce: Map<string, number>;
  }>();
  let totalCGA1 = 0;
  let totalCGA2 = 0;

  for (const row of rows) {
    const cga = extractCGA(row.toko);
    if (cga !== "CGA1" && cga !== "CGA2") continue;

    const jenis = (row.jenis ?? "").trim() || "Unknown";
    const merk = (row.merk ?? "").trim() || "Unknown";
    const kategori = (row.kategori_oracle ?? "").trim() || "Tanpa Kategori";
    const subCoce = (row.sub_coce ?? "0").toString().trim() || "0";
    const isProdsus = !/^0*$/.test(subCoce);

    let j = jenisMap.get(jenis);
    if (!j) {
      j = {
        total: 0, cga1: 0, cga2: 0, kategori, merk: new Map(),
        nonProdsus: 0, nonProdsusCga1: 0, nonProdsusCga2: 0,
        prodsus: 0, prodsusCga1: 0, prodsusCga2: 0, subCoce: new Map(),
      };
      jenisMap.set(jenis, j);
    }
    j.total += 1;
    if (cga === "CGA1") { j.cga1 += 1; totalCGA1 += 1; } else { j.cga2 += 1; totalCGA2 += 1; }
    j.merk.set(merk, (j.merk.get(merk) ?? 0) + 1);
    if (isProdsus) {
      j.prodsus += 1;
      if (cga === "CGA1") j.prodsusCga1 += 1; else j.prodsusCga2 += 1;
      j.subCoce.set(subCoce, (j.subCoce.get(subCoce) ?? 0) + 1);
    } else {
      j.nonProdsus += 1;
      if (cga === "CGA1") j.nonProdsusCga1 += 1; else j.nonProdsusCga2 += 1;
    }
  }

  const jenisList: JenisStock[] = [...jenisMap.entries()]
    .map(([jenis, v]) => ({
      jenis,
      kategori: v.kategori,
      total: v.total,
      cga1: v.cga1,
      cga2: v.cga2,
      merkBreakdown: [...v.merk.entries()].map(([merk, count]) => ({ merk, count }))
        .sort((a, b) => b.count - a.count || a.merk.localeCompare(b.merk)),
      nonProdsus: v.nonProdsus,
      nonProdsusCga1: v.nonProdsusCga1,
      nonProdsusCga2: v.nonProdsusCga2,
      prodsus: v.prodsus,
      prodsusCga1: v.prodsusCga1,
      prodsusCga2: v.prodsusCga2,
      prodsusBreakdown: [...v.subCoce.entries()].map(([subCoce, count]) => ({ subCoce, count }))
        .sort((a, b) => b.count - a.count || a.subCoce.localeCompare(b.subCoce)),
    }))
    .sort((a, b) => b.total - a.total || a.jenis.localeCompare(b.jenis));

  return {
    success: true,
    jenisList,
    totalStock: totalCGA1 + totalCGA2,
    totalCGA1,
    totalCGA2,
    updatedAt: (last?.t as string | null | undefined) ?? null,
  };
}
