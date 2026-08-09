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

  const recentRows = await prisma.postMetric.findMany({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
    take: 300,
  });
  const postMetrics = latestPostMetricsByPost(recentRows).slice(0, 10);

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
