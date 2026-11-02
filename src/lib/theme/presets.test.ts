import { describe, expect, it } from "vitest";
import { CUSTOM_TOKENS, DEFAULT_TOKENS, HEX_COLOR, contrastRatio, type ThemeMode } from "./custom";
import { THEME_PRESETS } from "./presets";
import { exportTheme, parseThemeImport } from "./share";

const KEYS = new Set<string>(CUSTOM_TOKENS.map((t) => t.key));

describe("preset warna", () => {
  it("id unik, hanya kunci dikenal, nilai #RRGGBB", () => {
    expect(new Set(THEME_PRESETS.map((p) => p.id)).size).toBe(THEME_PRESETS.length);
    for (const p of THEME_PRESETS) for (const mode of ["light", "dark"] as const) {
      for (const [k, v] of Object.entries(p[mode])) {
        expect(KEYS.has(k), `${p.id}.${mode}.${k}`).toBe(true);
        expect(HEX_COLOR.test(v as string), `${p.id}.${mode}.${k}=${v}`).toBe(true);
      }
    }
  });

  // Pasangan yang sama dengan panel "Keterbacaan" + warna status di kartu
  const pairs = (c: Record<string, string>) => [
    ["teks isi / kartu", c.text, c.surface],
    ["keterangan / kartu", c["text-muted"], c.surface],
    ["keterangan / panel", c["text-muted"], c["surface-2"]],
    ["aksen / kartu", c.accent, c.surface],
    ["aksen / latar", c.accent, c.bg],
    ["putih / tombol utama", "#FFFFFF", c["accent-solid"]],
    ["judul / latar", c["text-strong"], c.bg],
    ["CGA1 / kartu", c.cga1, c.surface],
    ["CGA2 / kartu", c.cga2, c.surface],
    ["CGA3 / kartu", c.cga3, c.surface],
    ["ungu / kartu", c.plum, c.surface],
  ] as const;

  for (const p of THEME_PRESETS) {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      it(`${p.name} (${mode}) lolos kontras AA 4.5:1`, () => {
        const c = { ...DEFAULT_TOKENS[mode], ...p[mode] } as Record<string, string>;
        const fails = pairs(c)
          .map(([label, a, b]) => [label, contrastRatio(a, b)] as const)
          .filter(([, r]) => r < 4.5)
          .map(([label, r]) => `${label} ${r.toFixed(2)}`);
        expect(fails).toEqual([]);
      });
    }
  }
});

describe("bagikan warna", () => {
  it("ekspor → impor menghasilkan tema yang sama", () => {
    const theme = { light: { accent: "#0F6E7A" }, dark: { bg: "#101010", accent: "#7CCFD8" } };
    expect(parseThemeImport(exportTheme(theme))).toEqual({ ok: true, theme });
  });
  it("menerima objek tema polos & tema kosong (= bawaan)", () => {
    expect(parseThemeImport('{"dark":{"accent":"#abcdef"}}')).toEqual({ ok: true, theme: { dark: { accent: "#ABCDEF" } } });
    expect(parseThemeImport(exportTheme(null))).toEqual({ ok: true, theme: null });
  });
  it("membuang kunci asing & nilai bukan hex", () => {
    const r = parseThemeImport('{"format":"smartwms-tema","version":1,"theme":{"light":{"accent":"red","bg":"#FFFFFF","x":"#000000","text":"url(a)"}}}');
    expect(r).toEqual({ ok: true, theme: { light: { bg: "#FFFFFF" } } });
  });
  it("menolak isi yang bukan kode warna", () => {
    for (const bad of ["", "   ", "halo", "[]", "123", '{"a":1}', '{"format":"lain","theme":{}}', '{"format":"smartwms-tema","version":99,"theme":{}}', "x".repeat(20_001)]) {
      expect(parseThemeImport(bad).ok, bad.slice(0, 30)).toBe(false);
    }
  });
});
