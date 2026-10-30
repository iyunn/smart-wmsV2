// Format nomor Surat Jalan: SJ-Manual/CGA/YYYY/MM/NNNN (urut per bulan tanggal SJ).
// Murni tanpa database agar bisa diuji (nomor berikutnya: surat-jalan.ts → nextNoSJ).

/** Prefix nomor dari tanggal "YYYY-MM-DD" → "SJ-Manual/CGA/YYYY/MM/". */
export function noSJPrefix(tanggal: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(tanggal);
  if (m) return `SJ-Manual/CGA/${m[1]}/${m[2]}/`;
  const d = new Date(tanggal);
  return `SJ-Manual/CGA/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/`;
}

/** Nomor sesudah `lastNo` (atau 0001 bila belum ada nomor bulan itu). */
export function nextNoSJFrom(prefix: string, lastNo: string | null | undefined): string {
  const nextSeq = lastNo ? (parseInt(lastNo.split("/").pop() ?? "0") || 0) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}
