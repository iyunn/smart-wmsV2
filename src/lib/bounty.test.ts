import { describe, expect, it } from "vitest";
import { BOUNTY_PER_BARANG, INISIAL_PATTERN, buildWaMessage, formatRupiah, nilaiBounty, normalizeInisial, sisaBarang, todayWib, waLink } from "./bounty";

describe("bounty", () => {
  it("inisial dirapikan jadi huruf besar", () => {
    expect(normalizeInisial("  jto ")).toBe("JTO");
    expect(normalizeInisial("as  budi")).toBe("AS BUDI");
    for (const ok of ["JTO", "A1", "AS-02", "J.T.O"]) expect(INISIAL_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ["", " JTO", "-JT", "JTO!", "A".repeat(17), "jto"]) expect(INISIAL_PATTERN.test(bad), bad).toBe(false);
  });
  it("nilai = Rp10.000 × sisa barang (selesai sebagian mengurangi)", () => {
    expect(BOUNTY_PER_BARANG).toBe(10_000);
    expect(sisaBarang({ qty: 2, qty_selesai: 1 })).toBe(1);
    expect(nilaiBounty([{ qty: 2, qty_selesai: 0 }, { qty: 3, qty_selesai: 1 }, { qty: 1, qty_selesai: 1 }])).toBe(40_000);
    expect(nilaiBounty([])).toBe(0);
    expect(formatRupiah(40_000)).toBe("Rp40.000");
  });
  it("tanggal hari ini memakai WIB, bukan UTC", () => {
    // 2 Nov 2026 20:30 UTC = 3 Nov 2026 03:30 WIB
    expect(todayWib(new Date("2026-11-02T20:30:00Z"))).toBe("2026-11-03");
    expect(todayWib(new Date("2026-11-02T10:00:00Z"))).toBe("2026-11-02");
  });

  it("pesan WA: hanya belum lunas, per AS urut bounty terbesar, sebagian ditulis", () => {
    const it = (as: string, jenis: string, qty: number, qty_selesai: number, tanggal: string, extra = {}) =>
      ({ as_inisial: as, jenis, qty, qty_selesai, tanggal, keterangan: "", tujuan: null, ...extra });
    const msg = buildWaMessage([
      it("JTO", "Printer Dot Matrix", 1, 0, "2026-10-26", { keterangan: "janji minggu depan", tujuan: { kode: "T001", nama: "Toko A" } }),
      it("RDW", "Monitor", 3, 1, "2026-10-12"),
      it("RDW", "UPS", 1, 1, "2026-10-20"),          // lunas → tidak ikut
      it("ABS", "Scanner", 1, 0, "2026-11-02"),
    ], "2026-11-02");
    expect(msg).toBe([
      "*Bounty belum kembali* — 2 Nov 2026",
      "*RDW* Rp20.000",
      "• Monitor ×2 dari 3 · 21 hari",
      "*ABS* Rp10.000",
      "• Scanner ×1 · hari ini",
      "*JTO* Rp10.000",
      "• Printer Dot Matrix ×1 · T001 · 7 hari",
      "",
      "Total Rp40.000 — mohon segera dikembalikan 🙏",
    ].join("\n"));
    expect(buildWaMessage([it("JTO", "Printer", 1, 0, "2026-11-02")], "2026-11-02"))
      .toBe("*Bounty belum kembali* — 2 Nov 2026\n*JTO* Rp10.000\n• Printer ×1 · hari ini\n\nMohon segera dikembalikan 🙏");
    expect(buildWaMessage([it("X", "Y", 1, 1, "2026-11-01")], "2026-11-02")).toBe("");
    expect(waLink("a b&c\n🙏")).toBe("https://wa.me/?text=a%20b%26c%0A%F0%9F%99%8F");
  });
});
