"use client";

// ══════════════════════════════════════════════════════════════════════════
// ColorPicker — roda warna (Tahap 9b-2). Pengganti <input type="color"> yang tampilannya
// beda di tiap browser. Tombol contoh warna → panel: cincin hue (roda) + kotak
// saturasi/kecerahan di tengahnya + warna lain di tema ini (supaya mudah serasi).
//
// - Geser dengan mouse/jari (pointer capture), atau keyboard: panah ±1, Shift+panah ±10
// - Hue diingat saat warna jadi abu-abu/hitam (s/v = 0) supaya roda tidak meloncat
// - Esc / klik di luar = tutup; perubahan langsung dikirim lewat onChange (pratinjau)
// Konversi warna: src/lib/theme/color.ts
// ══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { type Hsv, angleToHue, hexToHsv, hsvToHex } from "@/lib/theme/color";

const SIZE = 208;          // diameter roda (px)
const RING = 18;           // tebal cincin hue
const SQUARE = Math.floor((SIZE - RING * 2 - 12) / Math.SQRT2); // kotak S/V muat di dalam cincin
const PANEL_HEIGHT = 400;  // perkiraan tinggi panel (roda + baris warna) untuk memilih buka ke atas/bawah

interface Props {
  value: string;                 // #RRGGBB
  onChange: (hex: string) => void;
  label: string;                 // nama warna (aksesibilitas)
  swatches?: string[];           // warna lain di tema ini
}

export default function ColorPicker({ value, onChange, label, swatches = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false); // panel dibuka ke atas bila ruang di bawah kurang
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Nilai dari luar (ketik hex, preset, reset) → sinkronkan, tapi pertahankan hue bila warnanya sama
  useEffect(() => {
    setHsv((cur) => (hsvToHex(cur) === value.toUpperCase() ? cur : hexToHsv(value)));
  }, [value]);

  const emit = useCallback((next: Hsv) => {
    setHsv(next);
    onChange(hsvToHex(next));
  }, [onChange]);

  // Tutup: klik di luar / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  // ── Cincin hue ──────────────────────────────────────────────────────────
  const ringRef = useRef<HTMLDivElement>(null);
  const hueFromPointer = (e: React.PointerEvent) => {
    const r = ringRef.current!.getBoundingClientRect();
    emit({ ...hsv, h: angleToHue(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) });
  };

  // ── Kotak saturasi / kecerahan ──────────────────────────────────────────
  const svRef = useRef<HTMLDivElement>(null);
  const svFromPointer = (e: React.PointerEvent) => {
    const r = svRef.current!.getBoundingClientRect();
    const s = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const v = Math.min(100, Math.max(0, 100 - ((e.clientY - r.top) / r.height) * 100));
    emit({ ...hsv, s, v });
  };

  const drag = (handler: (e: React.PointerEvent) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      handler(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) handler(e);
    },
  });

  const step = (e: React.KeyboardEvent) => (e.shiftKey ? 10 : 1);
  const onHueKey = (e: React.KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? step(e) : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step(e) : 0;
    if (!d) return;
    e.preventDefault();
    emit({ ...hsv, h: (hsv.h + d + 360) % 360 });
  };
  const onSvKey = (e: React.KeyboardEvent) => {
    const k = e.key, n = step(e);
    let { s, v } = hsv;
    if (k === "ArrowRight") s += n; else if (k === "ArrowLeft") s -= n;
    else if (k === "ArrowUp") v += n; else if (k === "ArrowDown") v -= n;
    else return;
    e.preventDefault();
    emit({ ...hsv, s: Math.min(100, Math.max(0, s)), v: Math.min(100, Math.max(0, v)) });
  };

  const hueRad = (hsv.h * Math.PI) / 180;
  const ringR = SIZE / 2 - RING / 2;
  const hueThumb = { left: SIZE / 2 + ringR * Math.sin(hueRad), top: SIZE / 2 - ringR * Math.cos(hueRad) };
  const pure = hsvToHex({ h: hsv.h, s: 100, v: 100 });
  const current = hsvToHex(hsv);
  const ringMask = `radial-gradient(farthest-side, transparent calc(100% - ${RING}px), #000 calc(100% - ${RING}px + 1px))`;
  const others = Array.from(new Set(swatches.map((s) => s.toUpperCase()))).filter((s) => s !== current);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button ref={triggerRef} type="button"
        onClick={() => {
          if (!open && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setDropUp(window.innerHeight - r.bottom < PANEL_HEIGHT && r.top > window.innerHeight - r.bottom);
          }
          setOpen((o) => !o);
        }}
        aria-label={`${label}: ${value}. Buka roda warna`} aria-expanded={open} aria-controls={open ? panelId : undefined}
        className="block h-10 w-12 rounded-lg border border-line-strong p-0.5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent">
        <span className="block h-full w-full rounded-md" style={{ background: value }} />
      </button>

      {open && (
        <div id={panelId} role="dialog" aria-label={`Roda warna — ${label}`}
          className={`absolute left-0 z-40 w-[248px] rounded-2xl border border-line bg-surface p-5 shadow-2xl ${dropUp ? "bottom-full mb-2" : "top-full mt-2"}`}>
          {/* Roda: cincin hue + kotak S/V */}
          <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
            <div ref={ringRef} role="slider" tabIndex={0} aria-label="Hue (rona warna)"
              aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(hsv.h)} aria-valuetext={`${Math.round(hsv.h)} derajat`}
              {...drag(hueFromPointer)} onKeyDown={onHueKey}
              className="absolute inset-0 cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{
                background: "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                WebkitMask: ringMask, mask: ringMask,
              }} />
            <span aria-hidden className="pointer-events-none absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.45)]"
              style={{ ...hueThumb, background: pure }} />

            <div ref={svRef} role="slider" tabIndex={0} aria-label="Kepekatan (kiri-kanan) dan kecerahan (atas-bawah)"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hsv.s)}
              aria-valuetext={`kepekatan ${Math.round(hsv.s)}%, kecerahan ${Math.round(hsv.v)}%`}
              {...drag(svFromPointer)} onKeyDown={onSvKey}
              className="absolute cursor-crosshair touch-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{
                width: SQUARE, height: SQUARE, left: (SIZE - SQUARE) / 2, top: (SIZE - SQUARE) / 2,
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${pure})`,
              }}>
              <span aria-hidden className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
                style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: current }} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className="h-8 w-8 shrink-0 rounded-lg border border-line-strong" style={{ background: current }} />
            <span className="font-mono text-[13px] text-body">{current}</span>
            <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
              className="ml-auto rounded-lg border border-line-strong px-3 py-1.5 text-[12px] font-semibold text-body hover:text-heading">
              Selesai
            </button>
          </div>

          {others.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium text-muted">Warna lain di tema ini</p>
              <div className="flex flex-wrap gap-1.5">
                {others.map((c) => (
                  <button key={c} type="button" onClick={() => emit(hexToHsv(c))} title={c} aria-label={`Pakai ${c}`}
                    className="h-6 w-6 rounded-md border border-line-strong transition-transform hover:scale-110" style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
