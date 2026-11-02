import { describe, expect, it } from "vitest";
import { buildBountySheets } from "./bountyExport";

const it_ = (as: string, jenis: string, qty: number, qty_selesai: number, tanggal: string, extra = {}) =>
  ({ as_inisial: as, jenis, qty, qty_selesai, tanggal, keterangan: "", tujuan: null, ...extra });

describe("Excel bounty", () => {
  it("ringkas per AS & detail per barang (hanya belum lunas)", () => {
    const { ringkas, detail } = buildBountySheets([
      it_("JTO", "Printer Dot Matrix", 1, 0, "2026-10-26", { keterangan: "janji", tujuan: { kode: "T001", nama: "Toko A" } }),
      it_("RDW", "Monitor", 3, 1, "2026-10-12"),
      it_("RDW", "UPS", 1, 1, "2026-10-20"),
    ], "semua AS", "2026-11-02");
    expect(ringkas).toEqual([
      ["BOUNTY HUNTER — Barang belum kembali"],
      ["Per 2 Nov 2026 · semua AS · Rp10.000/barang"],
      [],
      ["AS", "Barang belum kembali", "Bounty"],
      ["RDW", 2, 20000],
      ["JTO", 1, 10000],
      ["TOTAL", 3, 30000],
    ]);
    expect(detail.slice(4)).toEqual([
      [1, "RDW", "Monitor", 2, 3, "", "12 Okt 2026", 21, 20000, ""],
      ["", "Subtotal RDW", "", 2, "", "", "", "", 20000, ""],
      [2, "JTO", "Printer Dot Matrix", 1, 1, "T001 Toko A", "26 Okt 2026", 7, 10000, "janji"],
      ["", "Subtotal JTO", "", 1, "", "", "", "", 10000, ""],
      ["", "TOTAL", "", 3, "", "", "", "", 30000, ""],
    ]);
  });
});
