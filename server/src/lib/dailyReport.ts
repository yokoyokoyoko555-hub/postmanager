import type { AiProvider } from "./aiProvider.js";
import { generateJson } from "./aiProvider.js";
import { prisma } from "./prisma.js";

export async function generateAndSaveDailyReport(provider: AiProvider = "claude") {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);

  const drafts = await prisma.draft.findMany({
    where: { status: { in: ["posted", "scheduled"] }, createdAt: { gte: start, lte: end } },
    include: { account: true },
    take: 20,
  });

  const contextLines = drafts.length
    ? drafts.map((d) => `- [${d.account.handle}] ${d.text.slice(0, 60)}`).join("\n")
    : "（前日の投稿記録なし）";

  const prompt = `あなたはトレーディングカードショップのSNS運用アドバイザーです。以下は前日投稿された(または予約されている)投稿の一部です。これをもとに、実運用を想定したデイリーレポートを作成してください。実際のいいね数などの数値データが無い場合は、投稿内容の質から一般的に読み取れる傾向として記述してください。アカウント同士の比較・ランキングは行わず、全体としてどうだったかをまとめてください。

【前日の投稿】
${contextLines}

出力は次のJSON形式のみを返してください。前置き・コードブロック記法は不要です:
{"review":"前日の振り返り(3〜4文)","improvements":"改善点(3〜4文)","next_actions":"ネクストアクション(3〜4文、箇条書き調でも可)"}`;

  const parsed = await generateJson<{ review: string; improvements: string; next_actions: string }>(prompt, provider, 800);

  const reportDate = new Date();
  reportDate.setHours(0, 0, 0, 0);

  return prisma.dailyReport.upsert({
    where: { reportDate },
    create: {
      reportDate,
      reviewText: parsed.review,
      improvementsText: parsed.improvements,
      nextActionsText: parsed.next_actions,
    },
    update: {
      reviewText: parsed.review,
      improvementsText: parsed.improvements,
      nextActionsText: parsed.next_actions,
    },
  });
}
