import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const VALID_STATUSES = ["pending", "replied", "all"] as const;
type ReviewStatus = typeof VALID_STATUSES[number];

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is accepted", 405);
  }

  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  const authHeader = req.headers.get("Authorization")!;
  const supabase = getUserClient(authHeader);

  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurant_id");

  if (!restaurantId) {
    return errorResponse("VALIDATION_ERROR", "restaurant_id query parameter is required");
  }

  // Validate the restaurant belongs to the user (RLS will also enforce this)
  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .single();

  if (restaurantError || !restaurant) {
    return errorResponse("NOT_FOUND", "Restaurant not found", 404);
  }

  // Parse pagination and filter query params
  const statusParam = (url.searchParams.get("status") ?? "all") as ReviewStatus;
  const status: ReviewStatus = VALID_STATUSES.includes(statusParam)
    ? statusParam
    : "all";

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(
    50,
    Math.max(1, parseInt(url.searchParams.get("per_page") ?? "20", 10))
  );
  const offset = (page - 1) * perPage;

  // Build base query
  let query = supabase
    .from("reviews")
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("posted_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status === "pending") query = query.eq("replied", false);
  if (status === "replied") query = query.eq("replied", true);

  const { data: reviews, count, error } = await query;

  if (error) {
    console.error("List reviews error:", error);
    return errorResponse("DATABASE_ERROR", "Failed to fetch reviews", 500);
  }

  // Get stats (pending/replied counts regardless of current filter)
  const { count: pendingCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("replied", false);

  const { count: repliedCount } = await supabase
    .from("reviews")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("replied", true);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / perPage);

  // Shape the response to match the API spec
  const shapedReviews = (reviews ?? []).map((r) => ({
    id: r.id,
    google_review_id: r.google_review_id,
    reviewer_name: r.reviewer_name,
    reviewer_avatar_url: r.reviewer_avatar_url,
    review_text: r.review_text,
    rating: r.rating,
    posted_at: r.posted_at,
    replied: r.replied,
    reply_text: r.reply_text,
    replied_at: r.replied_at,
    responses: r.response_empathetic
      ? {
          empathetic: r.response_empathetic,
          professional: r.response_professional,
          casual: r.response_casual,
        }
      : null,
    responses_generated_at: r.responses_generated_at,
  }));

  return jsonResponse({
    reviews: shapedReviews,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
    },
    stats: {
      pending: pendingCount ?? 0,
      replied: repliedCount ?? 0,
      total: (pendingCount ?? 0) + (repliedCount ?? 0),
    },
  });
});
