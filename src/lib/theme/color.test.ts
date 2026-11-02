import { describe, expect, it } from "vitest";
import { DEFAULT_TOKENS } from "./custom";
import { THEME_PRESETS } from "./presets";
import { angleToHue, hexToHsv, hsvToHex } from "./color";

describe("konversi warna", () => {
  it("hex → hsv → hex kembali sama (semua warna bawaan & preset)", () => {
    const all = new Set<string>(["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#808080", "#123456"]);
    for (const m of ["light", "dark"] as const) {
      Object.values(DEFAULT_TOKENS[m]).forEach((v) => all.add(v));
      THEME_PRESETS.forEach((p) => Object.values(p[m]).forEach((v) => all.add(v as string)));
    }
    for (const hex of all) expect(hsvToHex(hexToHsv(hex)), hex).toBe(hex.toUpperCase());
  });
  it("nilai acuan", () => {
    expect(hexToHsv("#FF0000")).toEqual({ h: 0, s: 100, v: 100 });
    expect(hsvToHex({ h: 120, s: 100, v: 100 })).toBe("#00FF00");
    expect(hsvToHex({ h: 240, s: 100, v: 50 })).toBe("#000080");
    expect(hsvToHex({ h: 360, s: 100, v: 100 })).toBe("#FF0000"); // 360 = 0
    expect(hsvToHex({ h: 30, s: 150, v: -5 })).toBe("#000000");   // di luar batas dijepit
  });
  it("sudut roda: atas = 0°, kanan = 90°, bawah = 180°, kiri = 270°", () => {
    expect(angleToHue(0, -1)).toBeCloseTo(0);
    expect(angleToHue(1, 0)).toBeCloseTo(90);
    expect(angleToHue(0, 1)).toBeCloseTo(180);
    expect(angleToHue(-1, 0)).toBeCloseTo(270);
  });
});
