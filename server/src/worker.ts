import "dotenv/config";
import cron from "node-cron";
import { generateDailyReportsForAllAccounts } from "./lib/dailyReport.js";
import { prisma } from "./lib/prisma.js";
import { claimDraftForPosting, publishDraft } from "./lib/publish.js";

const MAX_RETRIES = 3;

async function runScheduledPosts() {
  const due = await prisma.draft.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
  });

  for (const due_ of due) {
    // 「今すぐ投稿」など他の実行と重ならないようアトミックに確保できた場合のみ処理する
    const draft = await claimDraftForPosting(due_.id);
    if (!draft) continue;

    try {
      const platformPostId = await publishDraft(draft, draft.account);
      await prisma.$transaction([
        prisma.draft.update({
          where: { id: draft.id },
          data: { status: "posted", postedAt: new Date(), lastError: null, postInProgress: false },
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
            data: { status: "failed", retryCount, lastError: message, postInProgress: false },
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
            postInProgress: false,
          },
        });
        console.warn(`[worker] draft ${draft.id} failed, retry ${retryCount}/${MAX_RETRIES}: ${message}`);
      }
    }
  }
}

async function runDailyJob() {
  const results = await generateDailyReportsForAllAccounts();
  for (const r of results) {
    if (r.ok) console.log(`[worker] daily report generated for account ${r.accountId}`);
    else console.error(`[worker] daily report failed for account ${r.accountId}: ${r.error}`);
  }
}

cron.schedule("* * * * *", () => {
  runScheduledPosts().catch((e) => console.error("[worker] runScheduledPosts crashed", e));
});

cron.schedule(
  "0 11 * * *",
  () => {
    runDailyJob().catch((e) => console.error("[worker] runDailyJob crashed", e));
  },
  { timezone: "Asia/Tokyo" },
);

console.log("[worker] started: scheduled posts every minute, daily report at 11:00 JST");
