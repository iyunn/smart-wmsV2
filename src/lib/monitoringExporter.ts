import * as XLSX from "xlsx";
import type { MonitoringAsset } from "@/hooks/useMonitoring";

interface MonitoringExportOptions {
  assets: MonitoringAsset[];
  searchField: string;
  tags: string[];
  costCenter: string;
  catatanOverride?: Record<string, string>;
  filename?: string;
}

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function slugify(s: string): string {
  return s.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
}

export function buildMonitoringFilename(
  searchField: string,
  tags: string[],
  costCenter: string,
): string {
  const ccSlug = costCenter === "ALL" ? "Semua-CGA" : costCenter;

  if (tags.length > 0) {
    const tagSlug = tags.map(t => slugify(t)).join("-");
    const fieldMap: Record<string, string> = {
      all: "Semua", jenis: "Jenis", merk: "Merk",
      kode_asset: "Kode-Aset", toko: "Cost-Center",
      kategori_oracle: "Kategori",
    };
    const fieldLabel = fieldMap[searchField] ?? searchField;
    return `Monitoring-DAT-${ccSlug}-sort-by-${fieldLabel}-${tagSlug}`;
  }
  return `Monitoring-DAT-${ccSlug}`;
}

export function exportMonitoringToExcel(opts: MonitoringExportOptions): void {
  const { assets, searchField, tags, costCenter, catatanOverride = {} } = opts;

  if (assets.length === 0) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename  = opts.filename ?? buildMonitoringFilename(searchField, tags, costCenter);

  // ── SHEET 1: Summary per CGA (3 tabel side-by-side) ────────────────────
  // Tiap CGA: grouping Kategori Oracle → Jenis, kolom: Kategori, Jenis,
  // Item (count kode_aset), Qty (sum), Perolehan (sum), Tercatat (sum).
  // Layout: CGA1 di kolom B-G, gap 1 kolom (H), CGA2 di kolom I-N, gap (O),
  // CGA3 di kolom P-U.

  const CGA_CODES = ["CGA1", "CGA2", "CGA3"] as const;
  const CGA_LABEL: Record<string, string> = {
    CGA1: "CGA1 - Cadangan General Affairs 1",
    CGA2: "CGA2 - Cadangan General Affairs 2",
    CGA3: "CGA3 - Cadangan General Affairs 3",
  };

  type AggRow = {
    kategori: string; jenis: string;
    item: number; qty: number; perolehan: number; tercatat: number;
  };

  function extractCGACode(toko: string): string {
    const m = toko.match(/CGA\d/i);
    return m ? m[0].toUpperCase() : toko;
  }

  // Build aggregation per CGA: kategori → jenis → { item, qty, perolehan, tercatat }
  function buildCgaTable(cgaCode: string): {
    rows: { kategori: string; jenis: string; item: number; qty: number; perolehan: number; tercatat: number; isSubtotal?: boolean; isGrandTotal?: boolean }[];
  } {
    const filtered = assets.filter(a => extractCGACode(a.toko) === cgaCode);

    const map = new Map<string, AggRow>(); // key: kategori__jenis
    for (const a of filtered) {
      const key = `${a.kategori_oracle}__${a.jenis}`;
      const existing = map.get(key);
      if (existing) {
        existing.item++;
        existing.qty       += a.kuantitas;
        existing.perolehan += a.biaya_perolehan;
        existing.tercatat  += a.jumlah_tercatat;
      } else {
        map.set(key, {
          kategori: a.kategori_oracle, jenis: a.jenis,
          item: 1, qty: a.kuantitas,
          perolehan: a.biaya_perolehan, tercatat: a.jumlah_tercatat,
        });
      }
    }

    // Group by kategori, sort kategori asc, lalu jenis asc dalam grup
    const kategoriGroup = new Map<string, AggRow[]>();
    for (const row of map.values()) {
      if (!kategoriGroup.has(row.kategori)) kategoriGroup.set(row.kategori, []);
      kategoriGroup.get(row.kategori)!.push(row);
    }
    const sortedKategori = Array.from(kategoriGroup.keys()).sort((a, b) => a.localeCompare(b));

    const rows: { kategori: string; jenis: string; item: number; qty: number; perolehan: number; tercatat: number; isSubtotal?: boolean; isGrandTotal?: boolean }[] = [];
    let grandItem = 0, grandQty = 0, grandPerolehan = 0, grandTercatat = 0;

    for (const kategori of sortedKategori) {
      const items = kategoriGroup.get(kategori)!.sort((a, b) => a.jenis.localeCompare(b.jenis));
      items.forEach((r, idx) => {
        rows.push({
          kategori: idx === 0 ? kategori : "", // hanya tampil di baris pertama grup
          jenis: r.jenis, item: r.item, qty: r.qty,
          perolehan: r.perolehan, tercatat: r.tercatat,
        });
      });
      const subItem      = items.reduce((s, r) => s + r.item, 0);
      const subQty       = items.reduce((s, r) => s + r.qty, 0);
      const subPerolehan = items.reduce((s, r) => s + r.perolehan, 0);
      const subTercatat  = items.reduce((s, r) => s + r.tercatat, 0);

      // Kode kategori singkat untuk label "Total X" (ambil sebelum " - ")
      const kodeSingkat = kategori.includes(" - ") ? kategori.split(" - ")[0].trim() : kategori;
      rows.push({
        kategori: `Total ${kodeSingkat}`, jenis: "",
        item: subItem, qty: subQty, perolehan: subPerolehan, tercatat: subTercatat,
        isSubtotal: true,
      });

      grandItem += subItem; grandQty += subQty;
      grandPerolehan += subPerolehan; grandTercatat += subTercatat;
    }

    rows.push({
      kategori: `Grand Total ${cgaCode}`, jenis: "",
      item: grandItem, qty: grandQty, perolehan: grandPerolehan, tercatat: grandTercatat,
      isGrandTotal: true,
    });

    return { rows };
  }

  const cgaTables = CGA_CODES.map(code => ({ code, ...buildCgaTable(code) }));

  // ── Build sheet 1 sebagai AOA (array of arrays) untuk kontrol layout bebas ──
  const maxRows = Math.max(...cgaTables.map(t => t.rows.length));
  // Tiap tabel: 6 kolom (Kategori, Jenis, Item, Qty, Perolehan, Tercatat) + 1 kolom gap
  // Kolom start: CGA1=B(1), gap=H(7), CGA2=I(8), gap=O(14), CGA3=P(15)
  const TABLE_WIDTH = 6;
  const GAP_WIDTH = 1;
  const colStarts = [1, 1 + TABLE_WIDTH + GAP_WIDTH, 1 + 2 * (TABLE_WIDTH + GAP_WIDTH)]; // [1, 8, 15]

  const totalCols = colStarts[2] + TABLE_WIDTH;
  const aoa: any[][] = [];

  // Row 0: kosong (margin atas)
  aoa.push(new Array(totalCols).fill(""));

  // Row 1: judul CGA (merged per tabel)
  const titleRow = new Array(totalCols).fill("");
  cgaTables.forEach((t, i) => { titleRow[colStarts[i]] = CGA_LABEL[t.code]; });
  aoa.push(titleRow);

  // Row 2: header kolom
  const headerRow = new Array(totalCols).fill("");
  cgaTables.forEach((_, i) => {
    const c = colStarts[i];
    headerRow[c]     = "Kategori";
    headerRow[c + 1] = "Jenis";
    headerRow[c + 2] = "Item";
    headerRow[c + 3] = "Qty";
    headerRow[c + 4] = "Perolehan";
    headerRow[c + 5] = "Tercatat";
  });
  aoa.push(headerRow);

  // Data rows
  for (let r = 0; r < maxRows; r++) {
    const dataRow = new Array(totalCols).fill("");
    cgaTables.forEach((t, i) => {
      const row = t.rows[r];
      if (!row) return;
      const c = colStarts[i];
      if (row.isSubtotal || row.isGrandTotal) {
        // Baris ini akan di-merge (kolom c..c+1) — value HARUS di kolom c
        // (anchor/top-left merge), bukan c+1, atau Excel akan tampilkan kosong.
        // Label "Total X" / "Grand Total CGAx" disimpan di row.kategori (lihat buildCgaTable).
        dataRow[c]     = row.kategori;
        dataRow[c + 1] = "";
      } else {
        dataRow[c]     = row.kategori;
        dataRow[c + 1] = row.jenis;
      }
      dataRow[c + 2] = row.item;
      dataRow[c + 3] = row.qty;
      dataRow[c + 4] = formatRupiah(row.perolehan);
      dataRow[c + 5] = formatRupiah(row.tercatat);
    });
    aoa.push(dataRow);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(aoa);

  // ── Column widths ───────────────────────────────────────────────────────
  const colsWs1: any[] = new Array(totalCols).fill({ wch: 10 });
  cgaTables.forEach((_, i) => {
    const c = colStarts[i];
    colsWs1[c]     = { wch: 24 }; // Kategori
    colsWs1[c + 1] = { wch: 18 }; // Jenis
    colsWs1[c + 2] = { wch: 7  }; // Item
    colsWs1[c + 3] = { wch: 7  }; // Qty
    colsWs1[c + 4] = { wch: 16 }; // Perolehan
    colsWs1[c + 5] = { wch: 16 }; // Tercatat
  });
  // Kolom gap dibuat sempit
  colsWs1[colStarts[1] - 1] = { wch: 3 };
  colsWs1[colStarts[2] - 1] = { wch: 3 };
  ws1["!cols"] = colsWs1;

  // ── Merge cells: judul CGA span 6 kolom + label subtotal/grand total ─────
  // Catatan: SheetJS community edition (xlsx npm package) tidak mendukung
  // styling (fill warna, border warna, bold) saat menulis file — fitur itu
  // eksklusif di SheetJS Pro. Merge cell tetap didukung dan tetap dipakai
  // agar layout judul & label total tetap rapi meski tanpa warna.
  const merges: any[] = [];
  cgaTables.forEach((t, i) => {
    const c = colStarts[i];
    merges.push({ s: { r: 1, c }, e: { r: 1, c: c + 5 } }); // judul CGA, row index 1

    t.rows.forEach((row, rIdx) => {
      if (row.isSubtotal || row.isGrandTotal) {
        const excelRow = 3 + rIdx;
        merges.push({ s: { r: excelRow, c }, e: { r: excelRow, c: c + 1 } });
      }
    });
  });
  ws1["!merges"] = merges;

  // ── SHEET 2: Detail per aset ──────────────────────────────────────────
  const sheet2Rows = assets
    .sort((a, b) => a.jenis.localeCompare(b.jenis) || a.toko.localeCompare(b.toko))
    .map((a, idx) => ({
      "No":               idx + 1,
      "Jenis":            a.jenis,
      "Merk":             a.merk,
      "Cost Center":      a.toko,
      "Kategori Oracle":  a.kategori_oracle,
      "Kode Aset":        a.kode_asset,
      "Deskripsi":        a.deskripsi,
      "Qty":              a.kuantitas,
      "Biaya Perolehan":  formatRupiah(a.biaya_perolehan),
      "Jumlah Tercatat":  formatRupiah(a.jumlah_tercatat),
      "Status Alokasi":   a.tag === "Allocated" ? "Allocated" : "Belum Dialokasikan",
      "Kode Tujuan":      a.kode_tujuan ?? "",
      "Catatan":          catatanOverride[a.kode_asset] ?? a.catatan ?? "",
    }));

  // ── Build workbook ────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // ws1 sudah dibangun lengkap (AOA + styling) di blok SHEET 1 di atas
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
  ws2["!cols"] = [
    { wch: 5  }, // No
    { wch: 22 }, // Jenis
    { wch: 15 }, // Merk
    { wch: 12 }, // Cost Center
    { wch: 20 }, // Kategori Oracle
    { wch: 20 }, // Kode Aset
    { wch: 40 }, // Deskripsi
    { wch: 6  }, // Qty
    { wch: 22 }, // Biaya Perolehan
    { wch: 22 }, // Jumlah Tercatat
    { wch: 20 }, // Status Alokasi
    { wch: 14 }, // Kode Tujuan
    { wch: 35 }, // Catatan
  ];
  XLSX.utils.book_append_sheet(wb, ws2, "Detail DAT");

  XLSX.writeFile(wb, `${filename}-${timestamp}.xlsx`);
}
