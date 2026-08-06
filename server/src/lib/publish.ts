import type { Account, Draft } from "@prisma/client";
import * as instagram from "../platforms/instagram.js";
import * as x from "../platforms/x.js";

export async function publishDraft(draft: Draft, account: Account): Promise<string> {
  if (!account.oauthAccessToken) throw new Error("アカウントが連携されていません");

  if (account.platform === "x") {
    const mediaIds: string[] = [];
    for (const url of draft.mediaUrls) {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      mediaIds.push(await x.uploadMedia(account.oauthAccessToken, buf, "image/jpeg"));
    }
    const result = await x.postTweet({
      accessToken: account.oauthAccessToken,
      text: draft.text,
      mediaIds,
      quoteTweetId: draft.quoteTargetId ?? undefined,
    });
    return result.id;
  }

  // instagram
  if (!account.igBusinessAccountId) throw new Error("Instagramビジネスアカウント未設定");
  const imageUrl = draft.mediaUrls[0];
  if (!imageUrl) throw new Error("Instagram投稿には画像が1枚以上必要です");
  const creationId = await instagram.createMediaContainer({
    igUserId: account.igBusinessAccountId,
    accessToken: account.oauthAccessToken,
    imageUrl,
    caption: draft.text,
  });
  return instagram.publishMedia({
    igUserId: account.igBusinessAccountId,
    accessToken: account.oauthAccessToken,
    creationId,
  });
}
