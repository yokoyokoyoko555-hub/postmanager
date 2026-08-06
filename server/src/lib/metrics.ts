import type { Account } from "@prisma/client";
import * as instagram from "../platforms/instagram.js";
import * as x from "../platforms/x.js";
import { prisma } from "./prisma.js";

// 前日分の投稿指標・アカウント指標を収集してDBへ保存する
export async function collectMetricsForAccount(account: Account) {
  if (!account.oauthAccessToken) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);

  if (account.platform === "x") {
    if (!account.platformUserId) return;
    const tweets = await x.getOwnTweetsWithMetrics({
      accessToken: account.oauthAccessToken,
      userId: account.platformUserId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    for (const tweet of tweets) {
      await prisma.postMetric.create({
        data: {
          accountId: account.id,
          platform: "x",
          platformPostId: tweet.id,
          likes: tweet.public_metrics.like_count ?? 0,
          reposts: tweet.public_metrics.retweet_count ?? 0,
          replies: tweet.public_metrics.reply_count ?? 0,
          impressions: tweet.public_metrics.impression_count ?? 0,
        },
      });
    }
    const me = await x.getMe(account.oauthAccessToken);
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
      accessToken: account.oauthAccessToken,
    });
    const insights = await instagram.getAccountInsights({
      igUserId: account.igBusinessAccountId,
      accessToken: account.oauthAccessToken,
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
