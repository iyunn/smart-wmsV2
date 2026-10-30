"use client";

/**
 * TrendCGACards.tsx
 * Dashboard Baris 3 — Trend jumlah aset per CGA dari data DAT Closing bulanan.
 * Line chart 3 garis (CGA1/CGA2/CGA3), 4 metric toggle: Item/Qty/Nilai/Tercatat.
 * Tombol Export Excel di kanan atas card.
 */

import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────
interface ClosingRow {
  bulan: string;
  cga: string;
  total_items: number;
  total_qty: number;
  total_nilai: number;
  total_tercatat: number;
}

type Metric = "total_items" | "total_qty" | "total_nilai" | "total_tercatat";

const METRIC_LABELS: Record<Metric, string> = {
  total_items:    "Item",
  total_qty:      "Qty",
  total_nilai:    "Nilai Perolehan",
  total_tercatat: "Tercatat",
};

const CGA_COLORS = {
  CGA1: "var(--success-600)", // token tema (STYLEGUIDE §8)
  CGA2: "var(--warning-500)",
  CGA3: "var(--danger-500)",
};

// ── Helpers ───────────────────────────────────────────────────────────────
function formatBulan(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

function formatValue(v: number, metric: Metric): string {
  if (metric === "total_nilai" || metric === "total_tercatat") {
    if (v >= 1_000_000_000) return `${(v/1_000_000_000).toFixed(1)}M`;
    if (v >= 1_000_000)     return `${(v/1_000_000).toFixed(1)}Jt`;
    if (v >= 1_000)         return `${(v/1_000).toFixed(0)}K`;
  }
  return v.toLocaleString("id-ID");
}

// ── Export Excel — 1 sheet semua metric ──────────────────────────────────
function exportTrendToExcel(data: ClosingRow[]) {
  const bulanList = [...new Set(data.map(r => r.bulan))].sort();
  const rows: any[][] = [
    ["Trend CGA — Semua Metric"],
    ["Bulan",
     "CGA1 - Item", "CGA2 - Item", "CGA3 - Item",
     "CGA1 - Qty",  "CGA2 - Qty",  "CGA3 - Qty",
     "CGA1 - Nilai Perolehan", "CGA2 - Nilai Perolehan", "CGA3 - Nilai Perolehan",
     "CGA1 - Tercatat", "CGA2 - Tercatat", "CGA3 - Tercatat",
    ],
  ];
  for (const b of bulanList) {
    const row: any[] = [formatBulan(b)];
    for (const metric of ["total_items","total_qty","total_nilai","total_tercatat"] as const) {
      for (const cga of ["CGA1","CGA2","CGA3"]) {
        const d = data.find(r => r.bulan === b && r.cga === cga);
        row.push(d ? (d as any)[metric] : 0);
      }
    }
    rows.push(row);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 },
    ...Array(12).fill({ wch: 18 }),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trend CGA");
  XLSX.writeFile(wb, `Trend-CGA-${new Date().toISOString().slice(0,7)}.xlsx`);
}

// ── Main Component ────────────────────────────────────────────────────────
function TrendCGACards() {
  const [data, setData]       = useState<ClosingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric]   = useState<Metric>("total_items");

  useEffect(() => {
    fetch("/api/closing")
      .then(r => r.json())
      .then(j => setData(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Transform data ke format recharts: [{ bulan: "Jan 2026", CGA1: 2500, CGA2: 1000, CGA3: 900 }]
  const chartData = useMemo(() => {
    const bulanList = [...new Set(data.map(r => r.bulan))].sort();
    return bulanList.map(b => {
      const entry: any = { bulan: formatBulan(b) };
      for (const cga of ["CGA1","CGA2","CGA3"]) {
        const d = data.find(r => r.bulan === b && r.cga === cga);
        entry[cga] = d ? (d as any)[metric] : null;
      }
      return entry;
    });
  }, [data, metric]);

  const handleExport = useCallback(() => {
    exportTrendToExcel(data);
  }, [data]);

  const isEmpty = !loading && chartData.length === 0;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/[0.04]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-0.5">
            Trend CGA
          </p>
          <p className="text-[12px] text-white/60">Perkembangan aset per Cost Center (closing bulanan)</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {(Object.keys(METRIC_LABELS) as Metric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                  metric === m
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={loading || isEmpty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[11px] font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Chart area */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <svg className="animate-spin text-white/20" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
            </svg>
          </div>
        ) : isEmpty ? (
          <div className="h-[220px] flex flex-col items-center justify-center gap-2">
            <p className="text-[12px] text-white/30">Belum ada data closing</p>
            <a href="/upload" className="text-[11px] text-cyan-400 hover:text-cyan-300">
              Upload DAT Closing →
            </a>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="bulan"
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={55}
                tickFormatter={v => formatValue(v, metric)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "var(--text)",
                }}
                formatter={(value: any) => [formatValue(Number(value), metric), ""]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: "var(--text)" }}>{value}</span>}
              />
              {(["CGA1","CGA2","CGA3"] as const).map(cga => (
                <Line
                  key={cga}
                  type="monotone"
                  dataKey={cga}
                  stroke={CGA_COLORS[cga]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CGA_COLORS[cga] }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default memo(TrendCGACards);
