import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken, isWellFormedToken } from "./tokens";

describe("token sesi", () => {
  it("acak, 43 karakter base64url, dan bentuknya dikenali", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isWellFormedToken(a)).toBe(true);
  });

  it("hash deterministik SHA-256 hex dan tidak sama dengan token", () => {
    const t = generateSessionToken();
    expect(hashSessionToken(t)).toBe(hashSessionToken(t));
    expect(hashSessionToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSessionToken(t)).not.toContain(t);
  });

  it("menolak input yang bukan token", () => {
    for (const bad of [undefined, null, 123, "", "pendek", "a".repeat(44), "a".repeat(42) + "!"]) {
      expect(isWellFormedToken(bad)).toBe(false);
    }
  });
});
