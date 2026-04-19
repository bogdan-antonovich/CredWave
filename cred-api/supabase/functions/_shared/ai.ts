// ---------------------------------------------------------------------------
// AI Response Generation
// Uses OpenAI GPT-4o-mini for text generation tasks.
// ---------------------------------------------------------------------------

export interface GenerateInput {
  review_text: string;
  rating: number;
  reviewer_name: string;
  restaurant_name: string;
  restaurant_info: string;
  owner_name: string;
  custom_instructions?: string;
}

export interface GenerateOutput {
  empathetic: string;
  professional: string;
  casual: string;
}

/**
 * Generates three review responses (empathetic, professional, casual)
 * for the given review using the OpenAI API.
 */
export async function generateResponses(
  input: GenerateInput
): Promise<GenerateOutput> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const systemPrompt = buildSystemPrompt(input);
  const userMessage = buildUserMessage(input);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: GenerateOutput;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }

  if (!parsed.empathetic || !parsed.professional || !parsed.casual) {
    throw new Error("AI response missing one or more tone fields");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(input: GenerateInput): string {
  const lines = [
    "You are an expert in customer communication for restaurants.",
    "",
    `Restaurant: ${input.restaurant_name}`,
    `Owner: ${input.owner_name}`,
    `About: ${input.restaurant_info || "No additional info provided."}`,
  ];

  if (input.custom_instructions) {
    lines.push(`Special instructions: ${input.custom_instructions}`);
  }

  lines.push(
    "",
    "You will receive a customer review. Write exactly THREE responses to it, one per tone:",
    "",
    '- "empathetic": warm, emotionally aware, shows genuine understanding of the customer\'s feelings',
    '- "professional": polished, business-appropriate, courteous and measured',
    '- "casual": friendly, relaxed, conversational — as if talking to a regular guest',
    "",
    "Rules for every response:",
    "- Address the reviewer by their first name",
    "- Acknowledge specific points from their review",
    "- Keep each response between 2 and 4 sentences",
    "- Never be defensive, sarcastic, or dismissive",
    "- For negative reviews: apologize sincerely, explain what you will do differently, and invite the customer back",
    "- For positive reviews: express genuine gratitude, echo what they praised, and invite them to return",
    "- Do not invent facts about the restaurant that are not in the context above",
    "",
    "Respond ONLY with a valid JSON object. No markdown, no backticks, no preamble.",
    'Format: {"empathetic": "...", "professional": "...", "casual": "..."}'
  );

  return lines.join("\n");
}

function buildUserMessage(input: GenerateInput): string {
  return [
    `Reviewer: ${input.reviewer_name}`,
    `Star rating: ${input.rating} / 5`,
    `Review text: "${input.review_text}"`,
  ].join("\n");
}
