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

  const refreshed = await x.refreshAccessToken(account.oauthRefreshToken);
  return prisma.account.update({
    where: { id: account.id },
    data: {
      oauthAccessToken: refreshed.access_token,
      oauthRefreshToken: refreshed.refresh_token ?? account.oauthRefreshToken,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });
}
