import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function anthropicClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    client = new Anthropic({ apiKey });
  }
  return client;
}

// 自由記述でJSON文字列を書かせてJSON.parseする方式だと、Claudeがまれに
// 厳密なJSON構文を守らない(改行やクォートの扱いミスなど)ことがあり、
// パースエラーで日次レポート生成が失敗する事例が実際にあった。
// Tool Use(強制的に1つのツールを呼ばせる)にすると、Anthropic側で構造化
// パース済みのオブジェクトが返るため、この種の構文エラーが起こらない。
export async function generateJson<T>(prompt: string, maxTokens = 1000): Promise<T> {
  const res = await anthropicClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: "respond",
        description: "指示されたJSON形式で回答する",
        input_schema: { type: "object", additionalProperties: true },
      },
    ],
    tool_choice: { type: "tool", name: "respond" },
  });
  const toolUse = res.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("AI応答から構造化データを取得できませんでした");
  return toolUse.input as T;
}
