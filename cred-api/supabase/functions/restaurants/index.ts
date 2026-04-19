import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  const authHeader = req.headers.get("Authorization")!;
  const supabase = getUserClient(authHeader);

  const url = new URL(req.url);
  // Extract optional :id path segment
  // Function is mounted at /restaurants — path may be /restaurants or /restaurants/<id>
  const segments = url.pathname.replace(/^\/+/, "").split("/");
  const restaurantId = segments[1] ?? null;

  // -----------------------------------------------------------------------
  // GET /restaurants — list all restaurants belonging to the current user
  // -----------------------------------------------------------------------
  if (req.method === "GET" && !restaurantId) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("List restaurants error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch restaurants", 500);
    }

    return jsonResponse({ restaurants: data ?? [] });
  }

  // -----------------------------------------------------------------------
  // PATCH /restaurants/:id — update restaurant settings
  // -----------------------------------------------------------------------
  if (req.method === "PATCH" && restaurantId) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON");
    }

    // Only allow updating safe fields
    const allowedFields = ["name", "owner_name", "additional_info", "address"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse("VALIDATION_ERROR", "No updatable fields provided");
    }

    updates["updated_at"] = new Date().toISOString();

    const { data, error } = await supabase
      .from("restaurants")
      .update(updates)
      .eq("id", restaurantId)
      .select()
      .single();

    if (error) {
      console.error("Update restaurant error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to update restaurant", 500);
    }

    if (!data) {
      return errorResponse("NOT_FOUND", "Restaurant not found", 404);
    }

    return jsonResponse(data);
  }

  return errorResponse("NOT_FOUND", "Route not found", 404);
});
