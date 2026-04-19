import { getServiceClient } from "../_shared/supabase.ts";
import { getGoogleToken } from "../_shared/google.ts";

// ---------------------------------------------------------------------------
// Google Token Refresh — cron target
//
// Called by pg_cron every 45 minutes via net.http_post.
// Can also be called directly for a specific user_id.
//
// Authentication: service role key (Bearer token from cron) or a specific
// user_id passed in the request body.
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify the caller is the cron job (service role key)
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isCronCall =
    authHeader === `Bearer ${serviceKey}` || authHeader.includes(serviceKey);

  if (!isCronCall) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { user_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body — refresh all expiring tokens
  }

  const supabase = getServiceClient();

  if (body.user_id) {
    // Refresh a single user's token
    try {
      await getGoogleToken(body.user_id);
      return new Response(
        JSON.stringify({ refreshed: 1, user_id: body.user_id }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error(`Token refresh failed for user ${body.user_id}:`, err);
      return new Response(
        JSON.stringify({
          refreshed: 0,
          user_id: body.user_id,
          error: String(err),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Refresh all tokens expiring within the next 15 minutes
  const { data: expiring, error } = await supabase
    .from("user_google_tokens")
    .select("user_id")
    .lt(
      "token_expires_at",
      new Date(Date.now() + 15 * 60 * 1000).toISOString()
    );

  if (error) {
    console.error("Failed to query expiring tokens:", error);
    return new Response(
      JSON.stringify({ refreshed: 0, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!expiring || expiring.length === 0) {
    return new Response(
      JSON.stringify({ refreshed: 0, message: "No tokens to refresh" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  let refreshed = 0;
  const failures: string[] = [];

  for (const row of expiring) {
    try {
      await getGoogleToken(row.user_id);
      refreshed++;
    } catch (err) {
      console.error(`Token refresh failed for user ${row.user_id}:`, err);
      failures.push(row.user_id);
    }
  }

  return new Response(
    JSON.stringify({
      refreshed,
      failed: failures.length,
      failed_user_ids: failures,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
