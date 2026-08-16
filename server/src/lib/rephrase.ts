import type { AiProvider } from "./aiProvider.js";
import { generateJson } from "./aiProvider.js";

// ルーティーン投稿が毎回まったく同じ文面になり、Xの重複投稿ブロック(403)に
// 引っかかるのを避けるため、意味・訴求内容は保ったまま語尾や言い回しをAIで変える。
// 失敗した場合は呼び出し側で元の文面にフォールバックすること。
export async function rephraseText(text: string, provider: AiProvider = "claude"): Promise<string> {
  const prompt = `以下はSNS投稿の文章です。意味・訴求内容・含まれるURL/ハッシュタグ/絵文字の情報はそのまま保ちつつ、語尾や言い回し・表現だけを自然に変えてリライトしてください。文字数は元の文章から大きく変えないでください。

【元の文章】
${text}

出力は次のJSON形式のみを返してください。前置き・コードブロック記法は不要です:
{"text":"リライト後の文章"}`;

  const parsed = await generateJson<{ text: string }>(prompt, provider, 600);
  return parsed.text?.trim() || text;
}
