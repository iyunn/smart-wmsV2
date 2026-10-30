import { describe, expect, it } from "vitest";
import { nextNoSJFrom, noSJPrefix } from "./no-sj";

describe("nomor Surat Jalan", () => {
  it("prefix mengikuti tahun & bulan tanggal SJ (bukan hari ini)", () => {
    expect(noSJPrefix("2026-03-15")).toBe("SJ-Manual/CGA/2026/03/");
    expect(noSJPrefix("2025-12-31")).toBe("SJ-Manual/CGA/2025/12/");
    expect(noSJPrefix("2026-01-01T00:30:00")).toBe("SJ-Manual/CGA/2026/01/");
  });

  it("nomor pertama di bulan baru = 0001", () => {
    expect(nextNoSJFrom("SJ-Manual/CGA/2026/03/", null)).toBe("SJ-Manual/CGA/2026/03/0001");
  });

  it("melanjutkan nomor terakhir, 4 digit", () => {
    expect(nextNoSJFrom("SJ-Manual/CGA/2026/03/", "SJ-Manual/CGA/2026/03/0009")).toBe("SJ-Manual/CGA/2026/03/0010");
    expect(nextNoSJFrom("SJ-Manual/CGA/2026/03/", "SJ-Manual/CGA/2026/03/0123")).toBe("SJ-Manual/CGA/2026/03/0124");
  });
});
