import { describe, expect, it } from "vitest";
import { extractCGA, extractCGACodeLoose, extractCGACodeOrSelf } from "./cga";

describe("ekstrak kode CGA dari label toko", () => {
  it("extractCGA: kode atau string kosong", () => {
    expect(extractCGA("CGA1 - Cadangan General Affairs 1")).toBe("CGA1");
    expect(extractCGA("gudang cga3")).toBe("CGA3");
    expect(extractCGA("G801 - Toko Mana")).toBe("");
    expect(extractCGA(null)).toBe("");
  });

  it("extractCGACodeLoose: boleh ada spasi, selain itu label apa adanya", () => {
    expect(extractCGACodeLoose("CGA 2 - Cadangan")).toBe("CGA2");
    expect(extractCGACodeLoose("G801 - Toko")).toBe("G801 - Toko");
  });

  it("extractCGACodeOrSelf: label apa adanya / 'Unknown' bila kosong", () => {
    expect(extractCGACodeOrSelf("cga1 x")).toBe("CGA1");
    expect(extractCGACodeOrSelf("G801")).toBe("G801");
    expect(extractCGACodeOrSelf(null)).toBe("Unknown");
  });
});
