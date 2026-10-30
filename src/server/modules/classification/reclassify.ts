import "server-only";
import { sql } from "kysely";
import { db } from "@/server/db";
import { classifyAsset } from "@/lib/classifier";
import { invalidateClassificationCaches, loadRulesForClassifier } from "./rules";

// Klasifikasi ulang aset Unknown (setelah rule baru) atau revert (setelah rule dihapus).
// Logika keputusan identik dengan V1; bedanya update dilakukan dalam SATU transaksi
// (UPDATE ... FROM VALUES per 500 baris), bukan ratusan request terpisah.

export interface ReclassifyResult {
  success: true;
  updated: number;
  total_unknown: number;
  message: string;
}

export async function reclassify(opts: { revertMerk?: string; revertJenis?: string }): Promise<ReclassifyResult> {
  const { revertMerk, revertJenis } = opts;
  const isRevertMode = !!(revertMerk || revertJenis);
  const rules = await loadRulesForClassifier();

  let q = db.selectFrom("assets_clean").select(["id", "original_description", "jenis", "merk"]);
  if (isRevertMode) {
    q = q.where((eb) =>
      eb.or([
        ...(revertMerk ? [eb("merk", "=", revertMerk)] : []),
        ...(revertJenis ? [eb("jenis", "=", revertJenis)] : []),
      ]),
    );
  } else {
    q = q.where((eb) => eb.or([eb("jenis", "=", "Unknown"), eb("merk", "=", "Unknown")]));
  }
  const targets = await q.orderBy("id").execute();

  if (targets.length === 0) {
    return {
      success: true, updated: 0, total_unknown: 0,
      message: isRevertMode
        ? "Tidak ada aset yang terdampak rule yang dihapus"
        : "Tidak ada aset unknown untuk diklasifikasi",
    };
  }

  const toUpdate: { id: string; jenis: string; merk: string; confidence: string }[] = [];
  for (const asset of targets) {
    const result = classifyAsset(asset.original_description ?? "", rules);
    if (isRevertMode) {
      const currentJenis = revertJenis && asset.jenis === revertJenis ? "Unknown" : (asset.jenis ?? "Unknown");
      const currentMerk  = revertMerk && asset.merk === revertMerk ? "Unknown" : (asset.merk ?? "Unknown");
      const newJenis = result.jenis !== "Unknown" ? result.jenis : currentJenis;
      const newMerk  = result.merk !== "Unknown" ? result.merk : currentMerk;
      let confidence = "low";
      if (newJenis !== "Unknown" && newMerk !== "Unknown") confidence = "high";
      else if (newJenis !== "Unknown" || newMerk !== "Unknown") confidence = "medium";
      toUpdate.push({ id: asset.id, jenis: newJenis, merk: newMerk, confidence });
    } else {
      const jenisChanged = result.jenis !== "Unknown" && result.jenis !== asset.jenis;
      const merkChanged  = result.merk !== "Unknown" && result.merk !== asset.merk;
      if (jenisChanged || merkChanged) {
        toUpdate.push({
          id: asset.id,
          jenis: jenisChanged ? result.jenis : (asset.jenis ?? "Unknown"),
          merk: merkChanged ? result.merk : (asset.merk ?? "Unknown"),
          confidence: result.confidence,
        });
      }
    }
  }

  if (toUpdate.length === 0) {
    return {
      success: true, updated: 0, total_unknown: targets.length,
      message: isRevertMode
        ? "Aset sudah di-revert, tidak ada perubahan tambahan"
        : "Tidak ada aset yang cocok dengan rule baru",
    };
  }

  let updated = 0;
  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < toUpdate.length; i += 500) {
      const chunk = toUpdate.slice(i, i + 500);
      const values = sql.join(chunk.map((u) => sql`(${u.id}::uuid, ${u.jenis}, ${u.merk}, ${u.confidence})`));
      const r = await sql`
        update assets_clean as c
        set jenis = v.jenis, merk = v.merk, confidence = v.confidence
        from (values ${values}) as v(id, jenis, merk, confidence)
        where c.id = v.id`.execute(trx);
      updated += Number(r.numAffectedRows ?? 0);
    }
  });
  invalidateClassificationCaches();

  return {
    success: true,
    updated,
    total_unknown: targets.length,
    message: isRevertMode
      ? `Revert selesai: ${updated} aset diperbarui`
      : `Reclassified ${updated} of ${targets.length} unknown assets`,
  };
}
