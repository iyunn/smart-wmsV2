import "server-only";

// Helper respons untuk Route Handler V2.

/** Error tak terduga → log lengkap di server, pesan ke client (bentuk sama dengan V1: { error }). */
export function serverError(tag: string, err: unknown, extra: Record<string, unknown> = {}): Response {
  console.error(`[${tag}]`, err);
  return Response.json(
    { ...extra, error: err instanceof Error ? err.message : "Internal Server Error" },
    { status: 500 },
  );
}

/** Body JSON; body kosong/rusak → {} (sama dengan perilaku `await req.json().catch(() => ({}))` di V1). */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}

/** Error dari database untuk constraint tertentu (kode SQLSTATE). */
export function pgCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}
