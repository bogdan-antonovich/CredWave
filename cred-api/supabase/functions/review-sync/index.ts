import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getServiceClient, getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import {
  getGoogleToken,
  fetchGoogleReviews,
  postGoogleReply,
  starRatingToInt,
  GoogleReview,
} from "../_shared/google.ts";
import { generateResponses } from "../_shared/ai.ts";
import { checkRateLimit } from "../_shared/ratelimit.ts";

// ---------------------------------------------------------------------------
// This function can be called two ways:
//   1. Manually by an authenticated user: POST /review-sync with { restaurant_id }
//   2. By the pg_cron job: POST /review-sync with { restaurant_id, user_id }
//      using the service role key as Bearer token
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  let body: { restaurant_id?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON");
  }

  const serviceSupabase = getServiceClient();

  // Determine the calling context: cron job (service role) vs. authenticated user
  const authHeader = req.headers.get("Authorization") ?? "";
  const isCronCall = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "____");

  let userId: string;
  let restaurantId: string;

  if (isCronCall) {
    // Cron path — user_id and restaurant_id are passed in the body
    if (!body.user_id || !body.restaurant_id) {
      return errorResponse("VALIDATION_ERROR", "user_id and restaurant_id are required for cron calls");
    }
    userId = body.user_id;
    restaurantId = body.restaurant_id;
  } else {
    // Manual path — validate the user's JWT
    const user = await getUser(req);
    if (!user) return unauthorizedResponse();

    if (!body.restaurant_id) {
      return errorResponse("VALIDATION_ERROR", "restaurant_id is required");
    }

    // Rate limit: 10 manual syncs per hour per user
    const allowed = await checkRateLimit("review-sync", user.id, 10, 3600);
    if (!allowed) {
      return errorResponse("RATE_LIMITED", "Too many sync requests. Please wait before syncing again.", 429);
    }

    userId = user.id;
    restaurantId = body.restaurant_id;

    // Verify the restaurant belongs to the user
    const userSupabase = getUserClient(authHeader);
    const { data: restaurant, error } = await userSupabase
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .single();

    if (error || !restaurant) {
      return errorResponse("NOT_FOUND", "Restaurant not found", 404);
    }
  }

  // Fetch restaurant details (always use service client for cron safety)
  const { data: restaurant, error: restaurantError } = await serviceSupabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (restaurantError || !restaurant) {
    return errorResponse("NOT_FOUND", "Restaurant not found", 404);
  }

  if (!restaurant.google_account_id || !restaurant.google_location_id) {
    return jsonResponse({ new_reviews: 0, synced_at: new Date().toISOString(), skipped: true, reason: "Restaurant not linked to Google Business Profile" });
  }

  // Get a valid Google access token
  let token: string;
  try {
    token = await getGoogleToken(userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error(`Google token error for user ${userId}:`, msg);
    return errorResponse("GOOGLE_TOKEN_ERROR", `Google token unavailable: ${msg}`, 401);
  }

  // Fetch reviews from Google
  let googleReviews: GoogleReview[];
  try {
    googleReviews = await fetchGoogleReviews(
      token,
      restaurant.google_account_id,
      restaurant.google_location_id
    );
  } catch (err) {
    console.error("Failed to fetch Google reviews:", err);
    return errorResponse("GOOGLE_API_ERROR", "Failed to fetch reviews from Google", 502);
  }

  // Load existing google_review_ids to find new reviews
  const { data: existing } = await serviceSupabase
    .from("reviews")
    .select("google_review_id")
    .eq("restaurant_id", restaurantId);

  const existingIds = new Set((existing ?? []).map((r) => r.google_review_id));
  const newReviews = googleReviews.filter(
    (r) => !existingIds.has(r.reviewId)
  );

  // Fetch auto-reply config
  const { data: autoReplyConfig } = await serviceSupabase
    .from("auto_reply_config")
    .select("enabled, default_tone, custom_instructions")
    .eq("restaurant_id", restaurantId)
    .single();

  let newCount = 0;

  for (const gr of newReviews) {
    const rating = starRatingToInt(gr.starRating);
    const reviewerName = gr.reviewer?.displayName ?? "Guest";
    const reviewText = gr.comment ?? "";

    // Generate AI responses for the new review
    let responses: { empathetic: string; professional: string; casual: string } | null = null;
    let generatedAt: string | null = null;

    try {
      responses = await generateResponses({
        review_text: reviewText,
        rating,
        reviewer_name: reviewerName,
        restaurant_name: restaurant.name,
        restaurant_info: restaurant.additional_info ?? "",
        owner_name: restaurant.owner_name ?? "",
        custom_instructions: autoReplyConfig?.custom_instructions ?? "",
      });
      generatedAt = new Date().toISOString();
    } catch (err) {
      console.error(`AI generation failed for review ${gr.reviewId}:`, err);
      // Continue — store the review even without AI responses
    }

    // Determine if a reply already exists on Google
    const existingReply = gr.reviewReply?.comment ?? null;

    // Insert the review
    const { data: insertedReview, error: insertError } = await serviceSupabase
      .from("reviews")
      .insert({
        restaurant_id: restaurantId,
        google_review_id: gr.reviewId,
        reviewer_name: reviewerName,
        reviewer_avatar_url: gr.reviewer?.profilePhotoUrl ?? null,
        review_text: reviewText,
        rating,
        posted_at: gr.createTime,
        replied: !!existingReply,
        reply_text: existingReply,
        replied_at: existingReply ? gr.reviewReply?.updateTime ?? null : null,
        response_empathetic: responses?.empathetic ?? null,
        response_professional: responses?.professional ?? null,
        response_casual: responses?.casual ?? null,
        responses_generated_at: generatedAt,
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Failed to insert review ${gr.reviewId}:`, insertError);
      continue;
    }

    newCount++;

    // Auto-reply: post if enabled and the review has no existing reply
    if (
      autoReplyConfig?.enabled &&
      !existingReply &&
      responses &&
      insertedReview
    ) {
      const tone = autoReplyConfig.default_tone ?? "professional";
      const replyText =
        tone === "empathetic"
          ? responses.empathetic
          : tone === "casual"
          ? responses.casual
          : responses.professional;

      try {
        const replyResult = await postGoogleReply(
          token,
          restaurant.google_account_id,
          restaurant.google_location_id,
          gr.reviewId,
          replyText
        );

        await serviceSupabase
          .from("reviews")
          .update({
            replied: true,
            reply_text: replyText,
            replied_at: replyResult.updateTime ?? new Date().toISOString(),
          })
          .eq("id", insertedReview.id);
      } catch (err) {
        console.error(`Auto-reply failed for review ${gr.reviewId}:`, err);
      }
    }
  }

  const syncedAt = new Date().toISOString();

  // Update the restaurant's last synced_at (stored in review rows, no separate field needed)
  // Optionally track sync time on the restaurant row if added in schema

  return jsonResponse({ new_reviews: newCount, synced_at: syncedAt });
});
