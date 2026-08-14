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

// 閲覧端末のタイムゾーンに関わらず、日本時間での現在日時を取得する
function jstNow() {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    dateOnly: new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())),
    dayOfWeek: shifted.getUTCDay(), // 0=日,1=月,...6=土
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

// ルーティーン設定を毎分チェックし、条件(曜日・時刻)に合致していて当日まだ発火して
// いなければ、実際のDraft(予約投稿・scheduledAt=今)を生成する。投稿処理そのものは
// 直後に走るrunScheduledPostsに任せる(二重投稿防止やリトライを再実装しないため)。
async function runRoutinePosts() {
  const { dateOnly, dayOfWeek, hour, minute } = jstNow();

  const routines = await prisma.routinePost.findMany({
    where: {
      active: true,
      OR: [{ lastTriggeredDate: null }, { lastTriggeredDate: { lt: dateOnly } }],
    },
    include: { account: true },
  });

  for (const routine of routines) {
    const matchesDay = routine.frequency === "daily" || routine.daysOfWeek.includes(dayOfWeek);
    if (!matchesDay) continue;
    const pastTriggerTime = hour > routine.hour || (hour === routine.hour && minute >= routine.minute);
    if (!pastTriggerTime) continue;

    // アトミックに「本日分は発火済み」にできた場合のみ実行する(同時実行での二重生成防止)
    const claimed = await prisma.routinePost.updateMany({
      where: { id: routine.id, OR: [{ lastTriggeredDate: null }, { lastTriggeredDate: { lt: dateOnly } }] },
      data: { lastTriggeredDate: dateOnly },
    });
    if (claimed.count === 0) continue;

    const draft = await prisma.draft.create({
      data: {
        accountId: routine.accountId,
        platform: routine.account.platform,
        text: routine.text,
        mediaUrls: routine.mediaUrls,
        source: "routine",
        postMode: "post",
        status: "scheduled",
        scheduledAt: new Date(),
      },
    });
    console.log(`[worker] routine ${routine.id} generated draft ${draft.id}`);
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
  runRoutinePosts()
    .catch((e) => console.error("[worker] runRoutinePosts crashed", e))
    .finally(() => {
      runScheduledPosts().catch((e) => console.error("[worker] runScheduledPosts crashed", e));
    });
});

cron.schedule(
  "0 11 * * *",
  () => {
    runDailyJob().catch((e) => console.error("[worker] runDailyJob crashed", e));
  },
  { timezone: "Asia/Tokyo" },
);

console.log("[worker] started: routine/scheduled posts every minute, daily report at 11:00 JST");
