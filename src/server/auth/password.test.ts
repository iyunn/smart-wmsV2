import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { BCRYPT_COST, checkPasswordStrength } from "./policy";

describe("password", () => {
  it("hash baru memakai cost sekarang dan bisa diverifikasi", async () => {
    const h = await hashPassword("rahasia-123");
    expect(bcrypt.getRounds(h)).toBe(BCRYPT_COST);
    expect(await verifyPassword("rahasia-123", h)).toBe(true);
    expect(await verifyPassword("rahasia-124", h)).toBe(false);
  });

  it("kompatibel dengan hash Supabase V1 ($2a$, cost 10) dan menandainya untuk di-upgrade", async () => {
    const v1 = bcrypt.hashSync("passwordLama1", 10).replace(/^\$2b\$/, "$2a$");
    expect(v1.startsWith("$2a$10$")).toBe(true);
    expect(await verifyPassword("passwordLama1", v1)).toBe(true);
    expect(needsRehash(v1)).toBe(true);
  });

  it("hash kosong/rusak/penanda '!' selalu ditolak tanpa error", async () => {
    for (const bad of [null, undefined, "", "!", "bukan-hash", "$2a$10$pendek"]) {
      expect(await verifyPassword("apa saja", bad)).toBe(false);
    }
  });

  it("aturan panjang password", () => {
    expect(checkPasswordStrength("1234567")).toBe("too_short");
    expect(checkPasswordStrength("12345678")).toBeNull();
    expect(checkPasswordStrength("a".repeat(73))).toBe("too_long");
    expect(checkPasswordStrength("é".repeat(37))).toBe("too_long"); // 74 byte UTF-8
  });
});
