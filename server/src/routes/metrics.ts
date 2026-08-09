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

  // 「直近48時間」は投稿自体の日時(postedAt)で判定する。収集した時刻(capturedAt)で
  // 絞り込むと、何度も再収集するたびに古い投稿まで「最近収集したから」という理由で
  // 混ざり続けてしまう(実際に発生した不具合)。
  const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recentRows = await prisma.postMetric.findMany({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
    take: 500,
  });
  const postMetrics = latestPostMetricsByPost(recentRows).filter(
    (m) => m.postedAt && m.postedAt >= windowStart,
  );

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
