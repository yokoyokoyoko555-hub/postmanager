import type { AiProvider } from "./aiProvider.js";
import { generateJson } from "./aiProvider.js";
import { collectMetricsForAccount } from "./metrics.js";
import { prisma } from "./prisma.js";

// レポートの日付ラベルは日本時間の「今日」の日付を使う
function jstTodayDateOnlyUtc(): Date {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
}

export async function generateAndSaveDailyReport(accountId: string, provider: AiProvider = "claude") {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });

  // 生成直前に最新の指標を取得しておく(取得できなくてもレポート自体は続行する)
  if (account.oauthAccessToken) {
    try {
      await collectMetricsForAccount(account);
    } catch (e) {
      console.error(`[dailyReport] metrics fetch failed for ${account.handle}: ${(e as Error).message}`);
    }
  }

  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const drafts = await prisma.draft.findMany({
    where: { accountId, status: { in: ["posted", "scheduled"] }, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const postMetrics = await prisma.postMetric.findMany({
    where: { accountId, capturedAt: { gte: windowStart } },
    orderBy: { capturedAt: "desc" },
    take: 20,
  });
  const accountMetric = await prisma.accountMetric.findFirst({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
  });

  const joinIds = postMetrics.map((m) => m.sourcePostId ?? m.platformPostId);
  const postLogs = joinIds.length
    ? await prisma.postLog.findMany({
        where: { platformPostId: { in: joinIds }, status: "success" },
        include: { draft: true },
      })
    : [];
  const textByPostId = new Map(
    postLogs.filter((l) => l.platformPostId).map((l) => [l.platformPostId as string, l.draft.text]),
  );

  const draftLines = drafts.length
    ? drafts.map((d) => `- ${d.text.slice(0, 60)}`).join("\n")
    : "（直近の投稿記録なし）";

  const metricsLines = postMetrics.length
    ? postMetrics
        .map((m) => {
          const text = (textByPostId.get(m.sourcePostId ?? m.platformPostId) ?? "本文不明").slice(0, 40);
          const saves = m.saves ? ` 保存${m.saves}` : "";
          return `- 「${text}」 いいね${m.likes} リポスト${m.reposts} 返信${m.replies} インプレッション${m.impressions}${saves}`;
        })
        .join("\n")
    : "（実測の指標データはまだありません。連携・投稿から日数が浅い可能性があります）";

  const accountLine = accountMetric
    ? [
        `フォロワー数: ${accountMetric.followersCount}`,
        accountMetric.reach ? `リーチ: ${accountMetric.reach}` : null,
        accountMetric.profileViews ? `プロフィール閲覧数: ${accountMetric.profileViews}` : null,
      ].filter(Boolean).join(" / ")
    : "（アカウント指標はまだありません）";

  const prompt = `あなたはトレーディングカードショップのSNS運用アドバイザーです。以下は「${account.displayName}(${account.handle})」の直近48時間の投稿と実測の指標データです。これをもとに、このアカウント単体のデイリーレポートを作成してください。実測データがある投稿はその数値を根拠にし、無い投稿は内容の質から一般的に読み取れる傾向として記述してください。

【アカウント指標】
${accountLine}

【投稿別の実測指標】
${metricsLines}

【直近の投稿内容】
${draftLines}

出力は次のJSON形式のみを返してください。前置き・コードブロック記法は不要です:
{"review":"直近の振り返り(3〜4文)","improvements":"改善点(3〜4文)","next_actions":"ネクストアクション(3〜4文、箇条書き調でも可)"}`;

  const parsed = await generateJson<{ review: string; improvements: string; next_actions: string }>(prompt, provider, 2000);

  const reportDate = jstTodayDateOnlyUtc();

  return prisma.dailyReport.upsert({
    where: { reportDate_accountId: { reportDate, accountId } },
    create: {
      reportDate,
      accountId,
      reviewText: parsed.review,
      improvementsText: parsed.improvements,
      nextActionsText: parsed.next_actions,
    },
    update: {
      reviewText: parsed.review,
      improvementsText: parsed.improvements,
      nextActionsText: parsed.next_actions,
    },
    include: { account: true },
  });
}

export async function generateDailyReportsForAllAccounts(provider: AiProvider = "claude") {
  const accounts = await prisma.account.findMany();
  const results: Array<
    { ok: true; accountId: string; report: Awaited<ReturnType<typeof generateAndSaveDailyReport>> } |
    { ok: false; accountId: string; error: string }
  > = [];
  for (const account of accounts) {
    try {
      const report = await generateAndSaveDailyReport(account.id, provider);
      results.push({ ok: true, accountId: account.id, report });
    } catch (e) {
      results.push({ ok: false, accountId: account.id, error: (e as Error).message });
    }
  }
  return results;
}
