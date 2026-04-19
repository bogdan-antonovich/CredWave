import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getServiceClient, getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getGoogleToken, postGoogleReply } from "../_shared/google.ts";
import { checkRateLimit } from "../_shared/ratelimit.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  // Rate limit: 60 replies per hour per user
  const allowed = await checkRateLimit("review-reply", user.id, 60, 3600);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many reply requests. Please slow down.", 429);
  }

  const authHeader = req.headers.get("Authorization")!;
  const userSupabase = getUserClient(authHeader);
  const serviceSupabase = getServiceClient();

  let body: { review_id?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON");
  }

  const { review_id, text } = body;

  if (!review_id) return errorResponse("VALIDATION_ERROR", "review_id is required");
  if (!text || text.trim().length === 0) {
    return errorResponse("VALIDATION_ERROR", "text is required and must not be empty");
  }

  // Fetch the review and its restaurant (RLS enforces ownership)
  const { data: review, error: reviewError } = await userSupabase
    .from("reviews")
    .select("id, google_review_id, replied, restaurant_id")
    .eq("id", review_id)
    .single();

  if (reviewError || !review) {
    return errorResponse("NOT_FOUND", "Review not found", 404);
  }

  if (review.replied) {
    return errorResponse(
      "REVIEW_ALREADY_REPLIED",
      "This review has already been replied to",
      409
    );
  }

  if (!review.google_review_id) {
    return errorResponse(
      "GOOGLE_REVIEW_ID_MISSING",
      "This review has no associated Google review ID",
      422
    );
  }

  // Fetch restaurant Google account/location IDs
  const { data: restaurant } = await userSupabase
    .from("restaurants")
    .select("google_account_id, google_location_id")
    .eq("id", review.restaurant_id)
    .single();

  if (!restaurant?.google_account_id || !restaurant?.google_location_id) {
    return errorResponse(
      "RESTAURANT_NOT_CONFIGURED",
      "Restaurant is missing Google account or location ID",
      422
    );
  }

  // Get a valid Google access token for the user
  let token: string;
  try {
    token = await getGoogleToken(user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("GOOGLE_TOKEN")) {
      return errorResponse(
        "GOOGLE_TOKEN_EXPIRED",
        "Your Google session has expired. Please sign in again.",
        401
      );
    }
    return errorResponse("GOOGLE_AUTH_ERROR", "Failed to obtain Google access token", 500);
  }

  // Post reply to Google Business Profile
  let replyResult: { updateTime: string };
  try {
    replyResult = await postGoogleReply(
      token,
      restaurant.google_account_id,
      restaurant.google_location_id,
      review.google_review_id,
      text.trim()
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Google reply error:", msg);

    if (msg.includes("409") || msg.toLowerCase().includes("already")) {
      return errorResponse("REVIEW_ALREADY_REPLIED", "Reply already exists on Google", 409);
    }

    return errorResponse(
      "GOOGLE_API_ERROR",
      "Failed to post reply to Google. Please try again.",
      502
    );
  }

  const repliedAt = replyResult.updateTime ?? new Date().toISOString();

  // Mark review as replied in the database
  await serviceSupabase
    .from("reviews")
    .update({
      replied: true,
      reply_text: text.trim(),
      replied_at: repliedAt,
    })
    .eq("id", review_id);

  return jsonResponse({
    success: true,
    replied_at: repliedAt,
    google_reply_id: review.google_review_id,
  });
});
