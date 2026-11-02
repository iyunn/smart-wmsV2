import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(value: number): string {
  if (value === 0) return '-'
  return new Intl.NumberFormat('id-ID').format(value)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Warna per CGA ────────────────────────────────────────────────────────────
// Disesuaikan dengan badge warna di UI Monitoring: CGA1=emerald, CGA2=amber, CGA3=rose.
// Body table pakai versi opacity diturunkan (masih kelihatan warnanya tapi pudar),
// header tetap solid/pekat sesuai warna signature masing-masing CGA.
type CGAColorSet = {
  header: string        // background header section (solid)
  headerText: string     // text putih di atas header solid
  kategoriBg: string     // background kategori header (pudar)
  kategoriText: string   // text kategori (pekat, kontras dgn bg pudar)
  rowAltBg: string       // background row alternate (sangat pudar)
  subtotalBg: string     // background subtotal row (pudar, sedikit lebih pekat dari row biasa)
  subtotalText: string   // text subtotal (pekat)
  subtotalBorder: string // border atas subtotal
  totalBg: string        // background total toko (solid, sama dengan header)
  totalText: string      // text di atas total solid
}

const CGA_COLORS: Record<string, CGAColorSet> = {
  CGA1: { // emerald
    header: '#059669', headerText: '#ffffff',
    kategoriBg: '#d1fae5', kategoriText: '#065f46',
    rowAltBg: '#ecfdf5',
    subtotalBg: '#a7f3d0', subtotalText: '#065f46', subtotalBorder: '#34d399',
    totalBg: '#059669', totalText: '#ffffff',
  },
  CGA2: { // amber
    header: '#d97706', headerText: '#ffffff',
    kategoriBg: '#fef3c7', kategoriText: '#92400e',
    rowAltBg: '#fffbeb',
    subtotalBg: '#fde68a', subtotalText: '#92400e', subtotalBorder: '#fbbf24',
    totalBg: '#d97706', totalText: '#ffffff',
  },
  CGA3: { // rose
    header: '#e11d48', headerText: '#ffffff',
    kategoriBg: '#fee2e2', kategoriText: '#9f1239',
    rowAltBg: '#fff1f2',
    subtotalBg: '#fecdd3', subtotalText: '#9f1239', subtotalBorder: '#fb7185',
    totalBg: '#e11d48', totalText: '#ffffff',
  },
}

function getCGAColors(tokoCode: string): CGAColorSet {
  return CGA_COLORS[tokoCode] ?? CGA_COLORS.CGA1
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 30,
    backgroundColor: '#ffffff',
  },

  // Header
  header: {
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#1e40af',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLeft: {},
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#64748b',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerDate: {
    fontSize: 7,
    color: '#94a3b8',
  },

  // Cost center section
  sectionHeader: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontSize: 7,
    color: '#93c5fd',
  },

  // Kategori header
  kategoriHeader: {
    backgroundColor: '#dbeafe',
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  kategoriTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    flex: 1,
  },

  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.3,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 2.5,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },

  // Columns
  colJenis: { flex: 3 },
  colItem: { width: 36, textAlign: 'right' },
  colQty: { width: 36, textAlign: 'right' },
  colPerolehan: { width: 80, textAlign: 'right' },
  colTercatat: { width: 80, textAlign: 'right' },

  headerText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  cellText: {
    fontSize: 7,
    color: '#334155',
  },
  cellTextMono: {
    fontSize: 7,
    color: '#1e293b',
    fontFamily: 'Helvetica',
  },

  // Subtotal kategori
  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderTopWidth: 0.5,
    borderTopColor: '#93c5fd',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  subtotalText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
  },

  // Total toko
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  totalText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 5,
  },
  footerText: {
    fontSize: 6,
    color: '#94a3b8',
  },
  pageNumber: {
    fontSize: 6,
    color: '#94a3b8',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface JenisData {
  jenis: string
  item: number
  qty: number
  perolehan: number
  tercatat: number
}

interface KategoriData {
  kategori: string
  items: JenisData[]
  totalItem: number
  totalQty: number
  totalPerolehan: number
  totalTercatat: number
}

interface TokoData {
  toko: string
  tokoCode: string
  kategoris: KategoriData[]
  totalItem: number
  totalQty: number
  totalPerolehan: number
  totalTercatat: number
}

interface DATSummaryProps {
  data: TokoData[]
  generatedAt: string
  /** Ringkasan filter Monitoring (mis. "CGA1 · Jenis: printer · Merk: canon"); kosong = semua data */
  filterLabel?: string
}

// ─── Components ───────────────────────────────────────────────────────────────

const TableHeader = () => (
  <View style={styles.tableHeader}>
    <Text style={[styles.headerText, styles.colJenis]}>Jenis Barang</Text>
    <Text style={[styles.headerText, styles.colItem]}>Item</Text>
    <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
    <Text style={[styles.headerText, styles.colPerolehan]}>Perolehan (Rp)</Text>
    <Text style={[styles.headerText, styles.colTercatat]}>Tercatat (Rp)</Text>
  </View>
)

const KategoriSection = ({ kategori, colors }: { kategori: KategoriData; colors: CGAColorSet }) => (
  <View>
    {/* Kategori header — bg pudar sesuai warna CGA */}
    <View style={[styles.kategoriHeader, { backgroundColor: colors.kategoriBg }]}>
      <Text style={[styles.kategoriTitle, { color: colors.kategoriText }]}>{kategori.kategori}</Text>
    </View>

    <TableHeader />

    {/* Rows — alternate row pakai bg sangat pudar sesuai warna CGA */}
    {kategori.items.map((item, i) => (
      <View
        key={item.jenis}
        style={[styles.tableRow, i % 2 === 1 ? { backgroundColor: colors.rowAltBg } : {}]}
      >
        <Text style={[styles.cellText, styles.colJenis]}>{item.jenis}</Text>
        <Text style={[styles.cellTextMono, styles.colItem]}>{item.item}</Text>
        <Text style={[styles.cellTextMono, styles.colQty]}>{item.qty}</Text>
        <Text style={[styles.cellTextMono, styles.colPerolehan]}>
          {formatRupiah(item.perolehan)}
        </Text>
        <Text style={[styles.cellTextMono, styles.colTercatat]}>
          {formatRupiah(item.tercatat)}
        </Text>
      </View>
    ))}

    {/* Subtotal kategori — bg pudar lebih pekat dari row biasa, sesuai warna CGA */}
    <View style={[
      styles.subtotalRow,
      { backgroundColor: colors.subtotalBg, borderTopColor: colors.subtotalBorder },
    ]}>
      <Text style={[styles.subtotalText, styles.colJenis, { color: colors.subtotalText }]}>
        Subtotal {kategori.kategori}
      </Text>
      <Text style={[styles.subtotalText, styles.colItem, { color: colors.subtotalText }]}>{kategori.totalItem}</Text>
      <Text style={[styles.subtotalText, styles.colQty, { color: colors.subtotalText }]}>{kategori.totalQty}</Text>
      <Text style={[styles.subtotalText, styles.colPerolehan, { color: colors.subtotalText }]}>
        {formatRupiah(kategori.totalPerolehan)}
      </Text>
      <Text style={[styles.subtotalText, styles.colTercatat, { color: colors.subtotalText }]}>
        {formatRupiah(kategori.totalTercatat)}
      </Text>
    </View>
  </View>
)

// ─── Main Document ────────────────────────────────────────────────────────────
// Setiap CGA di-render di <Page> tersendiri (bukan satu Page berisi semua),
// sehingga konten yang tidak penuh 1 halaman akan menyisakan area kosong,
// dan CGA berikutnya selalu mulai di halaman baru.

export function DATSummaryDocument({ data, generatedAt, filterLabel = "" }: DATSummaryProps) {
  return (
    <Document
      title="Laporan Rekap DAT - Smart Warehouse"
      author="SmartWMS"
      subject="Daftar Aktiva Tetap Summary"
    >
      {data.map((toko) => {
        const colors = getCGAColors(toko.tokoCode)
        return (
          <Page key={toko.toko} size="A4" style={styles.page}>

            {/* Header */}
            <View style={styles.header} fixed>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Laporan Rekap DAT</Text>
                <Text style={styles.headerSubtitle}>
                  Smart Asset Monitoring & Reconciliation System
                </Text>
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.headerDate}>
                  Digenerate: {formatDate(generatedAt)}
                </Text>
                <Text style={styles.headerDate}>
                  {filterLabel ? `Filter: ${filterLabel}` : "Semua data"}
                </Text>
              </View>
            </View>

            {/* Cost center header — solid sesuai warna CGA */}
            <View style={[styles.sectionHeader, { backgroundColor: colors.header }]}>
              <Text style={[styles.sectionTitle, { color: colors.headerText }]}>{toko.toko}</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.headerText, opacity: 0.85 }]}>
                {toko.totalItem} item · Qty {toko.totalQty}
              </Text>
            </View>

            {/* Kategori sections */}
            {toko.kategoris.map((kat) => (
              <KategoriSection key={kat.kategori} kategori={kat} colors={colors} />
            ))}

            {/* Total toko — solid sesuai warna CGA */}
            <View style={[styles.totalRow, { backgroundColor: colors.totalBg }]}>
              <Text style={[styles.totalText, styles.colJenis, { color: colors.totalText }]}>
                TOTAL {toko.tokoCode}
              </Text>
              <Text style={[styles.totalText, styles.colItem, { color: colors.totalText }]}>{toko.totalItem}</Text>
              <Text style={[styles.totalText, styles.colQty, { color: colors.totalText }]}>{toko.totalQty}</Text>
              <Text style={[styles.totalText, styles.colPerolehan, { color: colors.totalText }]}>
                {formatRupiah(toko.totalPerolehan)}
              </Text>
              <Text style={[styles.totalText, styles.colTercatat, { color: colors.totalText }]}>
                {formatRupiah(toko.totalTercatat)}
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>
                SmartWMS — Laporan Rekap DAT
              </Text>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) =>
                  `Halaman ${pageNumber} dari ${totalPages}`
                }
              />
            </View>
          </Page>
        )
      })}
    </Document>
  )
}
