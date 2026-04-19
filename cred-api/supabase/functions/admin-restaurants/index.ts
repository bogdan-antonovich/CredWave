import { getAdminUser, unauthorizedResponse, forbiddenResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // All admin endpoints require admin role
  const user = await getAdminUser(req);
  if (!user) {
    // Distinguish between unauthenticated and unauthorized
    const { getUser } = await import("../_shared/auth.ts");
    const basicUser = await getUser(req);
    if (!basicUser) return unauthorizedResponse();
    return forbiddenResponse("Admin role required");
  }

  const supabase = getServiceClient();
  const url = new URL(req.url);

  // Resolve optional :slug from path
  // Path pattern: /admin-restaurants or /admin-restaurants/<slug>
  const segments = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  const slug = segments.length > 1 ? segments[segments.length - 1] : null;

  // -----------------------------------------------------------------------
  // GET /admin/restaurants — list all restaurant slugs
  // -----------------------------------------------------------------------
  if (req.method === "GET" && !slug) {
    const { data, error } = await supabase
      .from("review_blocks")
      .select("restaurant_name")
      .order("restaurant_name");

    if (error) {
      console.error("Admin list restaurants error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch restaurant list", 500);
    }

    // Return unique slugs
    const unique = [...new Set((data ?? []).map((r) => r.restaurant_name))];
    return jsonResponse({ restaurants: unique });
  }

  // -----------------------------------------------------------------------
  // POST /admin/restaurants — create a new restaurant page (slug)
  // -----------------------------------------------------------------------
  if (req.method === "POST" && !slug) {
    let body: { name?: string; slug?: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Request body must be valid JSON");
    }

    const { name, slug: inputSlug } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "name is required");
    }
    if (!inputSlug || typeof inputSlug !== "string" || inputSlug.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "slug is required");
    }

    const cleanSlug = inputSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Check for existing slug
    const { data: existing } = await supabase
      .from("review_blocks")
      .select("id")
      .eq("restaurant_name", cleanSlug)
      .limit(1);

    if (existing && existing.length > 0) {
      return errorResponse("CONFLICT", `Slug "${cleanSlug}" already exists`, 409);
    }

    // Insert a placeholder block so the slug is registered
    const { error: insertError } = await supabase.from("review_blocks").insert({
      restaurant_name: cleanSlug,
      reviewer_name: null,
      review_text: null,
      rating: null,
      response_a: null,
      response_b: null,
      response_c: null,
    });

    if (insertError) {
      console.error("Admin create restaurant error:", insertError);
      return errorResponse("DATABASE_ERROR", "Failed to create restaurant page", 500);
    }

    return jsonResponse({ slug: cleanSlug }, 201);
  }

  // -----------------------------------------------------------------------
  // DELETE /admin/restaurants/:slug — delete all blocks for a slug
  // -----------------------------------------------------------------------
  if (req.method === "DELETE" && slug) {
    const { error } = await supabase
      .from("review_blocks")
      .delete()
      .eq("restaurant_name", slug);

    if (error) {
      console.error("Admin delete restaurant error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to delete restaurant page", 500);
    }

    return new Response(null, { status: 204 });
  }

  return errorResponse("NOT_FOUND", "Route not found", 404);
});
