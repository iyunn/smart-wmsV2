// ══════════════════════════════════════════════════════════════════════════
// Tema custom per user (PRD D10, ARCHITECTURE D-37).
//
// User bebas mengganti warna DASAR tema light dan/atau dark. Warna turunan (skala brand
// 50–800, tint status, palet lama cyan/emerald/…, gradasi latar) dihitung CSS sendiri dari
// warna dasar lewat color-mix() di blok `:root.theme-custom` (globals.css) — tidak ada
// perhitungan warna di JavaScript dan tidak ada CSS yang dibuat saat runtime.
//
// Penerapan = set ±18 CSS variable di <html> + class `theme-custom`. Dipakai oleh:
//   - skrip anti-flash di layout.tsx (sebelum halaman tampil)
//   - ThemeContext (setelah profil dimuat / saat user mengubah)
//   - validasi API PATCH /api/me (server)
// File ini murni (tanpa React / server) supaya bisa dipakai di semua tempat itu.
// ══════════════════════════════════════════════════════════════════════════

export type ThemeMode = "light" | "dark";

export interface CustomToken {
  /** Nama CSS variable tanpa "--" */
  key: string;
  label: string;
  group: string;
  hint: string;
}

export const CUSTOM_TOKENS = [
  { key: "bg", label: "Latar halaman", group: "Latar & permukaan", hint: "Warna dasar di balik semua kartu" },
  { key: "langit", label: "Latar (ujung gradasi)", group: "Latar & permukaan", hint: "Gradasi latar mengarah ke warna ini (kanan bawah)" },
  { key: "surface", label: "Kartu & tabel", group: "Latar & permukaan", hint: "Kartu, tabel, modal, dropdown" },
  { key: "surface-2", label: "Panel", group: "Latar & permukaan", hint: "Header tabel, panel di dalam kartu" },
  { key: "surface-3", label: "Kolom isian", group: "Latar & permukaan", hint: "Latar input & dropdown" },
  { key: "glass-tint", label: "Sidebar & topbar", group: "Latar & permukaan", hint: "Warna kaca bingkai aplikasi (dibuat transparan)" },
  { key: "border", label: "Garis", group: "Garis", hint: "Garis pemisah & tepi kartu" },
  { key: "line-strong", label: "Garis kolom isian", group: "Garis", hint: "Tepi input, checkbox, dropdown" },
  { key: "text-strong", label: "Judul", group: "Teks", hint: "Judul halaman, angka utama, teks tegas" },
  { key: "text", label: "Teks isi", group: "Teks", hint: "Isi tabel & paragraf" },
  { key: "text-muted", label: "Teks keterangan", group: "Teks", hint: "Label, keterangan, header kolom" },
  { key: "faint", label: "Ikon samar", group: "Teks", hint: "Ikon & tanda dekoratif" },
  { key: "accent", label: "Aksen (teks & menu aktif)", group: "Aksen", hint: "Link, menu aktif, angka sorotan, nomor SJ" },
  { key: "accent-solid", label: "Tombol utama", group: "Aksen", hint: "Isi tombol utama (teksnya putih)" },
  { key: "cga1", label: "Sukses / CGA1", group: "Status", hint: "Hijau: berhasil, CGA1" },
  { key: "cga2", label: "Peringatan / CGA2", group: "Status", hint: "Kuning: peringatan, CGA2" },
  { key: "cga3", label: "Bahaya / CGA3", group: "Status", hint: "Merah: hapus, error, CGA3" },
  { key: "plum", label: "Ungu / LPP", group: "Status", hint: "Aksen kedua: data LPP, arah tarik" },
] as const satisfies readonly CustomToken[];

export type CustomTokenKey = (typeof CUSTOM_TOKENS)[number]["key"];
export type CustomThemeSet = Partial<Record<CustomTokenKey, string>>;
export interface CustomTheme {
  light?: CustomThemeSet;
  dark?: CustomThemeSet;
}

/** Nilai bawaan — HARUS sama dengan blok .light/.dark di globals.css (dijaga unit test). */
export const DEFAULT_TOKENS: Record<ThemeMode, Record<CustomTokenKey, string>> = {
  light: {
    bg: "#FFF8F0", langit: "#EAF1FB", surface: "#FFFFFF", "surface-2": "#F7F2EC", "surface-3": "#FFFFFF",
    "glass-tint": "#FFFFFF", border: "#E9E1D8", "line-strong": "#948779",
    "text-strong": "#2A2420", text: "#2A2420", "text-muted": "#6E625A", faint: "#A2968C",
    accent: "#1F4FD1", "accent-solid": "#2F6FE8",
    cga1: "#256647", cga2: "#8F5716", cga3: "#A7312A", plum: "#5A3A98",
  },
  dark: {
    bg: "#161412", langit: "#13161C", surface: "#1E1B18", "surface-2": "#25211E", "surface-3": "#2A2622",
    "glass-tint": "#1E1B18", border: "#34302B", "line-strong": "#7D7268",
    "text-strong": "#F1EAE2", text: "#E4DCD2", "text-muted": "#ABA095", faint: "#6E645A",
    accent: "#96B4F4", "accent-solid": "#3F6FD8",
    cga1: "#86C9A2", cga2: "#E2B26A", cga3: "#EE9A90", plum: "#C2A8EB",
  },
};

export const CUSTOM_STORAGE_KEY = "swms-theme-custom";
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const KEYS = new Set<string>(CUSTOM_TOKENS.map((t) => t.key));

function sanitizeSet(input: unknown): CustomThemeSet | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const out: CustomThemeSet = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (KEYS.has(k) && typeof v === "string" && HEX_COLOR.test(v)) out[k as CustomTokenKey] = v.toUpperCase();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Buang kunci/nilai yang tidak dikenal. Hasil kosong → null (= pakai tema bawaan). */
export function sanitizeCustomTheme(input: unknown): CustomTheme | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const out: CustomTheme = {};
  const light = sanitizeSet(src.light);
  const dark = sanitizeSet(src.dark);
  if (light) out.light = light;
  if (dark) out.dark = dark;
  return out.light || out.dark ? out : null;
}

/** Hanya simpan warna yang BERBEDA dari bawaan (data kecil, ikut bila bawaan berubah). */
export function diffFromDefault(mode: ThemeMode, set: CustomThemeSet): CustomThemeSet | undefined {
  const out: CustomThemeSet = {};
  for (const t of CUSTOM_TOKENS) {
    const v = set[t.key];
    if (v && HEX_COLOR.test(v) && v.toUpperCase() !== DEFAULT_TOKENS[mode][t.key].toUpperCase()) out[t.key] = v.toUpperCase();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Pasang (atau lepas) warna custom untuk mode aktif di <html>. Aman dipanggil berulang. */
export function applyCustomTheme(mode: ThemeMode, custom: CustomTheme | null | undefined): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const set = custom?.[mode];
  for (const t of CUSTOM_TOKENS) {
    const v = set?.[t.key];
    if (v && HEX_COLOR.test(v)) root.style.setProperty(`--${t.key}`, v);
    else root.style.removeProperty(`--${t.key}`);
  }
  root.classList.toggle("theme-custom", !!set && Object.keys(set).length > 0);
}

/** Skrip anti-flash (string, disisipkan di <head>): tema + warna custom sebelum halaman tampil.
 *  `?reset-theme` di URL = abaikan warna custom (jalan keluar bila warna membuat layar tak terbaca). */
export const THEME_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('swms-theme');if(t!=='light')t='dark';d.classList.add(t);d.style.colorScheme=t;if(location.search.indexOf('reset-theme')>=0)return;var c=JSON.parse(localStorage.getItem('${CUSTOM_STORAGE_KEY}')||'null');var s=c&&c[t];if(!s)return;var n=0;for(var k in s){if(/^[a-z0-9-]{1,24}$/.test(k)&&/^#[0-9a-fA-F]{6}$/.test(s[k])){d.style.setProperty('--'+k,s[k]);n++}}if(n)d.classList.add('theme-custom')}catch(e){d.classList.add('dark')}})();`;

// ── Kontras (info untuk user, BUKAN pembatas — PRD D10: warna bebas) ───────────
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
/** Rasio kontras WCAG 2.x antara dua warna #RRGGBB (1–21). */
export function contrastRatio(a: string, b: string): number {
  if (!HEX_COLOR.test(a) || !HEX_COLOR.test(b)) return 1;
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
