import crypto from "node:crypto";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const API_BASE = "https://api.twitter.com/2";
const MEDIA_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json";

const SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"].join(" ");

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function getAuthorizeUrl(params: { state: string; codeChallenge: string }) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requireXClientId());
  url.searchParams.set("redirect_uri", requireCallbackUrl());
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function requireXClientId() {
  const id = process.env.X_CLIENT_ID;
  if (!id) throw new Error("X_CLIENT_ID is not configured");
  return id;
}

function requireCallbackUrl() {
  const url = process.env.X_OAUTH_CALLBACK_URL;
  if (!url) throw new Error("X_OAUTH_CALLBACK_URL is not configured");
  return url;
}

function basicAuthHeader() {
  const id = requireXClientId();
  const secret = process.env.X_CLIENT_SECRET;
  if (!secret) throw new Error("X_CLIENT_SECRET is not configured");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export async function exchangeCodeForToken(code: string, codeVerifier: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: requireCallbackUrl(),
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error(`X token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`X token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function getMe(accessToken: string) {
  const res = await fetch(`${API_BASE}/users/me?user.fields=public_metrics`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`X getMe failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    data: { id: string; username: string; name: string; public_metrics?: Record<string, number> };
  };
}

// v1.1メディアアップロード → v2投稿のmedia_idsに紐付ける
export async function uploadMedia(accessToken: string, imageBuffer: Buffer, mimeType: string) {
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(imageBuffer)], { type: mimeType }));
  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // User-Agent不在だとCloudflare/X側のWAFに本文なし403で弾かれることがあるため明示的に付与
      "User-Agent": "PostBinderApp/1.0",
    },
    body: form,
  });
  if (!res.ok) throw new Error(`X media upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { media_id_string: string };
  return data.media_id_string;
}

export function guessMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase().split(/[?#]/)[0];
  switch (ext) {
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "jpg":
    case "jpeg":
    default: return "image/jpeg";
  }
}

export async function postTweet(params: {
  accessToken: string;
  text: string;
  mediaIds?: string[];
  quoteTweetId?: string;
}) {
  const body: Record<string, unknown> = { text: params.text };
  if (params.mediaIds?.length) body.media = { media_ids: params.mediaIds };
  if (params.quoteTweetId) body.quote_tweet_id = params.quoteTweetId;

  const res = await fetch(`${API_BASE}/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`X post failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data: { id: string; text: string } };
  return data.data;
}

export async function repost(params: { accessToken: string; userId: string; tweetId: string }) {
  const res = await fetch(`${API_BASE}/users/${params.userId}/retweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tweet_id: params.tweetId }),
  });
  if (!res.ok) throw new Error(`X repost failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// 自分の投稿と指標(いいね/リポスト/リプライ/インプレッション)をまとめて取得
export async function getOwnTweetsWithMetrics(params: { accessToken: string; userId: string; startTime?: string; endTime?: string }) {
  const url = new URL(`${API_BASE}/users/${params.userId}/tweets`);
  url.searchParams.set("tweet.fields", "public_metrics,created_at");
  url.searchParams.set("max_results", "100");
  if (params.startTime) url.searchParams.set("start_time", params.startTime);
  if (params.endTime) url.searchParams.set("end_time", params.endTime);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!res.ok) throw new Error(`X tweets fetch failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    data?: Array<{ id: string; text: string; created_at: string; public_metrics: Record<string, number> }>;
  };
  return data.data ?? [];
}
