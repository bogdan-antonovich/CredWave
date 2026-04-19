import { getServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/ratelimit.ts";
import { generateResponses } from "../_shared/ai.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is accepted", 405);
  }

  // Rate limit: 60 requests per minute per IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit("demo-blocks", ip, 60, 60);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please slow down.", 429);
  }

  // Extract slug from path: /demo-blocks/<slug>
  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/+/, "").split("/");
  const slug = segments[segments.length - 1] ?? "";

  if (!slug || slug.length < 2) {
    return errorResponse("VALIDATION_ERROR", "Restaurant slug is required");
  }

  const supabase = getServiceClient();

  // Try to find pre-generated blocks in the database
  const { data: blocks, error } = await supabase
    .from("review_blocks")
    .select("*")
    .eq("restaurant_name", slug)
    .order("id", { ascending: true });

  if (error) {
    console.error("Failed to fetch review blocks:", error);
    return errorResponse("DATABASE_ERROR", "Failed to fetch review blocks", 500);
  }

  if (blocks && blocks.length > 0) {
    return jsonResponse({
      restaurant_name: slug,
      blocks: blocks.map(shapeBlock),
    });
  }

  // No pre-generated blocks found — try to generate on the fly using Google Places
  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!googleApiKey || !openaiKey) {
    // Return empty gracefully — frontend should show a fallback
    return jsonResponse({ restaurant_name: slug, blocks: [] });
  }

  let generatedBlocks: typeof blocks = [];

  try {
    // 1. Look up the restaurant by slug on Google Places
    const placesUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/textsearch/json"
    );
    placesUrl.searchParams.set("query", slug.replace(/-/g, " ") + " restaurant");
    placesUrl.searchParams.set("type", "restaurant");
    placesUrl.searchParams.set("key", googleApiKey);

    const placesRes = await fetch(placesUrl.toString());
    const placesData = await placesRes.json();

    if (placesData.status !== "OK" || !placesData.results?.length) {
      return jsonResponse({ restaurant_name: slug, blocks: [] });
    }

    const place = placesData.results[0];
    const placeId: string = place.place_id;
    const restaurantName: string = place.name;

    // 2. Fetch reviews for this place
    const detailsUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json"
    );
    detailsUrl.searchParams.set("place_id", placeId);
    detailsUrl.searchParams.set("fields", "name,reviews");
    detailsUrl.searchParams.set("key", googleApiKey);

    const detailsRes = await fetch(detailsUrl.toString());
    const detailsData = await detailsRes.json();

    const reviews: Array<{
      author_name: string;
      rating: number;
      text: string;
    }> = detailsData.result?.reviews ?? [];

    if (!reviews.length) {
      return jsonResponse({ restaurant_name: slug, blocks: [] });
    }

    // 3. Generate AI responses for each review (up to 3)
    const targets = reviews.slice(0, 3);
    const insertPayload: Array<{
      restaurant_name: string;
      reviewer_name: string;
      review_text: string;
      rating: number;
      response_a: string;
      response_b: string;
      response_c: string;
    }> = [];

    for (const review of targets) {
      const responses = await generateResponses({
        review_text: review.text ?? "",
        rating: review.rating ?? 3,
        reviewer_name: review.author_name ?? "Guest",
        restaurant_name: restaurantName,
        restaurant_info: "",
        owner_name: "",
        custom_instructions: "",
      });

      insertPayload.push({
        restaurant_name: slug,
        reviewer_name: review.author_name ?? "Guest",
        review_text: review.text ?? "",
        rating: review.rating ?? 3,
        response_a: responses.empathetic,
        response_b: responses.professional,
        response_c: responses.casual,
      });
    }

    // 4. Cache the generated blocks in the database
    const { data: saved } = await supabase
      .from("review_blocks")
      .insert(insertPayload)
      .select();

    generatedBlocks = saved ?? [];
  } catch (err) {
    console.error("On-the-fly generation failed:", err);
    return jsonResponse({ restaurant_name: slug, blocks: [] });
  }

  return jsonResponse({
    restaurant_name: slug,
    blocks: generatedBlocks.map(shapeBlock),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shapeBlock(b: {
  id: string;
  restaurant_name: string;
  reviewer_name: string | null;
  review_text: string | null;
  rating: number | null;
  response_a: string | null;
  response_b: string | null;
  response_c: string | null;
}) {
  return {
    id: b.id,
    reviewer_name: b.reviewer_name,
    review_text: b.review_text,
    rating: b.rating,
    response_a: b.response_a,
    response_b: b.response_b,
    response_c: b.response_c,
  };
}
