import { describe, expect, it } from "vitest";
import { checkPasswordStrength } from "../../auth/policy";
import { generateTempPassword } from "./temp-password";

describe("password sementara", () => {
  it("format 4-4-4 tanpa karakter yang mirip, lolos aturan password", () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{4}-[A-HJ-NP-Za-km-np-z2-9]{4}-[A-HJ-NP-Za-km-np-z2-9]{4}$/);
      expect(p).not.toMatch(/[0O1lI]/);
      expect(checkPasswordStrength(p)).toBeNull();
    }
  });

  it("acak (tidak ada yang kembar dalam 1000 kali)", () => {
    const set = new Set(Array.from({ length: 1000 }, generateTempPassword));
    expect(set.size).toBe(1000);
  });
});
