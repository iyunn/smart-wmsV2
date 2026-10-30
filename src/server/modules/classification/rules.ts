import "server-only";
import { db } from "@/server/db";
import { CACHE, cached, invalidate } from "@/server/modules/assets/cache";

// Keyword rules — sumber aturan classifier (src/lib/classifier.ts).
//
// URUTAN PENTING: classifier memakai "aturan pertama yang cocok menang". V1 tidak pernah
// menentukan urutan (Supabase mengembalikan urutan fisik penyimpanan). V2 menetapkan
// aturan TERLAMA menang (created_at, lalu id) — deterministik & tidak berubah saat diedit
// (ARCHITECTURE D-25).

export type RuleType = "jenis" | "merk" | "no_merk";

export async function loadRulesForClassifier() {
  return db
    .selectFrom("keyword_rules")
    .select(["keyword", "rule_type", "value"])
    .orderBy("created_at", "asc")
    .orderBy("id", "asc")
    .execute() as Promise<{ keyword: string; rule_type: RuleType; value: string }[]>;
}

export async function listRules() {
  return db
    .selectFrom("keyword_rules")
    .select(["id", "keyword", "rule_type", "value", "created_at"])
    .orderBy("created_at", "desc")
    .orderBy("id", "desc")
    .execute();
}

/** Semua cache yang bergantung pada keyword rules / hasil klasifikasi. */
export function invalidateClassificationCaches() {
  invalidate("kr-values-");
  invalidate(CACHE.masterJenis);
  invalidate(CACHE.masterMerk);
}

export async function createRule(input: { keyword: string; rule_type: RuleType; value: string }) {
  const row = await db
    .insertInto("keyword_rules")
    .values({ keyword: input.keyword.trim().toUpperCase(), rule_type: input.rule_type, value: input.value.trim() })
    .returning(["id", "keyword", "rule_type", "value", "created_at"])
    .executeTakeFirstOrThrow();
  invalidateClassificationCaches();
  return row;
}

export async function updateRule(id: string, input: { keyword: string; rule_type: RuleType; value: string }) {
  const r = await db
    .updateTable("keyword_rules")
    .set({ keyword: input.keyword.trim().toUpperCase(), rule_type: input.rule_type, value: input.value.trim() })
    .where("id", "=", id)
    .executeTakeFirst();
  invalidateClassificationCaches();
  return Number(r.numUpdatedRows);
}

export async function deleteRule(id: string) {
  const row = await db
    .deleteFrom("keyword_rules")
    .where("id", "=", id)
    .returning(["id", "keyword", "rule_type", "value"])
    .executeTakeFirst();
  invalidateClassificationCaches();
  return row ?? null;
}

/** Nilai unik (beda huruf besar/kecil dianggap sama) untuk saran input di Review. */
export async function ruleValues(type: "jenis" | "merk") {
  return cached(CACHE.krValues(type), async () => {
    const rows = await db
      .selectFrom("keyword_rules")
      .select("value")
      .where("rule_type", "=", type)
      .where("value", "is not", null)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const row of rows) {
      const v = (row.value ?? "").trim();
      if (!v) continue;
      const key = v.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(v);
      }
    }
    return unique.sort((a, b) => a.localeCompare(b));
  });
}
