import { Router } from "express";
import { z } from "zod";
import { generateJson } from "../lib/aiProvider.js";
import { ah } from "../lib/asyncHandler.js";
import { generateAndSaveDailyReport, generateDailyReportsForAllAccounts } from "../lib/dailyReport.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

const TONE_LABELS: Record<string, string> = {
  hype: "煽り系",
  info: "情報系",
  sale: "セール告知",
  unbox: "開封速報",
};

const generateSchema = z.object({
  accountId: z.string().min(1),
  input: z.string().min(1),
  tone: z.enum(["hype", "info", "sale", "unbox"]),
  provider: z.enum(["claude", "openai"]).default("claude"),
});

router.post("/generate-draft", ah(async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { accountId, input, tone, provider } = parsed.data;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return res.status(404).json({ error: "account not found" });

  const charLimit = account.platform === "x" ? "140字前後、長くても280字以内" : "長文可(Instagramキャプション)";

  const prompt = `あなたはトレーディングカードショップのSNS運用担当者です。以下の情報をもとに、${account.platform === "x" ? "X(旧Twitter)" : "Instagram"}向けの投稿文案を3パターン作成してください。

【店舗アカウント】
${account.displayName} (${account.handle})

【投稿の元情報】
${input}

【希望トーン】
${TONE_LABELS[tone]}

【条件】
・${charLimit}
・トレーディングカードショップの来店・通販利用の後押しを意識する一文を必ず含める
・絵文字は適度に(使いすぎない)
・ハッシュタグは0〜2個
・3パターンはそれぞれ違う切り口にする

出力は次のJSON形式のみを返してください。前置きや説明、コードブロック記法は一切不要です:
{"variants":[{"label":"パターンの特徴を5文字程度で","text":"投稿文そのもの"}]}`;

  try {
    const parsed_ = await generateJson<{ variants: Array<{ label: string; text: string }> }>(prompt, provider);
    res.json({ variants: parsed_.variants });
  } catch (e) {
    res.status(502).json({ error: "AI生成に失敗しました", detail: (e as Error).message });
  }
}));

const dailyReportSchema = z.object({
  accountId: z.string().min(1).optional(),
  provider: z.enum(["claude", "openai"]).default("claude"),
});

// accountIdを指定すればそのアカウントのみ、省略すれば全アカウント分をまとめて生成する
router.post("/daily-report", ah(async (req, res) => {
  const parsed = dailyReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { accountId, provider } = parsed.data;

  try {
    if (accountId) {
      const report = await generateAndSaveDailyReport(accountId, provider);
      return res.json({ reports: [report] });
    }
    const results = await generateDailyReportsForAllAccounts(provider);
    const reports = results.filter((r) => r.ok).map((r) => r.report);
    const errors = results.filter((r) => !r.ok).map((r) => ({ accountId: r.accountId, error: r.error }));
    res.json({ reports, errors });
  } catch (e) {
    console.error("[ai] daily-report failed", e);
    res.status(502).json({ error: "レポート生成に失敗しました", detail: (e as Error).message });
  }
}));

router.get("/daily-report/history", ah(async (req, res) => {
  const { accountId } = req.query as { accountId?: string };
  const reports = await prisma.dailyReport.findMany({
    where: accountId ? { accountId } : undefined,
    orderBy: { reportDate: "desc" },
    take: 90,
    include: { account: true },
  });
  res.json(reports);
}));

export default router;
