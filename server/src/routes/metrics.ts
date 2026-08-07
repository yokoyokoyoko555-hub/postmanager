import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  const { accountId } = req.query as { accountId?: string };
  if (!accountId) return res.status(400).json({ error: "accountId is required" });

  const accountMetric = await prisma.accountMetric.findFirst({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
  });

  const postMetrics = await prisma.postMetric.findMany({
    where: { accountId },
    orderBy: { capturedAt: "desc" },
    take: 10,
  });

  const postLogs = postMetrics.length
    ? await prisma.postLog.findMany({
        where: { platformPostId: { in: postMetrics.map((m) => m.platformPostId) }, status: "success" },
        include: { draft: true },
      })
    : [];
  const textByPostId = new Map(
    postLogs.filter((l) => l.platformPostId).map((l) => [l.platformPostId as string, l.draft.text]),
  );

  res.json({
    accountMetric,
    postMetrics: postMetrics.map((m) => ({ ...m, text: textByPostId.get(m.platformPostId) ?? null })),
  });
});

export default router;
