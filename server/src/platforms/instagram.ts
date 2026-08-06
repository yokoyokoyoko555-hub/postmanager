const GRAPH_VERSION = "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG_URL = "https://www.facebook.com/v19.0/dialog/oauth";

const SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

function requireAppId() {
  const id = process.env.IG_APP_ID;
  if (!id) throw new Error("IG_APP_ID is not configured");
  return id;
}

function requireAppSecret() {
  const secret = process.env.IG_APP_SECRET;
  if (!secret) throw new Error("IG_APP_SECRET is not configured");
  return secret;
}

function requireCallbackUrl() {
  const url = process.env.IG_OAUTH_CALLBACK_URL;
  if (!url) throw new Error("IG_OAUTH_CALLBACK_URL is not configured");
  return url;
}

export function getAuthorizeUrl(state: string) {
  const url = new URL(OAUTH_DIALOG_URL);
  url.searchParams.set("client_id", requireAppId());
  url.searchParams.set("redirect_uri", requireCallbackUrl());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  return url.toString();
}

export async function exchangeCodeForToken(code: string) {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", requireAppId());
  url.searchParams.set("client_secret", requireAppSecret());
  url.searchParams.set("redirect_uri", requireCallbackUrl());
  url.searchParams.set("code", code);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; token_type: string; expires_in?: number };
}

// 短期トークンを長期(約60日)トークンに交換
export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", requireAppId());
  url.searchParams.set("client_secret", requireAppSecret());
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG long-lived token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; token_type: string; expires_in: number };
}

// ログインユーザーが管理するFacebookページ一覧から、紐付くInstagramビジネスアカウントIDを解決する
export async function findInstagramBusinessAccount(userAccessToken: string) {
  const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`);
  pagesUrl.searchParams.set("access_token", userAccessToken);
  const pagesRes = await fetch(pagesUrl);
  if (!pagesRes.ok) throw new Error(`IG pages fetch failed: ${pagesRes.status} ${await pagesRes.text()}`);
  const pages = (await pagesRes.json()) as { data: Array<{ id: string; access_token: string; name: string }> };

  for (const page of pages.data ?? []) {
    const igUrl = new URL(`${GRAPH_BASE}/${page.id}`);
    igUrl.searchParams.set("fields", "instagram_business_account");
    igUrl.searchParams.set("access_token", page.access_token);
    const igRes = await fetch(igUrl);
    if (!igRes.ok) continue;
    const igData = (await igRes.json()) as { instagram_business_account?: { id: string } };
    if (igData.instagram_business_account) {
      return { igUserId: igData.instagram_business_account.id, pageAccessToken: page.access_token };
    }
  }
  return null;
}

// 2段階投稿: 1) メディアコンテナ作成 2) 公開実行
export async function createMediaContainer(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string;
  caption: string;
}) {
  const url = new URL(`${GRAPH_BASE}/${params.igUserId}/media`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: params.imageUrl,
      caption: params.caption,
      access_token: params.accessToken,
    }),
  });
  if (!res.ok) throw new Error(`IG media container failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function publishMedia(params: { igUserId: string; accessToken: string; creationId: string }) {
  const url = new URL(`${GRAPH_BASE}/${params.igUserId}/media_publish`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: params.creationId,
      access_token: params.accessToken,
    }),
  });
  if (!res.ok) throw new Error(`IG media publish failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function getMediaInsights(params: { mediaId: string; accessToken: string }) {
  const url = new URL(`${GRAPH_BASE}/${params.mediaId}/insights`);
  url.searchParams.set("metric", "likes,comments,saved,reach");
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG media insights failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { data: Array<{ name: string; values: Array<{ value: number }> }> };
}

export async function getAccountInsights(params: { igUserId: string; accessToken: string }) {
  const url = new URL(`${GRAPH_BASE}/${params.igUserId}/insights`);
  url.searchParams.set("metric", "profile_views,reach");
  url.searchParams.set("period", "day");
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG account insights failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { data: Array<{ name: string; values: Array<{ value: number }> }> };
}

export async function getFollowersCount(params: { igUserId: string; accessToken: string }) {
  const url = new URL(`${GRAPH_BASE}/${params.igUserId}`);
  url.searchParams.set("fields", "followers_count");
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IG followers fetch failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { followers_count: number };
  return data.followers_count;
}
