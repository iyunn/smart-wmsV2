import { randomInt } from "node:crypto";

// Password sementara untuk reset oleh Super Admin: 12 karakter acak dari alfabet tanpa
// huruf/angka yang mirip (0/O, 1/l/I), dikelompokkan 4-4-4 agar mudah didiktekan.
// ±68 bit entropi — cukup untuk password yang wajib diganti saat login pertama.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTempPassword(): string {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `${group()}-${group()}-${group()}`;
}
