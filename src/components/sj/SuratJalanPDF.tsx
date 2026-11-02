"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";

// ─── Types ────────────────────────────────────────────────────────────────
export interface SJItemForPDF {
  urutan: number;
  jenis: string;
  merk: string;
  serial_number: string;
  qty: number;
  satuan: string;
  is_baru: boolean;
  is_aktiva: boolean;
  keterangan: string;
  kode_asset?: string;  // opsional — diisi di Rekap Alokasi, dipakai SuratPenerimaanPDF
}

export interface SJDataForPDF {
  no_sj: string;
  tanggal: string;
  tujuan_kode: string;
  tujuan_nama: string;
  pembawa: string;
  penerima: string;
  approved_by: string;
  created_by?: string;
  items: SJItemForPDF[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatTanggalLong(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Color palette (kekinian tapi formal) ────────────────────────────────
const COLORS = {
  primary:    "#0EA5E9",   // cyan-500 (accent kekinian)
  dark:       "#0F172A",   // slate-900 (heading)
  text:       "#1E293B",   // slate-800 (body)
  muted:      "#64748B",   // slate-500
  light:      "#F1F5F9",   // slate-100
  lightBg:    "#F8FAFC",   // slate-50
  border:     "#E2E8F0",   // slate-200
  accent:     "#F0F9FF",   // sky-50 (table header bg)
  white:      "#FFFFFF",
};

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: COLORS.white,
    padding: 36,
    fontSize: 9,
    color: COLORS.text,
    fontFamily: "Helvetica",
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    borderBottom: `2pt solid ${COLORS.primary}`,
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 70, height: 32, objectFit: "contain" },
  logoFallback: {
    width: 70, height: 32,
    backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    borderRadius: 4,
  },
  logoFallbackText: { color: COLORS.white, fontSize: 11, fontWeight: "bold" },
  companyInfo: { flexDirection: "column" },
  companyName: { fontSize: 11, fontWeight: "bold", color: COLORS.dark },
  companySub: { fontSize: 8, color: COLORS.muted, marginTop: 1 },

  titleBox: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    letterSpacing: 2,
  },
  titleSub: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 2,
    letterSpacing: 1,
  },

  // ── Meta Info (No SJ & Tanggal) ────────────────────────────────────────
  metaContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.lightBg,
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
  },
  metaCol: { flex: 1 },
  metaLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    color: COLORS.dark,
    fontWeight: "bold",
  },
  metaValueMono: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: "bold",
    fontFamily: "Courier",
  },

  // ── Tujuan ─────────────────────────────────────────────────────────────
  tujuanSection: {
    flexDirection: "row",
    marginBottom: 14,
  },
  tujuanLabel: {
    width: 90,
    fontSize: 9,
    color: COLORS.muted,
    paddingTop: 2,
  },
  tujuanBox: {
    flex: 1,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  tujuanKode: { fontSize: 11, fontWeight: "bold", color: COLORS.dark },
  tujuanNama: { fontSize: 9, color: COLORS.text, marginTop: 2 },

  // ── Intro text ─────────────────────────────────────────────────────────
  intro: {
    fontSize: 9,
    color: COLORS.text,
    marginBottom: 8,
    lineHeight: 1.4,
  },

  // ── Table ──────────────────────────────────────────────────────────────
  table: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.accent,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    fontWeight: "bold",
    color: COLORS.dark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
    minHeight: 22,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightBg,
  },
  tableCell: {
    fontSize: 8.5,
    color: COLORS.text,
  },

  // Column widths
  colNo:    { width: "5%",  textAlign: "center" },
  colJenis: { width: "20%" },
  colMerk:  { width: "13%" },
  colSN:    { width: "13%" },
  // Qty rata tengah + Satuan diberi jarak kiri: dulu Qty rata kanan menempel ke teks Satuan.
  colQty:   { width: "7%",  textAlign: "center" },
  colSat:   { width: "9%",  paddingLeft: 6 },
  colTag:   { width: "10%", textAlign: "center" },
  colKet:   { width: "23%" },

  // Tag mini (Baru / AT)
  tagBox: {
    flexDirection: "row",
    gap: 3,
    justifyContent: "center",
  },
  tagBaru: {
    fontSize: 6.5,
    backgroundColor: "#10B981",
    color: COLORS.white,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontWeight: "bold",
  },
  tagAT: {
    fontSize: 6.5,
    backgroundColor: "#3B82F6",
    color: COLORS.white,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontWeight: "bold",
  },

  // ── Total row ──────────────────────────────────────────────────────────
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: COLORS.lightBg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  totalLabel: { fontSize: 9, color: COLORS.muted, marginRight: 8 },
  totalValue: { fontSize: 9, fontWeight: "bold", color: COLORS.dark },

  // ── Signatures ─────────────────────────────────────────────────────────
  signatureSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    paddingTop: 8,
  },
  signatureBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  signatureRole: {
    fontSize: 8,
    color: "#0a0a0a",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 36,
  },
  signatureLine: {
    width: "100%",
    borderTopWidth: 0.5,
    borderColor: COLORS.dark,
    paddingTop: 3,
  },
  signatureName: {
    fontSize: 9,
    color: COLORS.dark,
    fontWeight: "bold",
    textAlign: "center",
  },

  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderColor: COLORS.border,
  },
  footerText: {
    fontSize: 7,
    color: COLORS.muted,
  },
  footerLogo: {
    fontSize: 7,
    color: COLORS.primary,
    fontWeight: "bold",
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────

/** Header dokumen: logo + judul + meta info + tujuan + intro text.
 * Diulang penuh di setiap halaman (termasuk halaman lanjutan). */
function DocumentHeader({ data, logoSrc, fixed }: { data: SJDataForPDF; logoSrc?: string; fixed?: boolean }) {
  return (
    <>
      <View style={styles.header} fixed={fixed}>
        <View style={styles.headerLeft}>
          {logoSrc ? (
            <Image src={logoSrc} style={styles.logo} />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoFallbackText}>INDOMARET</Text>
            </View>
          )}
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>PT. Indomarco Prismatama</Text>
            <Text style={styles.companySub}>General Affairs Division</Text>
          </View>
        </View>
        <View style={styles.titleBox}>
          <Text style={styles.title}>SURAT JALAN</Text>
          <Text style={styles.titleSub}>Internal Asset Delivery</Text>
        </View>
      </View>

      <View style={styles.metaContainer} fixed={fixed}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Nomor Surat Jalan</Text>
          <Text style={styles.metaValueMono}>{data.no_sj}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Tanggal Pengiriman</Text>
          <Text style={styles.metaValue}>{formatTanggalLong(data.tanggal)}</Text>
        </View>
      </View>

      <View style={styles.tujuanSection} fixed={fixed}>
        <Text style={styles.tujuanLabel}>Kepada Yth.</Text>
        <View style={styles.tujuanBox}>
          <Text style={styles.tujuanKode}>{data.tujuan_kode}</Text>
          <Text style={styles.tujuanNama}>{data.tujuan_nama}</Text>
        </View>
      </View>

      <Text style={styles.intro}>
        Dengan ini kami kirimkan barang-barang dengan rincian sebagai berikut:
      </Text>
    </>
  );
}

/** Baris header tabel (Jenis, Merk, Serial No, dst). `fixed` → berulang di
 * setiap halaman kalau tabel pecah ke halaman berikutnya. */
function TableHeaderRow() {
  return (
    <View style={styles.tableHeader} fixed>
      <Text style={[styles.tableHeaderCell, styles.colNo]}>No</Text>
      <Text style={[styles.tableHeaderCell, styles.colJenis]}>Jenis</Text>
      <Text style={[styles.tableHeaderCell, styles.colMerk]}>Merk</Text>
      <Text style={[styles.tableHeaderCell, styles.colSN]}>Serial No.</Text>
      <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
      <Text style={[styles.tableHeaderCell, styles.colSat]}>Satuan</Text>
      <Text style={[styles.tableHeaderCell, styles.colTag]}>Tag</Text>
      <Text style={[styles.tableHeaderCell, styles.colKet]}>Keterangan</Text>
    </View>
  );
}

function TableRow({ item, idx }: { item: SJItemForPDF; idx: number }) {
  return (
    <View style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
      <Text style={[styles.tableCell, styles.colNo]}>{item.urutan}</Text>
      <Text style={[styles.tableCell, styles.colJenis]}>{item.jenis || "—"}</Text>
      <Text style={[styles.tableCell, styles.colMerk]}>{item.merk || "—"}</Text>
      <Text style={[styles.tableCell, styles.colSN, { fontFamily: "Courier" }]}>
        {item.serial_number || "—"}
      </Text>
      <Text style={[styles.tableCell, styles.colQty]}>{item.qty}</Text>
      <Text style={[styles.tableCell, styles.colSat]}>{item.satuan}</Text>
      <View style={[styles.colTag, styles.tagBox]}>
        {item.is_baru && <Text style={styles.tagBaru}>BARU</Text>}
        {item.is_aktiva && <Text style={styles.tagAT}>AT</Text>}
      </View>
      <Text style={[styles.tableCell, styles.colKet]}>{item.keterangan || "—"}</Text>
    </View>
  );
}

// ─── PDF Component ────────────────────────────────────────────────────────
interface SuratJalanPDFProps {
  data: SJDataForPDF;
  logoSrc?: string;  // base64 atau path
}

export function SuratJalanPDF({ data, logoSrc }: SuratJalanPDFProps) {
  const totalQty = data.items.reduce((s, it) => s + (it.qty ?? 0), 0);
  const totalItems = data.items.length;

  // Natural flow: satu Page, @react-pdf otomatis pecah ke halaman berikutnya
  // kalau tabel kepenuhan. Header tabel `fixed` → berulang tiap halaman.
  // Tiap baris `wrap={false}` → satu baris tidak kepotong antar halaman.
  // Signature `wrap={false}` → blok TTD utuh mengikuti item terakhir (kalau
  // tidak muat, pindah ke halaman berikutnya, bukan halaman kosong terpisah).
  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* `fixed` → kop surat berulang di SETIAP halaman.
            Tanpa ini, kalau blok tanda tangan terdorong ke halaman berikutnya,
            halaman itu cuma berisi kolom TTD tanpa identitas surat.
            Terverifikasi: @react-pdf menyediakan ruang untuk elemen `fixed`
            di halaman lanjutan, jadi konten TIDAK bertabrakan dengan kop. */}
        <DocumentHeader data={data} logoSrc={logoSrc} fixed />

        {/* ── TABLE ──────────────────────────────────────────────────── */}
        <View style={styles.table}>
          <TableHeaderRow />

          {data.items.map((item, idx) => (
            <TableRow key={item.urutan} item={item} idx={idx} />
          ))}

          {/* Total row — mengalir setelah baris terakhir */}
          <View style={styles.totalRow} wrap={false}>
            <Text style={styles.totalLabel}>Total Item:</Text>
            <Text style={styles.totalValue}>{totalItems}</Text>
            <Text style={[styles.totalLabel, { marginLeft: 16 }]}>Total Qty:</Text>
            <Text style={styles.totalValue}>{totalQty}</Text>
          </View>
        </View>

        {/* ── SIGNATURES — utuh, mengikuti item terakhir ─────────────── */}
        <View style={styles.signatureSection} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Dibuat</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{data.created_by || "Admin GA"}</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Disetujui</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{data.approved_by || "SPV/Manager"}</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Dibawa</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{data.pembawa || "—"}</Text>
            </View>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureRole}>Diterima</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureName}>{data.penerima || "—"}</Text>
            </View>
          </View>
        </View>

        {/* ── FOOTER (with page numbers) ─────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLogo}>SmartWMS</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
