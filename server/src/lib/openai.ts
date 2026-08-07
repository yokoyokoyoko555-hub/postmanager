import OpenAI from "openai";

let client: OpenAI | null = null;

export function openaiClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function generateJson<T>(prompt: string, maxTokens = 1000): Promise<T> {
  const res = await openaiClient().chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = res.choices[0]?.message?.content ?? "";
  return JSON.parse(raw) as T;
}
