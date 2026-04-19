/**
 * CORS headers for all Edge Function responses.
 *
 * In production, tighten Access-Control-Allow-Origin to:
 *   "https://credwave.app, https://dashboard.credwave.app"
 *
 * For now "*" is used to allow local development without extra config.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, x-client-info, apikey",
};

/**
 * Returns a 204 No Content response for OPTIONS preflight requests,
 * or null if the request is not a preflight.
 * Call this at the very top of every Edge Function handler.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return null;
}

/**
 * Wraps any JSON value in a Response with the correct Content-Type
 * and CORS headers already applied.
 */
export function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Builds a standard error response.
 */
export function errorResponse(
  code: string,
  message: string,
  status = 400
): Response {
  return jsonResponse({ error: { code, message } }, status);
}
