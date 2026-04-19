import { getServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/ratelimit.ts";

interface PlacesResult {
  name: string;
  slug: string;
  location: string;
  review_count: number;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is accepted", 405);
  }

  // Rate limit: 30 searches per minute per IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit("demo-search", ip, 30, 60);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many search requests. Please slow down.", 429);
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return errorResponse("VALIDATION_ERROR", "Search query must be at least 2 characters");
  }

  const supabase = getServiceClient();
  const cacheKey = query.toLowerCase();

  // Check cache first (24h TTL)
  const { data: cached } = await supabase
    .from("demo_search_cache")
    .select("results, expires_at")
    .eq("query", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (cached) {
    return jsonResponse({ results: cached.results, cached: true });
  }

  // Call Google Places API
  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!googleApiKey) {
    console.error("GOOGLE_PLACES_API_KEY is not set");
    return jsonResponse({ results: [] });
  }

  let results: PlacesResult[] = [];

  try {
    const placesUrl = new URL(
      "https://maps.googleapis.com/maps/api/place/textsearch/json"
    );
    placesUrl.searchParams.set("query", `${query} restaurant`);
    placesUrl.searchParams.set("type", "restaurant");
    placesUrl.searchParams.set("key", googleApiKey);

    const placesRes = await fetch(placesUrl.toString());
    const placesData = await placesRes.json();

    if (placesData.status === "OK" && Array.isArray(placesData.results)) {
      results = placesData.results.slice(0, 5).map(
        (place: {
          name: string;
          formatted_address?: string;
          vicinity?: string;
          user_ratings_total?: number;
        }) => ({
          name: place.name,
          slug: slugify(place.name),
          location: extractCity(place.formatted_address ?? place.vicinity ?? ""),
          review_count: place.user_ratings_total ?? 0,
        })
      );
    }
  } catch (err) {
    console.error("Google Places API error:", err);
    // Fall through with empty results
  }

  // Store in cache (upsert to handle concurrent requests)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("demo_search_cache")
    .upsert(
      {
        query: cacheKey,
        results,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "query" }
    );

  return jsonResponse({ results });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractCity(address: string): string {
  // Google addresses are typically "street, city, state zip, country"
  // We want "City, State" portion
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`.replace(
      /\s\d{5}(-\d{4})?/,
      ""
    );
  }
  return parts.slice(0, 2).join(", ");
}
