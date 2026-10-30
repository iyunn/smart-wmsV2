import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUSTOM_TOKENS, DEFAULT_TOKENS, THEME_BOOT_SCRIPT, contrastRatio, diffFromDefault, sanitizeCustomTheme,
} from "./custom";

const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");
function block(selector: string): string {
  const start = css.indexOf(selector);
  return css.slice(start, css.indexOf("\n}", start));
}

describe("tema custom", () => {
  it("nilai bawaan sama dengan token di globals.css", () => {
    const blocks = { light: block(":root,\n.light {"), dark: block(".dark {\n") };
    for (const mode of ["light", "dark"] as const) {
      for (const t of CUSTOM_TOKENS) {
        const m = new RegExp(`--${t.key}:\\s*(#[0-9A-Fa-f]{6})`).exec(blocks[mode]);
        expect(m?.[1]?.toUpperCase(), `${mode} --${t.key}`).toBe(DEFAULT_TOKENS[mode][t.key].toUpperCase());
      }
    }
  });

  it("setiap warna dasar dipakai di blok turunan :root.theme-custom atau sebagai token langsung", () => {
    const custom = block(":root.theme-custom {");
    for (const t of CUSTOM_TOKENS) {
      expect(custom.includes(`var(--${t.key})`) || css.includes(`var(--${t.key})`), t.key).toBe(true);
    }
  });

  it("sanitasi: buang kunci asing, nilai bukan #RRGGBB, dan set kosong", () => {
    expect(sanitizeCustomTheme(null)).toBeNull();
    expect(sanitizeCustomTheme({ light: { accent: "red" } })).toBeNull();
    expect(sanitizeCustomTheme({ light: { accent: "#0f766e", hacker: "#000000", bg: "url(x)" }, evil: {} }))
      .toEqual({ light: { accent: "#0F766E" } });
    expect(sanitizeCustomTheme({ dark: { cga1: "#00FF00" }, light: [] })).toEqual({ dark: { cga1: "#00FF00" } });
  });

  it("hanya warna yang berbeda dari bawaan yang disimpan", () => {
    const set = { ...DEFAULT_TOKENS.light, accent: "#0F766E" };
    expect(diffFromDefault("light", set)).toEqual({ accent: "#0F766E" });
    expect(diffFromDefault("dark", DEFAULT_TOKENS.dark)).toBeUndefined();
  });

  it("rasio kontras WCAG", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrastRatio("#2A2420", "#FFFFFF")).toBeGreaterThan(15);
  });

  it("skrip anti-flash valid JavaScript", () => {
    expect(() => new Function(THEME_BOOT_SCRIPT)).not.toThrow();
  });
});
