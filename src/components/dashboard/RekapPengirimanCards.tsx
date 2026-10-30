"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { RekapPengiriman } from "@/hooks/useDashboardStats";

// ─── Card 1: Mutasi Progress ────────────────────────────────────────────────
const MutasiProgressCard = memo(({
  data, loading,
}: {
  data: RekapPengiriman["mutasiProgress"] | null;
  loading: boolean;
}) => {
  const d = data ?? { totalAT: 0, sudahMutasi: 0, belumMutasi: 0, progressPct: 0, terlamaHari: null };

  // Warning kalau ada item belum mutasi yang sudah > 14 hari
  const isWarning = (d.terlamaHari ?? 0) > 14;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-semibold text-white/70">Progres Mutasi Oracle</h3>
        <span className="text-[10px] text-white/30">item AT yang sudah keluar</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
          <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
          <div className="h-12 w-full bg-white/5 rounded animate-pulse" />
        </div>
      ) : (
        <>
          {/* Persentase besar */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-emerald-400">{d.progressPct}%</span>
            <span className="text-[10px] text-white/40">
              {d.sudahMutasi.toLocaleString()} / {d.totalAT.toLocaleString()} item
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-white/[0.04] rounded-full overflow-hidden mb-3">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${d.progressPct}%` }}
            />
          </div>

          {/* 3 angka kecil */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-widest text-white/30">Total AT</p>
              <p className="text-[13px] font-semibold text-white/80">{d.totalAT.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-widest text-emerald-400/70">Mutasi ✓</p>
              <p className="text-[13px] font-semibold text-emerald-300">{d.sudahMutasi.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-widest text-amber-400/70">Belum Mutasi</p>
              <p className="text-[13px] font-semibold text-amber-300">{d.belumMutasi.toLocaleString()}</p>
            </div>
          </div>

          {/* Terlama belum mutasi */}
          <div className={`text-[10px] flex items-center gap-1.5 ${isWarning ? "text-rose-300" : "text-white/40"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isWarning ? "bg-rose-400" : "bg-white/30"}`} />
            {d.terlamaHari === null
              ? "Tidak ada item belum mutasi"
              : <>Terlama belum mutasi: <span className="font-semibold">{d.terlamaHari} hari</span> yang lalu</>}
          </div>
        </>
      )}
    </div>
  );
});
MutasiProgressCard.displayName = "MutasiProgressCard";

// ─── Card 2: Top 5 Jenis Belum Alokasi ──────────────────────────────────────
const TopJenisCard = memo(({
  data, bulanLabel, loading,
}: {
  data: RekapPengiriman["topJenisBelumAlokasi"];
  bulanLabel: string;
  loading: boolean;
}) => {
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[12px] font-semibold text-white/70">Top 5 Jenis Barang Keluar</h3>
        <span className="text-[10px] text-white/30">{bulanLabel}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-[11px] text-white/30 py-6 text-center">Belum ada aset yang dialokasikan</p>
      ) : (
        <div className="space-y-2">
          {data.map((d, idx) => {
            const pct = total === 0 ? 0 : (d.total / total) * 100;
            return (
              <div key={d.jenis} className="relative">
                <div className="flex items-center justify-between text-[11px] mb-1 relative z-10">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {idx + 1}
                    </span>
                    <span className="text-white/70 truncate" title={d.jenis}>{d.jenis}</span>
                  </span>
                  <span className="font-mono text-white/80 font-semibold">{d.total.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500/40 to-blue-500/40"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
TopJenisCard.displayName = "TopJenisCard";

// ─── Card 3: Daily Shipment (bulan berjalan) ────────────────────────────────
const DailyShipmentCard = memo(({
  data, bulanLabel, loading,
}: {
  data: RekapPengiriman["dailyShipment"];
  bulanLabel: string;
  loading: boolean;
}) => {
  const total = data.reduce((s, d) => s + d.total, 0);
  const peak = data.reduce((max, d) => (d.total > max.total ? d : max), { tanggal: "", total: 0 });

  // Format X axis: tanggal saja (1, 2, 3, ...) untuk hemat ruang
  const chartData = data.map(d => ({
    day: parseInt(d.tanggal.slice(-2), 10),
    total: d.total,
  }));

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[12px] font-semibold text-white/70">Pengiriman Harian — {bulanLabel}</h3>
          <p className="text-[10px] text-white/30 mt-0.5">Item AT yang keluar via SJ submitted &amp; completed</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-white/30">Total Bulan Ini</p>
            <p className="text-[14px] font-bold text-cyan-300">{total.toLocaleString()}</p>
          </div>
          {peak.total > 0 && (
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-widest text-white/30">Puncak</p>
              <p className="text-[14px] font-bold text-white/70">
                {peak.total} <span className="text-[10px] text-white/40">tgl {parseInt(peak.tanggal.slice(-2), 10)}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-40 bg-white/5 rounded animate-pulse" />
      ) : (
        <div className="h-40 min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={160}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                labelStyle={{ color: "var(--text-muted)" }}
                formatter={(v: any) => [Number(v).toLocaleString(), "Item"]}
                labelFormatter={(label) => `Tanggal ${label}`}
              />
              <Bar dataKey="total" fill="var(--brand-600)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});
DailyShipmentCard.displayName = "DailyShipmentCard";

// ─── Public: 3 cards layout ─────────────────────────────────────────────────
function RekapPengirimanCards({
  data, loading,
}: {
  data: RekapPengiriman | null | undefined;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <MutasiProgressCard data={data?.mutasiProgress ?? null} loading={loading} />
        <TopJenisCard data={data?.topJenisBelumAlokasi ?? []} bulanLabel={data?.bulanLabel ?? ""} loading={loading} />
      </div>
      <DailyShipmentCard
        data={data?.dailyShipment ?? []}
        bulanLabel={data?.bulanLabel ?? ""}
        loading={loading}
      />
    </div>
  );
}

export default memo(RekapPengirimanCards);
