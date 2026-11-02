import { describe, expect, it } from "vitest";
import { BOUNTY_PER_BARANG, INISIAL_PATTERN, formatRupiah, nilaiBounty, normalizeInisial, sisaBarang, todayWib } from "./bounty";

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
});
