// ══════════════════════════════════════════════════════════════════════════
// Export Excel Bounty Hunter (Tahap 9i) — utang BELUM lunas, sesuai filter AS/cari di halaman.
// Dibuat untuk di-copy ke WhatsApp sebagai gambar: blok rapi tanpa kolom teknis.
//   Sheet "Per AS"  → ringkas: AS · barang belum kembali · bounty (+ total)   ← paling pas untuk WA
//   Sheet "Detail"  → per barang: AS, barang, sisa, dari, toko, sejak, umur, bounty, keterangan
// xlsx (SheetJS CE) tidak menulis warna/huruf tebal → tampilan dirapikan lewat lebar kolom,
// gabung sel judul, dan format angka Rupiah.
// ══════════════════════════════════════════════════════════════════════════

import * as XLSX from "xlsx";
import { type WaItem, BOUNTY_PER_BARANG, groupOpenByAs, sisaBarang, tglIndo, todayWib, umurHari } from "./bounty";

type Cell = string | number;

export interface BountySheets {
  ringkas: Cell[][];
  detail: Cell[][];
}

export const DETAIL_HEADER = ["No", "AS", "Barang", "Sisa", "Dari", "Toko", "Sejak", "Umur (hari)", "Bounty", "Keterangan"] as const;

export function buildBountySheets(items: WaItem[], scope: string, today = todayWib()): BountySheets {
  const groups = groupOpenByAs(items);
  const title = "BOUNTY HUNTER — Barang belum kembali";
  const sub = `Per ${tglIndo(today)}${scope ? ` · ${scope}` : ""} · Rp${BOUNTY_PER_BARANG.toLocaleString("id-ID")}/barang`;
  const total = groups.reduce((n, g) => n + g.bounty, 0);
  const totalSisa = groups.reduce((n, g) => n + g.sisa, 0);

  const ringkas: Cell[][] = [[title], [sub], [], ["AS", "Barang belum kembali", "Bounty"]];
  for (const g of groups) ringkas.push([g.as, g.sisa, g.bounty]);
  ringkas.push(["TOTAL", totalSisa, total]);

  const detail: Cell[][] = [[title], [sub], [], [...DETAIL_HEADER]];
  let no = 0;
  for (const g of groups) {
    for (const it of g.list) {
      const s = sisaBarang(it);
      detail.push([
        ++no, g.as, it.jenis, s, it.qty,
        it.tujuan ? `${it.tujuan.kode} ${it.tujuan.nama}`.trim() : "",
        tglIndo(it.tanggal), umurHari(it.tanggal, today), s * BOUNTY_PER_BARANG, it.keterangan,
      ]);
    }
    detail.push(["", `Subtotal ${g.as}`, "", g.sisa, "", "", "", "", g.bounty, ""]);
  }
  detail.push(["", "TOTAL", "", totalSisa, "", "", "", "", total, ""]);
  return { ringkas, detail };
}

const RUPIAH = '"Rp"#,##0';

function sheet(aoa: Cell[][], widths: number[], rupiahCol: number) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  const last = widths.length - 1;
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: last } }, { s: { r: 1, c: 0 }, e: { r: 1, c: last } }];
  for (let r = 4; r < aoa.length; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: rupiahCol });
    if (ws[ref] && typeof ws[ref].v === "number") ws[ref].z = RUPIAH;
  }
  return ws;
}

export function exportBountyExcel(items: WaItem[], scope: string, filenameScope: string): void {
  const { ringkas, detail } = buildBountySheets(items, scope);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(ringkas, [14, 22, 16], 2), "Per AS");
  XLSX.utils.book_append_sheet(wb, sheet(detail, [5, 10, 26, 6, 6, 28, 13, 11, 13, 40], 8), "Detail");
  const slug = filenameScope.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  XLSX.writeFile(wb, `Bounty-Belum-Kembali${slug ? "-" + slug : ""}-${todayWib()}.xlsx`);
}
