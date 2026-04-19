import { getAdminUser, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const user = await getAdminUser(req);
  if (!user) {
    const { getUser } = await import("../_shared/auth.ts");
    const basicUser = await getUser(req);
    if (!basicUser) return unauthorizedResponse();
    return forbiddenResponse("Admin role required");
  }

  const supabase = getServiceClient();
  const url = new URL(req.url);

  // Path patterns:
  //   GET  /admin-blocks?slug=<slug>   — list blocks for a restaurant slug
  //   PUT  /admin-blocks/<id>          — create or update a block
  //   DELETE /admin-blocks/<id>        — delete a block
  const segments = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const blockId = segments.length > 1 ? segments[segments.length - 1] : null;

  // -----------------------------------------------------------------------
  // GET /admin/restaurants/:slug/blocks — list blocks for a slug
  // -----------------------------------------------------------------------
  if (req.method === "GET") {
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return errorResponse("VALIDATION_ERROR", "slug query parameter is required");
    }

    const { data, error } = await supabase
      .from("review_blocks")
      .select("*")
      .eq("restaurant_name", slug)
      .order("id", { ascending: true });

    if (error) {
      console.error("Admin list blocks error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch review blocks", 500);
    }

    return jsonResponse(data ?? []);
  }

  // -----------------------------------------------------------------------
  // PUT /admin/blocks/:id — create or update a review block
  // -----------------------------------------------------------------------
  if (req.method === "PUT") {
    let body: {
      id?: string;
      restaurant_name?: string;
      reviewer_name?: string;
      review_text?: string;
      rating?: number;
      response_a?: string;
      response_b?: string;
      response_c?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON");
    }

    const {
      id,
      restaurant_name,
      reviewer_name,
      review_text,
      rating,
      response_a,
      response_b,
      response_c,
    } = body;

    if (!restaurant_name || typeof restaurant_name !== "string") {
      return errorResponse("VALIDATION_ERROR", "restaurant_name is required");
    }
    if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
      return errorResponse("VALIDATION_ERROR", "rating must be an integer between 1 and 5");
    }

    const payload = {
      restaurant_name: restaurant_name.trim(),
      reviewer_name: reviewer_name?.trim() ?? null,
      review_text: review_text?.trim() ?? null,
      rating: rating ?? null,
      response_a: response_a?.trim() ?? null,
      response_b: response_b?.trim() ?? null,
      response_c: response_c?.trim() ?? null,
    };

    // Decide whether to insert or update based on the presence of an ID
    const resolvedId = id ?? blockId;

    let data;
    let dbError;

    if (resolvedId) {
      // Update existing block
      ({ data, error: dbError } = await supabase
        .from("review_blocks")
        .update(payload)
        .eq("id", resolvedId)
        .select()
        .single());
    } else {
      // Insert new block
      ({ data, error: dbError } = await supabase
        .from("review_blocks")
        .insert(payload)
        .select()
        .single());
    }

    if (dbError) {
      console.error("Admin upsert block error:", dbError);
      return errorResponse("DATABASE_ERROR", "Failed to save review block", 500);
    }

    if (!data) {
      return errorResponse("NOT_FOUND", "Review block not found", 404);
    }

    return jsonResponse(data);
  }

  // -----------------------------------------------------------------------
  // DELETE /admin/blocks/:id — delete a review block
  // -----------------------------------------------------------------------
  if (req.method === "DELETE" && blockId) {
    const { error } = await supabase
      .from("review_blocks")
      .delete()
      .eq("id", blockId);

    if (error) {
      console.error("Admin delete block error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete review block", 500);
    }

    return new Response(null, { status: 204 });
  }

  return errorResponse("NOT_FOUND", "Route not found", 404);
});
