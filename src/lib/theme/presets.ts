// ══════════════════════════════════════════════════════════════════════════
// Preset warna tampilan (Tahap 9b). Satu klik = isi draft tema terang DAN gelap, lalu user
// tetap bisa mengubah satu per satu sebelum menyimpan. Yang disimpan tetap selisih dari bawaan
// (`diffFromDefault`), jadi preset tidak menambah kolom/aturan baru di database.
//
// Setiap preset dijaga unit test: kontras teks/aksen/status ≥ 4.5:1 di kedua mode (WCAG AA).
// Warna yang tidak disebut = bawaan (DEFAULT_TOKENS).
// ══════════════════════════════════════════════════════════════════════════

import { type CustomThemeSet, type ThemeMode } from "./custom";

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  light: CustomThemeSet;
  dark: CustomThemeSet;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: "bawaan",
    name: "Bawaan",
    description: "Netral hangat, aksen biru",
    light: {},
    dark: {},
  },
  {
    id: "laut",
    name: "Laut",
    description: "Biru kehijauan yang tenang",
    light: {
      bg: "#F2F8F8", langit: "#E3F1F5", "surface-2": "#EEF5F5", border: "#D9E6E6",
      accent: "#0F6E7A", "accent-solid": "#137F8E",
    },
    dark: {
      bg: "#0F1617", langit: "#0E1A1F", surface: "#172022", "surface-2": "#1C2729", "surface-3": "#212D30",
      "glass-tint": "#172022", border: "#2A3739", accent: "#7CCFD8", "accent-solid": "#17707C",
    },
  },
  {
    id: "hutan",
    name: "Hutan",
    description: "Hijau daun, latar kehijauan",
    light: {
      bg: "#F5F8F1", langit: "#EAF3E6", "surface-2": "#F0F4EB", border: "#DDE5D5",
      accent: "#2F6B2F", "accent-solid": "#367A36",
    },
    dark: {
      bg: "#121611", langit: "#111A14", surface: "#1A2019", "surface-2": "#20271F", "surface-3": "#252D24",
      "glass-tint": "#1A2019", border: "#2F382D", accent: "#9ED39A", "accent-solid": "#336F33",
    },
  },
  {
    id: "senja",
    name: "Senja",
    description: "Oranye bata yang hangat",
    light: {
      bg: "#FFF6EF", langit: "#FDECE2", "surface-2": "#FAF0E8", border: "#EEDDD0",
      accent: "#A9441C", "accent-solid": "#B44A1D",
    },
    dark: {
      bg: "#181210", langit: "#1C1411", surface: "#211916", "surface-2": "#281F1B", "surface-3": "#2D2420",
      "glass-tint": "#211916", border: "#3A2E28", accent: "#F2A67E", "accent-solid": "#A9451B",
    },
  },
  {
    id: "anggur",
    name: "Anggur",
    description: "Ungu lembut",
    light: {
      bg: "#FAF6FC", langit: "#F0E9F8", "surface-2": "#F5F0F8", border: "#E5DCEC",
      accent: "#6B3FA0", "accent-solid": "#7446AE",
    },
    dark: {
      bg: "#15121A", langit: "#16121F", surface: "#1D1922", "surface-2": "#241F2A", "surface-3": "#292330",
      "glass-tint": "#1D1922", border: "#352E3D", accent: "#C9AEF0", "accent-solid": "#6E46B0",
    },
  },
  {
    id: "grafit",
    name: "Grafit",
    description: "Abu-abu dingin, rapi",
    light: {
      bg: "#F5F6F8", langit: "#EAEDF2", "surface-2": "#F1F3F6", border: "#DDE1E7", "line-strong": "#848B96",
      "text-strong": "#1E2329", text: "#262B31", "text-muted": "#5D6570", faint: "#9AA1AB",
      accent: "#2B59C3", "accent-solid": "#3163D2",
    },
    dark: {
      bg: "#121417", langit: "#10141A", surface: "#1A1D21", "surface-2": "#202328", "surface-3": "#24282D",
      "glass-tint": "#1A1D21", border: "#2E3238", "line-strong": "#737B86",
      "text-strong": "#ECEFF3", text: "#DADFE5", "text-muted": "#A0A8B2", faint: "#636B75",
      accent: "#8FB0F5", "accent-solid": "#3A64CC",
    },
  },
  {
    id: "kontras",
    name: "Kontras tinggi",
    description: "Hitam-putih tegas, paling mudah dibaca",
    light: {
      bg: "#FFFFFF", langit: "#FFFFFF", "surface-2": "#F2F2F2", border: "#8A8A8A", "line-strong": "#4A4A4A",
      "text-strong": "#000000", text: "#111111", "text-muted": "#333333", faint: "#666666",
      accent: "#0033CC", "accent-solid": "#0033CC",
      cga1: "#0B5A2E", cga2: "#6B3D00", cga3: "#8E1010", plum: "#4B1F8F",
    },
    dark: {
      bg: "#000000", langit: "#000000", surface: "#0A0A0A", "surface-2": "#141414", "surface-3": "#1A1A1A",
      "glass-tint": "#0A0A0A", border: "#5A5A5A", "line-strong": "#9A9A9A",
      "text-strong": "#FFFFFF", text: "#F2F2F2", "text-muted": "#CCCCCC", faint: "#999999",
      accent: "#9EC1FF", "accent-solid": "#1F4FD1",
      cga1: "#7EE2A8", cga2: "#FFD27A", cga3: "#FF9C94", plum: "#D6BFFF",
    },
  },
];

export function presetSet(preset: ThemePreset, mode: ThemeMode): CustomThemeSet {
  return preset[mode];
}
