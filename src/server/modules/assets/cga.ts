// Ekstrak kode CGA dari label toko DAT ("CGA1 - Cadangan General Affairs 1" → "CGA1").
// Dua varian dipertahankan persis seperti V1 karena dipakai di tempat berbeda.

/** Varian Monitoring/Stock/Staging/Process: "" bila tidak ada CGA. */
export function extractCGA(toko: string | null | undefined): string {
  const m = (toko ?? "").match(/CGA\d/i);
  return m ? m[0].toUpperCase() : "";
}

/** Varian Reconciliation: boleh ada spasi ("CGA 1"); bila tidak cocok → toko apa adanya. */
export function extractCGACodeLoose(toko: string): string {
  const m = toko.match(/CGA\s*\d/i);
  return m ? m[0].replace(/\s+/g, "").toUpperCase() : toko;
}

/** Varian Dashboard: bila tidak cocok → toko apa adanya (atau 'Unknown'). */
export function extractCGACodeOrSelf(toko: string | null | undefined): string {
  const m = (toko ?? "").match(/CGA\d/i);
  return m ? m[0].toUpperCase() : (toko ?? "Unknown");
}
