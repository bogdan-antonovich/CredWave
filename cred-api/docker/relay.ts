/**
 * CredWave Edge Function Relay
 *
 * Acts as a local HTTP server that maps incoming requests to the correct
 * Edge Function handler, mimicking how Supabase routes /functions/v1/<name>.
 *
 * Request path:  /functions/v1/<function-name>[/rest-of-path]
 * Handler file:  /app/functions/<function-name>/index.ts
 *
 * The relay rewrites the request URL so each function sees a clean path
 * (everything after /functions/v1/<name>).
 */

const PORT = 8081;
const FUNCTIONS_DIR = "/app/functions";

// ---------------------------------------------------------------------------
// Import all function handlers at startup.
// Deno does not support dynamic import with arbitrary runtime paths in all
// versions, so we register every known function explicitly.
// ---------------------------------------------------------------------------

import authMe       from "./functions/auth-me/index.ts";
import contact      from "./functions/contact/index.ts";
import restaurants  from "./functions/restaurants/index.ts";
import autoReply    from "./functions/auto-reply/index.ts";
import reviews      from "./functions/reviews/index.ts";
import reviewGen    from "./functions/review-generate/index.ts";
import reviewReply  from "./functions/review-reply/index.ts";
import reviewSync   from "./functions/review-sync/index.ts";
import demoSearch   from "./functions/demo-search/index.ts";
import demoBlocks   from "./functions/demo-blocks/index.ts";
import adminRest    from "./functions/admin-restaurants/index.ts";
import adminBlocks  from "./functions/admin-blocks/index.ts";
import billing      from "./functions/billing/index.ts";
import webhook      from "./functions/paddle-webhook/index.ts";
import tokenRefresh from "./functions/token-refresh/index.ts";

// ---------------------------------------------------------------------------
// Route table:  function name  →  Deno.ServeHandler
// ---------------------------------------------------------------------------

const ROUTES: Record<string, Deno.ServeHandler> = {
  "auth-me":            authMe,
  "contact":            contact,
  "restaurants":        restaurants,
  "auto-reply":         autoReply,
  "reviews":            reviews,
  "review-generate":    reviewGen,
  "review-reply":       reviewReply,
  "review-sync":        reviewSync,
  "demo-search":        demoSearch,
  "demo-blocks":        demoBlocks,
  "admin-restaurants":  adminRest,
  "admin-blocks":       adminBlocks,
  "billing":            billing,
  "paddle-webhook":     webhook,
  "token-refresh":      tokenRefresh,
};

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Health check
  if (pathname === "/health") {
    return new Response(JSON.stringify({ ok: true, functions: Object.keys(ROUTES) }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Expect:  /functions/v1/<name>[/extra]
  const PREFIX = "/functions/v1/";
  if (!pathname.startsWith(PREFIX)) {
    return new Response(
      JSON.stringify({ error: "Not found. Use /functions/v1/<function-name>" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const rest = pathname.slice(PREFIX.length); // e.g. "auth-me" or "demo-blocks/some-slug"
  const [functionName, ...extraSegments] = rest.split("/");

  const handler = ROUTES[functionName];
  if (!handler) {
    return new Response(
      JSON.stringify({ error: `Unknown function: ${functionName}` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Rewrite the URL so the function sees its own path correctly
  // e.g. /functions/v1/demo-blocks/bella-napoli  →  /demo-blocks/bella-napoli
  const rewrittenPath = `/${functionName}${extraSegments.length ? "/" + extraSegments.join("/") : ""}${url.search}`;
  const rewrittenUrl = new URL(rewrittenPath, req.url);

  const rewrittenReq = new Request(rewrittenUrl.toString(), {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? null : req.body,
  });

  try {
    return await handler(rewrittenReq, {
      waitUntil: (_promise: Promise<unknown>) => {},
      passThroughOnException: () => {},
    } as unknown as Deno.ServeHandlerInfo);
  } catch (err) {
    console.error(`[${functionName}] Unhandled error:`, err);
    return new Response(
      JSON.stringify({ error: { code: "INTERNAL_ERROR", message: String(err) } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

console.log(`\nCredWave Edge Function relay listening on http://0.0.0.0:${PORT}`);
console.log(`Registered functions: ${Object.keys(ROUTES).join(", ")}\n`);

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, handleRequest);
