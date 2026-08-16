import type { Account, Draft } from "@prisma/client";
import { compressImageIfNeeded } from "./imageCompress.js";
import * as instagram from "../platforms/instagram.js";
import * as x from "../platforms/x.js";
import { prisma } from "./prisma.js";
import { substitutePlaceholders } from "./placeholders.js";
import { ensureFreshXToken } from "./xAuth.js";

// 戻り値のtextは、{日付}などのプレースホルダーを実際に置き換えた後の、実際に送信した本文
export async function publishDraft(draft: Draft, account: Account): Promise<{ platformPostId: string; text: string }> {
  if (!account.oauthAccessToken) throw new Error("アカウントが連携されていません");

  account = await ensureFreshXToken(account);
  const accessToken = account.oauthAccessToken;
  if (!accessToken) throw new Error("アカウントが連携されていません");

  // {日付}などのプレースホルダーは、実際に投稿する瞬間の日付で置き換える
  const text = substitutePlaceholders(draft.text);

  if (account.platform === "x") {
    // 無言リポスト: 新規投稿は作らず、過去の投稿をそのまま再共有する(本文は送信されない)
    if (draft.postMode === "repost") {
      if (!draft.quoteTargetId) throw new Error("リポスト対象の投稿が指定されていません");
      if (!account.platformUserId) throw new Error("Xアカウントのユーザー情報が取得できていません(再連携が必要な場合があります)");
      await x.repost({ accessToken, userId: account.platformUserId, tweetId: draft.quoteTargetId });
      return { platformPostId: draft.quoteTargetId, text: draft.text };
    }

    const mediaIds: string[] = [];
    for (const url of draft.mediaUrls) {
      const mediaRes = await fetch(url);
      if (!mediaRes.ok) throw new Error(`画像/動画の取得に失敗しました(${mediaRes.status}): ${url}`);
      const rawBuf = Buffer.from(await mediaRes.arrayBuffer());
      console.log("fetched media for upload", { url, bytes: rawBuf.length, contentType: mediaRes.headers.get("content-type") });

      // Xの公式アプリと同様、上限を超える画像は投稿前に自動で圧縮する(JPEG/PNG/WEBPのみ対象。GIF/動画は対象外)
      const { buffer: buf, mimeType } = await compressImageIfNeeded(rawBuf, x.guessMimeType(url), x.MAX_BYTES.tweet_image);
      mediaIds.push(await x.uploadMedia(accessToken, buf, mimeType));
    }
    const result = await x.postTweet({
      accessToken,
      text,
      mediaIds,
      quoteTweetId: draft.postMode === "quote" ? (draft.quoteTargetId ?? undefined) : undefined,
    });
    return { platformPostId: result.id, text };
  }

  // instagram
  if (!account.igBusinessAccountId) throw new Error("Instagramビジネスアカウント未設定");
  const imageUrl = draft.mediaUrls[0];
  if (!imageUrl) throw new Error("Instagram投稿には画像が1枚以上必要です");
  const creationId = await instagram.createMediaContainer({
    igUserId: account.igBusinessAccountId,
    accessToken,
    imageUrl,
    caption: text,
  });
  const platformPostId = await instagram.publishMedia({
    igUserId: account.igBusinessAccountId,
    accessToken,
    creationId,
  });
  return { platformPostId, text };
}

// 「今すぐ投稿」の連打や、ワーカーの自動実行とのタイミング重複による二重投稿を防ぐため、
// postInProgressフラグをDB上でアトミックに立てられた場合のみ処理を進める。
// (updateManyのwhere条件がマッチしなければ他プロセス/リクエストが既に処理中と判断できる)
export async function claimDraftForPosting(draftId: string) {
  // デプロイ等でプロセスが処理途中に落ちた場合に永久ロックされないよう、
  // 一定時間(5分、動画処理待ちの最大時間より十分長い)経過したロックは再取得可能にする
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  const claimed = await prisma.draft.updateMany({
    where: {
      id: draftId,
      status: { notIn: ["posted"] },
      OR: [{ postInProgress: false }, { updatedAt: { lt: staleThreshold } }],
    },
    data: { postInProgress: true },
  });
  if (claimed.count === 0) return null;
  return prisma.draft.findUniqueOrThrow({ where: { id: draftId }, include: { account: true } });
}

// 「今すぐ投稿」用: 予約を待たずに1回だけ投稿を試みる(リトライはしない)
export async function postDraftNow(draftId: string) {
  const draft = await claimDraftForPosting(draftId);
  if (!draft) {
    const existing = await prisma.draft.findUniqueOrThrow({ where: { id: draftId } });
    return { ok: false as const, draft: existing, error: "この下書きは処理中か、既に投稿済みのため実行できません(二重投稿防止)" };
  }

  try {
    const { platformPostId, text } = await publishDraft(draft, draft.account);
    const [updated] = await prisma.$transaction([
      prisma.draft.update({
        where: { id: draft.id },
        data: { status: "posted", postedAt: new Date(), lastError: null, postInProgress: false, text },
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
        data: { status: "failed", lastError: message, postInProgress: false },
      }),
      prisma.postLog.create({
        data: { draftId: draft.id, status: "failed", errorMessage: message },
      }),
    ]);
    return { ok: false as const, draft: updated, error: message };
  }
}
