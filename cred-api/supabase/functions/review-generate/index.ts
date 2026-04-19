import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getServiceClient, getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { generateResponses } from "../_shared/ai.ts";
import { checkRateLimit } from "../_shared/ratelimit.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  // Rate limit: 30 generations per hour per user
  const allowed = await checkRateLimit("review-generate", user.id, 30, 3600);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many generation requests. Please wait before trying again.", 429);
  }

  const authHeader = req.headers.get("Authorization")!;
  const userSupabase = getUserClient(authHeader);
  const serviceSupabase = getServiceClient();

  let body: { review_id?: string; additional_context?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON");
  }

  const { review_id, additional_context } = body;

  if (!review_id) {
    return errorResponse("VALIDATION_ERROR", "review_id is required");
  }

  // Fetch the review (RLS ensures the user owns this review's restaurant)
  const { data: review, error: reviewError } = await userSupabase
    .from("reviews")
    .select("*, restaurant_id")
    .eq("id", review_id)
    .single();

  if (reviewError || !review) {
    return errorResponse("NOT_FOUND", "Review not found", 404);
  }

  // Fetch restaurant + auto-reply config for context
  const { data: restaurant } = await userSupabase
    .from("restaurants")
    .select("name, owner_name, additional_info")
    .eq("id", review.restaurant_id)
    .single();

  const { data: autoReply } = await userSupabase
    .from("auto_reply_config")
    .select("custom_instructions")
    .eq("restaurant_id", review.restaurant_id)
    .single();

  if (!restaurant) {
    return errorResponse("NOT_FOUND", "Restaurant not found", 404);
  }

  // Generate AI responses
  let responses: { empathetic: string; professional: string; casual: string };
  try {
    responses = await generateResponses({
      review_text: review.review_text ?? "",
      rating: review.rating ?? 3,
      reviewer_name: review.reviewer_name ?? "Guest",
      restaurant_name: restaurant.name,
      restaurant_info: restaurant.additional_info ?? "",
      owner_name: restaurant.owner_name ?? "",
      custom_instructions: additional_context
        ? `${autoReply?.custom_instructions ?? ""}\n${additional_context}`.trim()
        : (autoReply?.custom_instructions ?? ""),
    });
  } catch (err) {
    console.error("AI generation error:", err);
    return errorResponse("AI_ERROR", "Failed to generate AI responses. Please try again.", 500);
  }

  const generatedAt = new Date().toISOString();

  // Store responses in the review row (service client bypasses RLS for update)
  const { error: updateError } = await serviceSupabase
    .from("reviews")
    .update({
      response_empathetic: responses.empathetic,
      response_professional: responses.professional,
      response_casual: responses.casual,
      responses_generated_at: generatedAt,
    })
    .eq("id", review_id);

  if (updateError) {
    console.error("Failed to save generated responses:", updateError);
    // Return responses anyway — the user can still see them
  }

  return jsonResponse({
    responses,
    generated_at: generatedAt,
  });
});
