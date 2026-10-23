import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const { question, context_talks } = await req.json();

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format the context materials for the prompt safely
    const contextString = (context_talks || []).map((talk: any, index: number) => {
      return "[Source " + (index + 1) + "] Title: "" + talk.title + "", Speaker: " + (talk.speaker || "Unknown") + "\nContent: " + talk.text;
    }).join("\n\n");

    const systemPrompt = "You are a helpful, spiritual AI assistant answering questions about General Conference talks.\n" +
      "Use the following context snippets from General Conference talks to answer the user's question.\n" +
      "Do not make up facts. Answer ONLY using the facts from the provided context. If you don't know the answer or if the context doesn't contain the answer, say so honestly.\n\n" +
      "Always cite the talks you draw from using the format '[Source Number]' (e.g. '[Source 1]'). Cite multiple sources if applicable.\n\n" +
      "Provided Context:\n" + contextString;

    // Call OpenAI API using direct fetch
    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.5
      })
    });

    if (!openAiResponse.ok) {
      const errorDetails = await openAiResponse.text();
      throw new Error("OpenAI API returned error: " + errorDetails);
    }

    const completion = await openAiResponse.json();
    const answer = completion.choices[0]?.message?.content || "No response generated.";

    return new Response(
      JSON.stringify({ answer }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
})
