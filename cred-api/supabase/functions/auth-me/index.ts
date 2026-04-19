import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only GET is accepted", 405);
  }

  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  const supabase = getServiceClient();

  // Check whether the stored Google access token is still valid
  const { data: tokens } = await supabase
    .from("user_google_tokens")
    .select("token_expires_at")
    .eq("user_id", user.id)
    .single();

  const googleTokenValid = tokens?.token_expires_at
    ? new Date(tokens.token_expires_at).getTime() > Date.now()
    : false;

  return jsonResponse({
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.full_name as string) ??
      (user.user_metadata?.name as string) ??
      "",
    avatar_url: (user.user_metadata?.avatar_url as string) ?? "",
    google_access_token_valid: googleTokenValid,
    created_at: user.created_at,
  });
});
