import { describe, expect, it } from "vitest";
import { describeFilters, filterAssets, parseFlagQuery, type FilterableAsset } from "./monitoringFilter";

describe("flag yang diketik", () => {
  it("contoh Fillian: jenis:printer ink jet;merk:canon → 2 flag", () => {
    expect(parseFlagQuery("jenis:printer ink jet;merk:canon", "all")).toEqual({
      tags: [{ field: "jenis", value: "printer ink jet" }, { field: "merk", value: "canon" }], rest: "", hasFlags: true,
    });
  });
  it("spasi, huruf besar, alias kolom, titik koma di akhir", () => {
    expect(parseFlagQuery("  Jenis :  Printer  Ink Jet ; MERK: Canon ; kode aset: 2001 ; kategori:c - per;", "all").tags).toEqual([
      { field: "jenis", value: "Printer Ink Jet" }, { field: "merk", value: "Canon" },
      { field: "kode_asset", value: "2001" }, { field: "kategori_oracle", value: "c - per" },
    ]);
  });
  it("perilaku lama dropdown tetap: teks polos → kolom yang dipilih", () => {
    expect(parseFlagQuery("canon", "merk")).toEqual({ tags: [{ field: "merk", value: "canon" }], rest: "", hasFlags: false });
    expect(parseFlagQuery("cpu;intel", "jenis").tags).toEqual([{ field: "jenis", value: "cpu" }, { field: "jenis", value: "intel" }]);
  });
  it("mode Semua Kolom: bagian polos jadi pencarian biasa", () => {
    expect(parseFlagQuery("jenis:cpu;intel core", "all")).toEqual({ tags: [{ field: "jenis", value: "cpu" }], rest: "intel core", hasFlags: true });
    expect(parseFlagQuery("intel core", "all")).toEqual({ tags: [], rest: "intel core", hasFlags: false });
  });
  it("kolom tak dikenal = teks biasa; nilai kosong diabaikan; duplikat dibuang", () => {
    expect(parseFlagQuery("warna:merah", "all")).toEqual({ tags: [], rest: "warna:merah", hasFlags: false });
    expect(parseFlagQuery("jenis:;merk:canon;MERK:CANON", "all").tags).toEqual([{ field: "merk", value: "canon" }]);
    expect(parseFlagQuery("deskripsi:jam 10:30", "all").tags).toEqual([{ field: "deskripsi", value: "jam 10:30" }]);
  });
});

describe("filter aset (layar & PDF)", () => {
  const base = { kode_asset: "", kategori_oracle: "C - PERALATAN KOMPUTER", deskripsi: "", invoice_number: "", catatan: "", kode_tujuan: "", nama_tujuan: "" };
  const assets: FilterableAsset[] = [
    { ...base, toko: "CGA1 - GUDANG 1", jenis: "Printer Ink Jet", merk: "Canon", kode_asset: "A1", kode_tujuan: "T001", nama_tujuan: "Toko Sentosa" },
    { ...base, toko: "CGA2 - GUDANG 2", jenis: "Printer Ink Jet", merk: "Epson", kode_asset: "A2" },
    { ...base, toko: "CGA1 - GUDANG 1", jenis: "Printer Dot Matrix", merk: "Epson", kode_asset: "A3", catatan: "rusak" },
  ];
  const run = (f: Partial<Parameters<typeof filterAssets>[1]>) =>
    filterAssets(assets, { costCenter: "ALL", quickSearch: "", tags: [], ...f }).map((a) => a.kode_asset);

  it("flag AND, cost center, cari semua kolom, catatan terbaru", () => {
    expect(run({})).toEqual(["A1", "A2", "A3"]);
    expect(run({ tags: parseFlagQuery("jenis:printer ink jet;merk:canon", "all").tags })).toEqual(["A1"]);
    expect(run({ costCenter: "CGA1", tags: [{ field: "merk", value: "epson" }] })).toEqual(["A3"]);
    expect(run({ quickSearch: "RUSAK" })).toEqual(["A3"]);
    expect(filterAssets(assets, { costCenter: "ALL", quickSearch: "", tags: [{ field: "catatan", value: "baru" }] },
      (a) => (a.kode_asset === "A2" ? "baru diperbaiki" : a.catatan)).map((a) => a.kode_asset)).toEqual(["A2"]);
  });
  it("Kode Tujuan: flag tujuan: (kode atau nama toko), ikut pencarian semua kolom", () => {
    expect(parseFlagQuery("tujuan:t001;merk:canon", "all").tags).toEqual([{ field: "kode_tujuan", value: "t001" }, { field: "merk", value: "canon" }]);
    expect(run({ tags: [{ field: "kode_tujuan", value: "t001" }] })).toEqual(["A1"]);
    expect(run({ tags: [{ field: "kode_tujuan", value: "sentosa" }] })).toEqual(["A1"]);
    expect(run({ quickSearch: "T001" })).toEqual(["A1"]);
  });
  it("ringkasan filter untuk PDF", () => {
    expect(describeFilters({ costCenter: "CGA1", quickSearch: " ink ", tags: [{ field: "merk", value: "canon" }] }))
      .toBe('CGA1 · Cari "ink" · Merk: canon');
    expect(describeFilters({ costCenter: "ALL", quickSearch: "", tags: [] })).toBe("");
  });
});
