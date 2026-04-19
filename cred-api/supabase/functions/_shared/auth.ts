import { User } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceClient } from "./supabase.ts";

/**
 * Validates the Bearer token from the Authorization header and returns
 * the authenticated user, or null if the token is missing or invalid.
 */
export async function getUser(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabase = getServiceClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

/**
 * Validates the token and additionally checks that the user has the
 * "admin" role stored in raw_app_meta_data.
 * Returns the user if admin, otherwise null.
 */
export async function getAdminUser(req: Request): Promise<User | null> {
  const user = await getUser(req);
  if (!user) return null;

  const role = (user.app_metadata as Record<string, string>)?.role;
  if (role !== "admin") return null;

  return user;
}

/**
 * Builds a standard 401 Unauthorized response.
 */
export function unauthorizedResponse(message = "Not authenticated"): Response {
  return new Response(
    JSON.stringify({ error: { code: "UNAUTHORIZED", message } }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Builds a standard 403 Forbidden response.
 */
export function forbiddenResponse(message = "Forbidden"): Response {
  return new Response(
    JSON.stringify({ error: { code: "FORBIDDEN", message } }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}
