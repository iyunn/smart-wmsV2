/**
 * Nama di kolom tanda tangan "Dibuat" pada Surat Jalan (PDF).
 *
 * Sejak 2 Nov 2026 `surat_jalan.created_by` diisi SERVER dengan username akun yang membuat SJ
 * (POST /api/sj, POST /api/sj/import-wt). SJ lama tidak menyimpan pembuatnya: isinya default
 * kolom ("Admin User"), "Admin GA" (V1 / import WT), atau kosong → tetap dicetak "Admin GA"
 * seperti sebelumnya (pembuat aslinya tidak diketahui — tidak diganti nama orang yang mencetak).
 */
export const SJ_CREATOR_FALLBACK = "Admin GA";

const LEGACY_CREATORS = new Set(["admin ga", "admin user"]);

export function sjCreatorName(createdBy: string | null | undefined): string {
  const v = (createdBy ?? "").trim();
  if (!v || LEGACY_CREATORS.has(v.toLowerCase())) return SJ_CREATOR_FALLBACK;
  return v;
}
