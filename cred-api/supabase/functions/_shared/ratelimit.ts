// ---------------------------------------------------------------------------
// Simple in-process rate limiter backed by a Deno.Kv store.
//
// Each Edge Function invocation is short-lived, so persistent rate limiting
// requires an external store. This module uses Deno KV (built into the
// Supabase Deno runtime) which persists across invocations within the
// same region.
//
// Usage:
//   const allowed = await checkRateLimit("reply", userId, 60, 3600);
//   if (!allowed) return errorResponse("RATE_LIMITED", "Too many requests", 429);
// ---------------------------------------------------------------------------

let _kv: Deno.Kv | null = null;

async function getKv(): Promise<Deno.Kv> {
  if (!_kv) _kv = await Deno.openKv();
  return _kv;
}

/**
 * Returns true if the action is within the allowed rate limit,
 * false if the limit has been exceeded.
 *
 * @param action  - A short identifier for the action, e.g. "reply"
 * @param key     - The scope key, e.g. user ID or IP address
 * @param limit   - Maximum number of calls allowed within the window
 * @param windowS - Window size in seconds
 */
export async function checkRateLimit(
  action: string,
  key: string,
  limit: number,
  windowS: number
): Promise<boolean> {
  const kv = await getKv();
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowS);
  const kvKey = ["rate_limit", action, key, bucket];

  const entry = await kv.get<number>(kvKey);
  const current = entry.value ?? 0;

  if (current >= limit) return false;

  await kv.set(kvKey, current + 1, { expireIn: windowS * 1000 });
  return true;
}

/**
 * Returns the caller's IP address from standard proxy headers.
 * Falls back to "unknown" if no header is present.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}
