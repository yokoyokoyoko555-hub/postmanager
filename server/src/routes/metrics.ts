import { Router } from "express";
import { latestPostMetricsByPost } from "../lib/metrics.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  const { accountId } = req.query as { accountId?: string };
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accountMetric = await prisma.accountMetric.findFirst({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
  });

  // 「直近48時間」の実件数が正しく出るよう、表示件数を人為的に10件へ切り詰めない
  // (収集は48時間ローリングウィンドウなので、投稿ごとに重複排除した上で全件返す)
  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentRows = await prisma.postMetric.findMany({
    where: { accountId, capturedAt: { gte: windowStart } },
    orderBy: { capturedAt: "desc" },
    take: 500,
  });
  const postMetrics = latestPostMetricsByPost(recentRows);

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

  res.json({
    accountMetric,
    postMetrics: postMetrics.map((m) => ({ ...m, text: textByPostId.get(m.sourcePostId ?? m.platformPostId) ?? null })),
  });
});

export default router;
