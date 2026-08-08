import type { Account } from "@prisma/client";
import * as instagram from "../platforms/instagram.js";
import * as x from "../platforms/x.js";
import { prisma } from "./prisma.js";
import { ensureFreshXToken } from "./xAuth.js";

// 直近48時間分の投稿指標・アカウント指標を収集してDBへ保存する
// (カレンダー日固定にすると、生成した当日の投稿がレポートに反映されないため
//  相対的なローリングウィンドウにしている)
export async function collectMetricsForAccount(account: Account) {
  if (!account.oauthAccessToken) return;

  account = await ensureFreshXToken(account);
  const accessToken = account.oauthAccessToken;
  if (!accessToken) return;

  const end = new Date();
  const start = new Date(end.getTime() - 48 * 60 * 60 * 1000);

  if (account.platform === "x") {
    if (!account.platformUserId) return;
    const tweets = await x.getOwnTweetsWithMetrics({
      accessToken,
      userId: account.platformUserId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    for (const tweet of tweets) {
      // リポストはXの仕様上、新規ツイートIDに対して元投稿の下書き情報が紐付かないため、
      // 元投稿のIDをsourcePostIdとして保持し、本文表示時にそちらで引けるようにする
      const retweetedRef = tweet.referenced_tweets?.find((r) => r.type === "retweeted");
      await prisma.postMetric.create({
        data: {
          accountId: account.id,
          platform: "x",
          platformPostId: tweet.id,
          sourcePostId: retweetedRef?.id,
          likes: tweet.public_metrics.like_count ?? 0,
          reposts: tweet.public_metrics.retweet_count ?? 0,
          replies: tweet.public_metrics.reply_count ?? 0,
          impressions: tweet.public_metrics.impression_count ?? 0,
        },
      });
    }
    const me = await x.getMe(accessToken);
    await prisma.accountMetric.create({
      data: {
        accountId: account.id,
        platform: "x",
        followersCount: me.data.public_metrics?.followers_count ?? 0,
      },
    });
  } else {
    if (!account.igBusinessAccountId) return;
    const followers = await instagram.getFollowersCount({
      igUserId: account.igBusinessAccountId,
      accessToken,
    });
    const insights = await instagram.getAccountInsights({
      igUserId: account.igBusinessAccountId,
      accessToken,
    });
    const metricValue = (name: string) =>
      insights.data.find((d) => d.name === name)?.values?.[0]?.value ?? 0;

    await prisma.accountMetric.create({
      data: {
        accountId: account.id,
        platform: "instagram",
        followersCount: followers,
        profileViews: metricValue("profile_views"),
        reach: metricValue("reach"),
      },
    });
  }
}
