import { getUser, unauthorizedResponse } from "../_shared/auth.ts";
import { getServiceClient, getUserClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Special cron-triggered internal action — called with service role key
  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization") ?? "";
    const isCronCall = authHeader.includes(
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "____"
    );

    if (isCronCall) {
      let body: { action?: string };
      try {
        body = await req.json();
      } catch {
        body = {};
      }

      if (body.action === "sync_subscriptions") {
        return await syncSubscriptionsWithPaddle();
      }
    }
  }

  // All other billing endpoints require user auth
  const user = await getUser(req);
  if (!user) return unauthorizedResponse();

  const authHeader = req.headers.get("Authorization")!;
  const supabase = getUserClient(authHeader);
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  // -----------------------------------------------------------------------
  // GET /billing?type=subscription — current subscription + usage
  // -----------------------------------------------------------------------
  if (req.method === "GET" && type === "subscription") {
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subError || !sub) {
      // No subscription — return a free/no-plan state
      return jsonResponse({
        plan: null,
        usage: { reviews_used: 0, reviews_limit: 0 },
        payment_method: null,
      });
    }

    // Get reviews used in the current billing period
    const serviceSupabase = getServiceClient();
    const { data: usage } = await serviceSupabase
      .from("subscription_usage")
      .select("reviews_used, reviews_limit")
      .eq("user_id", user.id)
      .single();

    // Fetch payment method details from Paddle if we have a subscription ID
    let paymentMethod: {
      brand: string;
      last4: string;
      expiry: string;
    } | null = null;

    if (sub.paddle_subscription_id) {
      paymentMethod = await fetchPaddlePaymentMethod(sub.paddle_subscription_id);
    }

    return jsonResponse({
      plan: {
        name: sub.plan_name,
        price: sub.price,
        period: sub.period,
        status: sub.status,
        next_billing_date: sub.next_billing_date,
        paddle_subscription_id: sub.paddle_subscription_id,
      },
      usage: {
        reviews_used: Number(usage?.reviews_used ?? 0),
        reviews_limit: usage?.reviews_limit ?? sub.reviews_limit,
      },
      payment_method: paymentMethod,
    });
  }

  // -----------------------------------------------------------------------
  // GET /billing?type=invoices — invoice history
  // -----------------------------------------------------------------------
  if (req.method === "GET" && type === "invoices") {
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch invoices error:", error);
      return errorResponse("DATABASE_ERROR", "Failed to fetch invoices", 500);
    }

    return jsonResponse({
      invoices: (invoices ?? []).map((inv) => ({
        id: inv.id,
        paddle_invoice_id: inv.paddle_transaction_id,
        date: inv.created_at,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        download_url: inv.download_url,
      })),
    });
  }

  // -----------------------------------------------------------------------
  // POST /billing — generate Paddle customer portal URL
  // -----------------------------------------------------------------------
  if (req.method === "POST") {
    let body: { action?: string };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (body.action === "portal" || !body.action) {
      const serviceSupabase = getServiceClient();
      const { data: sub } = await serviceSupabase
        .from("subscriptions")
        .select("paddle_customer_id")
        .eq("user_id", user.id)
        .single();

      if (!sub?.paddle_customer_id) {
        return errorResponse(
          "NO_SUBSCRIPTION",
          "No active subscription found",
          404
        );
      }

      const portalUrl = await generatePaddlePortalUrl(sub.paddle_customer_id);
      if (!portalUrl) {
        return errorResponse(
          "PADDLE_ERROR",
          "Failed to generate billing portal URL",
          502
        );
      }

      return jsonResponse({ url: portalUrl });
    }
  }

  return errorResponse("NOT_FOUND", "Route not found", 404);
});

// ---------------------------------------------------------------------------
// Paddle API helpers
// ---------------------------------------------------------------------------

async function fetchPaddlePaymentMethod(
  subscriptionId: string
): Promise<{ brand: string; last4: string; expiry: string } | null> {
  const paddleKey = Deno.env.get("PADDLE_API_KEY");
  if (!paddleKey) return null;

  try {
    const res = await fetch(
      `https://api.paddle.com/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${paddleKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const pm = data.data?.payment_information;

    if (!pm) return null;

    return {
      brand: pm.card_type ?? pm.type ?? "Unknown",
      last4: pm.last_four ?? "****",
      expiry: pm.expiry_month && pm.expiry_year
        ? `${String(pm.expiry_month).padStart(2, "0")}/${String(pm.expiry_year).slice(-2)}`
        : "N/A",
    };
  } catch {
    return null;
  }
}

async function generatePaddlePortalUrl(
  customerId: string
): Promise<string | null> {
  const paddleKey = Deno.env.get("PADDLE_API_KEY");
  if (!paddleKey) return null;

  try {
    const res = await fetch(
      `https://api.paddle.com/customers/${customerId}/portal-sessions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paddleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      console.error("Paddle portal error:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.data?.urls?.general?.overview ?? null;
  } catch {
    return null;
  }
}

async function syncSubscriptionsWithPaddle(): Promise<Response> {
  const { jsonResponse: jr } = await import("../_shared/cors.ts");
  const paddleKey = Deno.env.get("PADDLE_API_KEY");
  if (!paddleKey) {
    return jr({ synced: 0, error: "PADDLE_API_KEY not set" });
  }

  const supabase = getServiceClient();

  // Fetch all active/trialing subscriptions
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, user_id, paddle_subscription_id, status")
    .in("status", ["active", "trialing", "past_due"])
    .not("paddle_subscription_id", "is", null);

  if (!subs || subs.length === 0) {
    return jr({ synced: 0 });
  }

  let synced = 0;

  for (const sub of subs) {
    try {
      const res = await fetch(
        `https://api.paddle.com/subscriptions/${sub.paddle_subscription_id}`,
        {
          headers: { Authorization: `Bearer ${paddleKey}` },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const paddleSub = data.data;

      const statusMap: Record<string, string> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        canceled: "canceled",
        paused: "canceled",
      };

      const newStatus = statusMap[paddleSub.status] ?? sub.status;

      if (newStatus !== sub.status) {
        await supabase
          .from("subscriptions")
          .update({
            status: newStatus,
            next_billing_date: paddleSub.next_billed_at ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }

      synced++;
    } catch (err) {
      console.error(`Sync failed for subscription ${sub.paddle_subscription_id}:`, err);
    }
  }

  return jr({ synced });
}
