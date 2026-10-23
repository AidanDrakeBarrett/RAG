import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }

  if (typeof body.question !== "string" || !body.question.trim()) {
    return jsonResponse({ error: "Question must be a non-empty string" }, 400);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error("OPENAI_API_KEY is not configured for this function");
    return jsonResponse({ error: "Embedding service is not configured" }, 500);
  }

  try {
    const openAiResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: body.question.trim(),
        dimensions: 1536,
      }),
    });

    if (!openAiResponse.ok) {
      console.error("OpenAI embedding request failed with status", openAiResponse.status);
      return jsonResponse({ error: "Embedding provider request failed" }, 502);
    }

    const result = await openAiResponse.json();
    const embedding = result?.data?.[0]?.embedding;

    if (
      !Array.isArray(embedding) ||
      embedding.length !== 1536 ||
      !embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value))
    ) {
      console.error("OpenAI returned an invalid embedding vector");
      return jsonResponse({ error: "Embedding provider returned an invalid vector" }, 502);
    }

    // app.js expects the vector at data.embedding from functions.invoke().
    return jsonResponse({ embedding });
  } catch (err) {
    console.error("Embedding request failed", err);
    return jsonResponse({ error: "Could not generate an embedding" }, 500);
  }
});
