import "dotenv/config";
import cron from "node-cron";
import { generateAndSaveDailyReport } from "./lib/dailyReport.js";
import { collectMetricsForAccount } from "./lib/metrics.js";
import { prisma } from "./lib/prisma.js";
import { publishDraft } from "./lib/publish.js";

const MAX_RETRIES = 3;

async function runScheduledPosts() {
  const due = await prisma.draft.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    include: { account: true },
  });

  for (const draft of due) {
    try {
      const platformPostId = await publishDraft(draft, draft.account);
      await prisma.$transaction([
        prisma.draft.update({
          where: { id: draft.id },
          data: { status: "posted", postedAt: new Date(), lastError: null },
        }),
        prisma.postLog.create({
          data: { draftId: draft.id, platformPostId, status: "success" },
        }),
      ]);
      console.log(`[worker] posted draft ${draft.id} -> ${platformPostId}`);
    } catch (e) {
      const message = (e as Error).message;
      const retryCount = draft.retryCount + 1;

      if (retryCount >= MAX_RETRIES) {
        await prisma.$transaction([
          prisma.draft.update({
            where: { id: draft.id },
            data: { status: "failed", retryCount, lastError: message },
          }),
          prisma.postLog.create({
            data: { draftId: draft.id, status: "failed", errorMessage: message },
          }),
        ]);
        console.error(`[worker] draft ${draft.id} failed permanently: ${message}`);
      } else {
        const backoffMinutes = 2 ** retryCount; // 2分, 4分, ...
        await prisma.draft.update({
          where: { id: draft.id },
          data: {
            retryCount,
            lastError: message,
            scheduledAt: new Date(Date.now() + backoffMinutes * 60_000),
          },
        });
        console.warn(`[worker] draft ${draft.id} failed, retry ${retryCount}/${MAX_RETRIES}: ${message}`);
      }
    }
  }
}

async function runDailyJob() {
  const accounts = await prisma.account.findMany({ where: { oauthAccessToken: { not: null } } });
  for (const account of accounts) {
    try {
      await collectMetricsForAccount(account);
    } catch (e) {
      console.error(`[worker] metrics collection failed for ${account.handle}: ${(e as Error).message}`);
    }
  }

  try {
    await generateAndSaveDailyReport();
    console.log("[worker] daily report generated");
  } catch (e) {
    console.error(`[worker] daily report generation failed: ${(e as Error).message}`);
  }
}

cron.schedule("* * * * *", () => {
  runScheduledPosts().catch((e) => console.error("[worker] runScheduledPosts crashed", e));
});

cron.schedule("0 11 * * *", () => {
  runDailyJob().catch((e) => console.error("[worker] runDailyJob crashed", e));
});

console.log("[worker] started: scheduled posts every minute, daily report at 11:00");
