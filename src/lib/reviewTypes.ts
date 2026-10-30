// ─── assets_clean row ────────────────────────────────────────────────────────
// Kolom aktual di database: id, raw_id, original_description,
// normalized_description, jenis, merk, kategori, status, confidence, created_at
// CATATAN: kode_asset dan toko ada di assets_raw, BUKAN di assets_clean
export interface AssetClean {
  id: string;
  original_description: string;
  normalized_description?: string;
  jenis: string;
  merk: string;
  kategori: string;
  /**
   * Di database kolom ini bernama `confidence`.
   * Hook melakukan mapping: confidence → confidence_score
   */
  confidence_score: number | string | null;
  status?: string;
}

// ─── keyword_rules row ────────────────────────────────────────────────────────
export interface KeywordRule {
  id?: string;
  keyword: string;
  rule_type: "jenis" | "merk" | "no_merk";
  value: string;
  created_at?: string;
}

// ─── Derived summary counts ───────────────────────────────────────────────────
export interface ReviewSummary {
  /** Jumlah aset unknown (jenis=Unknown OR merk=Unknown) */
  total: number;
  unknownMerk: number;
  unknownJenis: number;
  /**
   * Persentase aset yang SUDAH terklasifikasi.
   * Dihitung dari total semua aset di assets_clean, bukan hanya unknown.
   * Formula: (totalAssets - totalUnknown) / totalAssets * 100
   */
  completionPct: number;
  totalClassified?: number;
  totalGudang?: number;
}

// ─── Modal form state ─────────────────────────────────────────────────────────
export interface RuleFormState {
  keyword: string;
  rule_type: "jenis" | "merk" | "no_merk";
  value: string;
}

export const RULE_FORM_EMPTY: RuleFormState = {
  keyword: "",
  rule_type: "merk",
  value: "",
};

// ─── Filter / sort state ──────────────────────────────────────────────────────
export type FilterType = "all" | "unknown_jenis" | "unknown_merk" | "both";
export type SortField = "original_description" | "jenis" | "merk" | "confidence_score";
export type SortDir = "asc" | "desc";
