import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const ALLOWED_TONES = ["empathetic", "professional", "casual"] as const;
type Tone = typeof ALLOWED_TONES[number];

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  const authHeader = req.headers.get("Authorization")!;
  const supabase = getUserClient(authHeader);

  // Resolve restaurant_id from path or query parameter
  // Path pattern: /auto-reply (requires ?restaurant_id=...)
  // Or called as /restaurants/:id/auto-reply — Supabase routes each function
  // by its directory name, so we rely on a query param for the restaurant ID.
  const url = new URL(req.url);
  const restaurantId =
    url.searchParams.get("restaurant_id") ??
    url.pathname.split("/").find((s) => s.length === 36 && s.includes("-")) ??
    null;

  if (!restaurantId) {
    return errorResponse("VALIDATION_ERROR", "restaurant_id is required");
  }

  // Verify the restaurant belongs to the requesting user
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .single();

  if (restaurantError || !restaurant) {
    return errorResponse("NOT_FOUND", "Restaurant not found", 404);
  }

  // -----------------------------------------------------------------------
  // GET — return current auto-reply configuration
  // -----------------------------------------------------------------------
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("auto_reply_config")
      .select("enabled, default_tone, custom_instructions")
      .eq("restaurant_id", restaurantId)
      .single();

    if (error) {
      console.error("Get auto-reply error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch auto-reply config", 500);
    }

    return jsonResponse(
      data ?? { enabled: false, default_tone: "professional", custom_instructions: null }
    );
  }

  // -----------------------------------------------------------------------
  // PATCH — update auto-reply configuration
  // -----------------------------------------------------------------------
  if (req.method === "PATCH") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON");
    }

    const updates: Record<string, unknown> = {};

    if ("enabled" in body) {
      if (typeof body.enabled !== "boolean") {
        return errorResponse("VALIDATION_ERROR", "enabled must be a boolean");
      }
      updates.enabled = body.enabled;
    }

    if ("default_tone" in body) {
      if (!ALLOWED_TONES.includes(body.default_tone as Tone)) {
        return errorResponse(
          "VALIDATION_ERROR",
          `default_tone must be one of: ${ALLOWED_TONES.join(", ")}`
        );
      }
      updates.default_tone = body.default_tone;
    }

    if ("custom_instructions" in body) {
      updates.custom_instructions = body.custom_instructions ?? null;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("VALIDATION_ERROR", "No updatable fields provided");
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("auto_reply_config")
      .update(updates)
      .eq("restaurant_id", restaurantId)
      .select()
      .single();

    if (error) {
      console.error("Update auto-reply error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update auto-reply config", 500);
    }

    return jsonResponse(data);
  }

  return errorResponse("METHOD_NOT_ALLOWED", "Only GET and PATCH are accepted", 405);
});
