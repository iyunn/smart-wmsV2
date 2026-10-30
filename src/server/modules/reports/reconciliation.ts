import "server-only";
import { db } from "@/server/db";
import { extractCGACodeLoose } from "@/server/modules/assets/cga";

// Rekonsiliasi DAT (Oracle) vs LPP (Web Tracking) per kode_asset — logika & 5 kondisi
// identik dengan V1 (lihat komentar lengkap di versi V1). Bedanya: tiga sumber dibaca
// utuh dalam satu query masing-masing, tanpa pagination loop.

type Kondisi = 1 | 2 | 4 | 5 | 6;

export async function runReconciliation() {
  const [datRows, lppRows, sjRows] = await Promise.all([
    db.selectFrom("assets_raw").select(["kode_asset", "toko", "deskripsi"]).orderBy("kode_asset").execute(),
    db.selectFrom("lpp_raw").select(["kode_asset", "toko", "deskripsi"]).orderBy("kode_asset").orderBy("id").execute(),
    db
      .selectFrom("surat_jalan_items as i")
      .innerJoin("surat_jalan as s", "s.id", "i.sj_id")
      .select(["i.kode_asset", "i.jenis", "i.merk"])
      .where("i.kode_asset", "is not", null)
      .orderBy("i.kode_asset")
      .orderBy("s.tanggal")
      .orderBy("s.created_at")
      .orderBy("i.urutan")
      .execute(),
  ]);

  const datMap = new Map<string, { toko: string; deskripsi: string }>();
  for (const r of datRows) if (r.kode_asset) datMap.set(r.kode_asset, { toko: extractCGACodeLoose(r.toko ?? ""), deskripsi: r.deskripsi ?? "" });

  const lppMap = new Map<string, { toko: string; deskripsi: string }>();
  for (const r of lppRows) if (r.kode_asset) lppMap.set(r.kode_asset, { toko: r.toko ?? "", deskripsi: r.deskripsi ?? "" });

  // Keterangan untuk kode yang sudah tidak ada di DAT/LPP: catatan SJ PERTAMA (paling lama).
  const sjDeskripsiMap = new Map<string, string>();
  for (const r of sjRows) {
    if (r.kode_asset && !sjDeskripsiMap.has(r.kode_asset)) {
      const label = [r.jenis, r.merk].filter(Boolean).join(" - ");
      sjDeskripsiMap.set(r.kode_asset, label || "-");
    }
  }

  const universe = new Set<string>([...datMap.keys(), ...lppMap.keys(), ...sjDeskripsiMap.keys()]);
  const items: {
    kode_asset: string; toko: string; tokoLPP: string | null; deskripsi: string;
    kondisi: Kondisi; inDAT: boolean; inLPP: boolean;
  }[] = [];
  const summary = { kondisi1: 0, kondisi2: 0, kondisi4: 0, kondisi5: 0, kondisi6: 0 };

  for (const kode of universe) {
    const dat = datMap.get(kode);
    const lpp = lppMap.get(kode);
    const inDAT = !!dat;
    const inLPP = !!lpp;
    let kondisi: Kondisi;
    let toko = "";
    let tokoLPP: string | null = null;
    let deskripsi = "";

    if (dat && lpp) {
      toko = dat.toko;
      deskripsi = dat.deskripsi;
      if (dat.toko === lpp.toko) { kondisi = 1; summary.kondisi1++; }
      else { kondisi = 6; tokoLPP = lpp.toko; summary.kondisi6++; }
    } else if (dat) {
      kondisi = 2; toko = dat.toko; deskripsi = dat.deskripsi; summary.kondisi2++;
    } else if (lpp) {
      kondisi = 4; toko = lpp.toko; deskripsi = lpp.deskripsi; summary.kondisi4++;
    } else {
      kondisi = 5; toko = "-"; deskripsi = sjDeskripsiMap.get(kode) ?? "-"; summary.kondisi5++;
    }
    items.push({ kode_asset: kode, toko, tokoLPP, deskripsi, kondisi, inDAT, inLPP });
  }

  return { summary, items, totalUniverse: universe.size };
}
