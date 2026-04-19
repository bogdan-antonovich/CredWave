import { getServiceClient } from "./supabase.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface GoogleReviewsResponse {
  reviews?: GoogleReview[];
  nextPageToken?: string;
  totalReviewCount?: number;
}

// ---------------------------------------------------------------------------
// Star rating conversion
// ---------------------------------------------------------------------------

const STAR_TO_INT: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export function starRatingToInt(star: string): number {
  return STAR_TO_INT[star] ?? 0;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/**
 * Returns a valid Google access token for the given user.
 * Automatically refreshes the token if it is about to expire (within 5 min).
 * Throws if no tokens are found or the refresh fails.
 */
export async function getGoogleToken(userId: string): Promise<string> {
  const supabase = getServiceClient();

  const { data: tokens, error } = await supabase
    .from("user_google_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !tokens) {
    throw new Error("GOOGLE_TOKEN_NOT_FOUND");
  }

  // Return the current token if it is still valid (with 5 min buffer)
  const expiresAt = tokens.token_expires_at
    ? new Date(tokens.token_expires_at).getTime()
    : 0;
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt > Date.now() + bufferMs) {
    return tokens.access_token;
  }

  // Refresh the token
  if (!tokens.refresh_token) {
    throw new Error("GOOGLE_REFRESH_TOKEN_MISSING");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const refreshData = await res.json();

  if (!res.ok || !refreshData.access_token) {
    throw new Error("GOOGLE_TOKEN_REFRESH_FAILED");
  }

  const newExpiresAt = new Date(
    Date.now() + (refreshData.expires_in ?? 3600) * 1000
  ).toISOString();

  await supabase
    .from("user_google_tokens")
    .update({
      access_token: refreshData.access_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return refreshData.access_token;
}

// ---------------------------------------------------------------------------
// Google Business Profile API calls
// ---------------------------------------------------------------------------

/**
 * Fetches reviews from the Google Business Profile API.
 * Paginates automatically and returns all reviews.
 */
export async function fetchGoogleReviews(
  token: string,
  accountId: string,
  locationId: string
): Promise<GoogleReview[]> {
  const all: GoogleReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
    );
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google API error ${res.status}: ${text}`);
    }

    const data: GoogleReviewsResponse = await res.json();
    if (data.reviews) all.push(...data.reviews);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

/**
 * Posts or updates a reply to a Google Business Profile review.
 * Set validateOnly=true to test without actually posting.
 */
export async function postGoogleReply(
  token: string,
  accountId: string,
  locationId: string,
  reviewId: string,
  comment: string,
  validateOnly = false
): Promise<{ updateTime: string }> {
  const url = new URL(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`
  );
  if (validateOnly) url.searchParams.set("validateOnly", "true");

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google reply error ${res.status}: ${text}`);
  }

  return res.json();
}
