import type { Account, Draft } from "@prisma/client";
import * as instagram from "../platforms/instagram.js";
import * as x from "../platforms/x.js";
import { prisma } from "./prisma.js";
import { ensureFreshXToken } from "./xAuth.js";

export async function publishDraft(draft: Draft, account: Account): Promise<string> {
  if (!account.oauthAccessToken) throw new Error("アカウントが連携されていません");

  account = await ensureFreshXToken(account);
  const accessToken = account.oauthAccessToken;
  if (!accessToken) throw new Error("アカウントが連携されていません");

  if (account.platform === "x") {
    // 無言リポスト: 新規投稿は作らず、過去の投稿をそのまま再共有する
    if (draft.postMode === "repost") {
      if (!draft.quoteTargetId) throw new Error("リポスト対象の投稿が指定されていません");
      if (!account.platformUserId) throw new Error("Xアカウントのユーザー情報が取得できていません(再連携が必要な場合があります)");
      await x.repost({ accessToken, userId: account.platformUserId, tweetId: draft.quoteTargetId });
      return draft.quoteTargetId;
    }

    const mediaIds: string[] = [];
    for (const url of draft.mediaUrls) {
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      mediaIds.push(await x.uploadMedia(accessToken, buf, "image/jpeg"));
    }
    const result = await x.postTweet({
      accessToken,
      text: draft.text,
      mediaIds,
      quoteTweetId: draft.postMode === "quote" ? (draft.quoteTargetId ?? undefined) : undefined,
    });
    return result.id;
  }

  // instagram
  if (!account.igBusinessAccountId) throw new Error("Instagramビジネスアカウント未設定");
  const imageUrl = draft.mediaUrls[0];
  if (!imageUrl) throw new Error("Instagram投稿には画像が1枚以上必要です");
  const creationId = await instagram.createMediaContainer({
    igUserId: account.igBusinessAccountId,
    accessToken,
    imageUrl,
    caption: draft.text,
  });
  return instagram.publishMedia({
    igUserId: account.igBusinessAccountId,
    accessToken,
    creationId,
  });
}

// 「今すぐ投稿」用: 予約を待たずに1回だけ投稿を試みる(リトライはしない)
export async function postDraftNow(draftId: string) {
  const draft = await prisma.draft.findUniqueOrThrow({ where: { id: draftId }, include: { account: true } });

  try {
    const platformPostId = await publishDraft(draft, draft.account);
    const [updated] = await prisma.$transaction([
      prisma.draft.update({
        where: { id: draft.id },
        data: { status: "posted", postedAt: new Date(), lastError: null },
      }),
      prisma.postLog.create({
        data: { draftId: draft.id, platformPostId, status: "success" },
      }),
    ]);
    return { ok: true as const, draft: updated };
  } catch (e) {
    const message = (e as Error).message;
    const [updated] = await prisma.$transaction([
      prisma.draft.update({
        where: { id: draft.id },
        data: { status: "failed", lastError: message },
      }),
      prisma.postLog.create({
        data: { draftId: draft.id, status: "failed", errorMessage: message },
      }),
    ]);
    return { ok: false as const, draft: updated, error: message };
  }
}
