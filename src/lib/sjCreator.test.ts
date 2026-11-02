import { describe, expect, it } from "vitest";
import { SJ_CREATOR_FALLBACK, sjCreatorName } from "./sjCreator";

describe("sjCreatorName", () => {
  it("memakai username pembuat", () => {
    expect(sjCreatorName("aditya")).toBe("aditya");
    expect(sjCreatorName("  fillian ")).toBe("fillian");
  });
  it("SJ lama (pembuat tidak diketahui) tetap 'Admin GA'", () => {
    for (const v of [null, undefined, "", "   ", "Admin GA", "Admin User", "admin user"]) {
      expect(sjCreatorName(v)).toBe(SJ_CREATOR_FALLBACK);
    }
  });
});
