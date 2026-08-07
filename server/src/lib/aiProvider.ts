import { generateJson as generateJsonClaude } from "./anthropic.js";
import { generateJson as generateJsonOpenAI } from "./openai.js";

export type AiProvider = "claude" | "openai";

export async function generateJson<T>(prompt: string, provider: AiProvider, maxTokens = 1000): Promise<T> {
  if (provider === "openai") return generateJsonOpenAI<T>(prompt, maxTokens);
  return generateJsonClaude<T>(prompt, maxTokens);
}
