import { getServiceClient } from "../_shared/supabase.ts";

// ---------------------------------------------------------------------------
// Paddle Webhook Receiver
//
// Verifies the Paddle-Signature header using HMAC-SHA256 before processing
// any event. See: https://developer.paddle.com/webhooks/signature-verification
//
// No CORS headers needed — this endpoint is server-to-server only.
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // -------------------------------------------------------------------------
  // Signature verification
  // -------------------------------------------------------------------------
  const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("PADDLE_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signatureHeader = req.headers.get("paddle-signature");
  if (!signatureHeader) {
    return new Response("Missing paddle-signature header", { status: 401 });
  }

  const isValid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValid) {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  // -------------------------------------------------------------------------
  // Parse event
  // -------------------------------------------------------------------------
  let event: { event_type: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    switch (event.event_type) {
      case "subscription.created":
      case "subscription.updated":
        await handleSubscriptionCreatedOrUpdated(supabase, event.data);
        break;

      case "subscription.canceled":
        await handleSubscriptionCanceled(supabase, event.data);
        break;

      case "subscription.past_due":
        await handleSubscriptionPastDue(supabase, event.data);
        break;

      case "transaction.completed":
        await handleTransactionCompleted(supabase, event.data);
        break;

      case "transaction.payment_failed":
        await handlePaymentFailed(supabase, event.data);
        break;

      default:
        // Acknowledge but ignore unhandled event types
        console.log(`Unhandled Paddle event: ${event.event_type}`);
    }
  } catch (err) {
    console.error(`Error processing Paddle event ${event.event_type}:`, err);
    // Return 200 anyway to prevent Paddle from retrying non-recoverable errors
    return new Response(JSON.stringify({ received: true, error: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleSubscriptionCreatedOrUpdated(
  supabase: ReturnType<typeof getServiceClient>,
  data: Record<string, unknown>
) {
  const customerId = data.customer_id as string;
  const subscriptionId = data.id as string;

  if (!customerId || !subscriptionId) {
    console.error("Missing customer_id or subscription id in subscription event");
    return;
  }

  // Find the user associated with this Paddle customer
  const userId = await findUserByCustomerId(supabase, customerId);
  if (!userId) {
    console.warn(`No user found for Paddle customer ${customerId}`);
    return;
  }

  const items = (data.items as Array<Record<string, unknown>>) ?? [];
  const firstItem = items[0] ?? {};
  const price = (firstItem.price as Record<string, unknown>) ?? {};
  const billingCycle = (data.billing_cycle as Record<string, unknown>) ?? {};
  const currentPeriod = (data.current_billing_period as Record<string, unknown>) ?? {};

  const planLimits: Record<string, number> = {
    Starter: 50,
    Growth: 200,
    Scale: 999999,
  };

  const planName = (price.description as string) ?? "Unknown";

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: subscriptionId,
      paddle_customer_id: customerId,
      plan_name: planName,
      price: Number((price.unit_price as Record<string, unknown>)?.amount ?? 0),
      period: (billingCycle.interval as string) === "year" ? "annual" : "monthly",
      status: mapPaddleStatus(data.status as string),
      reviews_limit: planLimits[planName] ?? 50,
      next_billing_date: (data.next_billed_at as string) ?? null,
      current_period_start: (currentPeriod.starts_at as string) ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

async function handleSubscriptionCanceled(
  supabase: ReturnType<typeof getServiceClient>,
  data: Record<string, unknown>
) {
  const subscriptionId = data.id as string;
  if (!subscriptionId) return;

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", subscriptionId);
}

async function handleSubscriptionPastDue(
  supabase: ReturnType<typeof getServiceClient>,
  data: Record<string, unknown>
) {
  const subscriptionId = data.id as string;
  if (!subscriptionId) return;

  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", subscriptionId);
}

async function handleTransactionCompleted(
  supabase: ReturnType<typeof getServiceClient>,
  data: Record<string, unknown>
) {
  const customerId = data.customer_id as string;
  const transactionId = data.id as string;

  if (!customerId || !transactionId) return;

  const userId = await findUserByCustomerId(supabase, customerId);
  if (!userId) return;

  const details = (data.details as Record<string, unknown>) ?? {};
  const totals = (details.totals as Record<string, unknown>) ?? {};
  const total = Number(totals.total ?? 0);

  // Fetch the invoice PDF URL from Paddle
  const downloadUrl = await fetchInvoiceUrl(transactionId);

  // Upsert invoice (idempotent — Paddle may resend the event)
  await supabase.from("invoices").upsert(
    {
      user_id: userId,
      paddle_transaction_id: transactionId,
      amount: total,
      currency: (data.currency_code as string) ?? "USD",
      status: "paid",
      download_url: downloadUrl,
      created_at: (data.created_at as string) ?? new Date().toISOString(),
    },
    { onConflict: "paddle_transaction_id" }
  );
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof getServiceClient>,
  data: Record<string, unknown>
) {
  const subscriptionId = data.subscription_id as string;
  if (!subscriptionId) return;

  // Mark the subscription as past_due
  await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", subscriptionId);

  // Future improvement: send a payment failure email to the user
  console.log(`Payment failed for subscription ${subscriptionId}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findUserByCustomerId(
  supabase: ReturnType<typeof getServiceClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("paddle_customer_id", customerId)
    .single();

  return data?.user_id ?? null;
}

async function fetchInvoiceUrl(transactionId: string): Promise<string | null> {
  const paddleKey = Deno.env.get("PADDLE_API_KEY");
  if (!paddleKey) return null;

  try {
    const res = await fetch(
      `https://api.paddle.com/transactions/${transactionId}/invoice`,
      {
        headers: { Authorization: `Bearer ${paddleKey}` },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.url as string) ?? null;
  } catch {
    return null;
  }
}

function mapPaddleStatus(paddleStatus: string): string {
  const map: Record<string, string> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "canceled",
    paused: "canceled",
  };
  return map[paddleStatus] ?? "active";
}

/**
 * Verifies a Paddle webhook signature.
 *
 * The Paddle-Signature header format is:
 *   ts=<timestamp>;h1=<hex_hmac>
 *
 * The signed payload is:  <timestamp>:<raw_body>
 * The algorithm is:       HMAC-SHA256 using the webhook secret.
 *
 * Reference: https://developer.paddle.com/webhooks/signature-verification
 */
async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(";").map((part) => part.split("=") as [string, string])
    );

    const ts = parts["ts"];
    const h1 = parts["h1"];

    if (!ts || !h1) return false;

    const signedPayload = `${ts}:${rawBody}`;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedPayload)
    );

    const computed = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    return constantTimeEqual(computed, h1);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
