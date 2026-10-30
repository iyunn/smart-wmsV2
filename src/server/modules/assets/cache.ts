import "server-only";

// Cache in-memory per proses (TTL 5 menit) untuk daftar nilai yang jarang berubah —
// pengganti cache module-level di route V1. Diinvalidasi otomatis setiap keyword rule
// berubah atau DAT di-upload (sebelumnya hanya lewat panggilan DELETE dari browser).

const TTL_MS = 5 * 60 * 1000;
// Disimpan di globalThis (seperti instance `db`): bundler Next bisa memuat modul ini lebih dari
// sekali (per route / hot reload); satu Map per proses menjamin invalidasi dari route mana pun
// terlihat oleh semua route.
const g = globalThis as unknown as { __smartwmsCache?: Map<string, { value: unknown; expires: number }> };
const store = (g.__smartwmsCache ??= new Map());

export async function cached<T>(key: string, load: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
  const e = store.get(key);
  if (e && e.expires > Date.now()) return { value: e.value as T, hit: true };
  const value = await load();
  store.set(key, { value, expires: Date.now() + TTL_MS });
  return { value, hit: false };
}

export function invalidate(prefix?: string): void {
  if (!prefix) return store.clear();
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export const CACHE = {
  krValues: (type: string) => `kr-values-${type}`,
  masterJenis: "master-jenis",
  masterMerk: "master-merk",
} as const;
