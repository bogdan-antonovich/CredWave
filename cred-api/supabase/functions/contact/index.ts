import { getServiceClient } from "../_shared/supabase.ts";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp } from "../_shared/ratelimit.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  // Rate limit: 5 submissions per hour per IP
  const ip = getClientIp(req);
  const allowed = await checkRateLimit("contact", ip, 5, 3600);
  if (!allowed) {
    return errorResponse("RATE_LIMITED", "Too many submissions. Please try again later.", 429);
  }

  let body: { name?: string; email?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON");
  }

  const { name, email, message } = body;

  // Validation
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("VALIDATION_ERROR", "name is required");
  }
  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return errorResponse("VALIDATION_ERROR", "A valid email address is required");
  }
  if (!message || typeof message !== "string" || message.trim().length < 10) {
    return errorResponse("VALIDATION_ERROR", "message must be at least 10 characters");
  }

  const supabase = getServiceClient();

  // Store submission in the database
  const { error: dbError } = await supabase.from("contact_submissions").insert({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    message: message.trim(),
  });

  if (dbError) {
    console.error("Failed to store contact submission:", dbError);
    return errorResponse("DATABASE_ERROR", "Failed to save your message. Please try again.", 500);
  }

  // Send notification email via Resend
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const contactEmail = Deno.env.get("CONTACT_EMAIL") ?? "hello@credwave.com";

  if (resendKey) {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CredWave <noreply@credwave.app>",
        to: contactEmail,
        subject: `New contact form submission from ${name.trim()}`,
        text: [
          `Name:    ${name.trim()}`,
          `Email:   ${email.trim()}`,
          ``,
          `Message:`,
          message.trim(),
        ].join("\n"),
        html: `
          <p><strong>Name:</strong> ${escapeHtml(name.trim())}</p>
          <p><strong>Email:</strong> ${escapeHtml(email.trim())}</p>
          <hr />
          <p>${escapeHtml(message.trim()).replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    if (!emailRes.ok) {
      // Log but do not fail the request — the submission is already stored
      console.error("Resend email failed:", await emailRes.text());
    }
  } else {
    console.warn("RESEND_API_KEY not set — email notification skipped");
  }

  return jsonResponse({
    success: true,
    message: "We'll get back to you within 24 hours.",
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
