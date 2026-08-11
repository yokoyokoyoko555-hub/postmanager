import type { Account } from "@prisma/client";
import * as x from "../platforms/x.js";
import { prisma } from "./prisma.js";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Xのアクセストークンが失効間近/失効済みならリフレッシュトークンで更新してからaccountを返す
export async function ensureFreshXToken(account: Account): Promise<Account> {
  if (account.platform !== "x") return account;
  if (!account.oauthRefreshToken) return account;

  const expiresAt = account.tokenExpiresAt;
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
  if (!needsRefresh) return account;

  try {
    const refreshed = await x.refreshAccessToken(account.oauthRefreshToken);
    return await prisma.account.update({
      where: { id: account.id },
      data: {
        oauthAccessToken: refreshed.access_token,
        oauthRefreshToken: refreshed.refresh_token ?? account.oauthRefreshToken,
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
  } catch (e) {
    // リフレッシュトークン自体が失効/取り消し済みと判明した場合のみ、保存済みトークンを
    // クリアして「未連携」状態にする(一覧の連携済み表示が実態と一致するようにする)。
    // 5xxなど一時的な失敗まで連携解除してしまわないよう、明確な再連携メッセージの場合に限る。
    if ((e as Error).message === x.X_RECONNECT_MESSAGE) {
      await prisma.account.update({
        where: { id: account.id },
        data: { oauthAccessToken: null, oauthRefreshToken: null, tokenExpiresAt: null },
      });
    }
    throw e;
  }
}
