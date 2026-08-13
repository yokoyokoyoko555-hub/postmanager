import crypto from "node:crypto";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const API_BASE = "https://api.twitter.com/2";
const MEDIA_UPLOAD_BASE = "https://api.x.com/2/media/upload";

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
  if (!res.ok) {
    const body = await res.text();
    console.error("X token refresh failed", { status: res.status, body });
    // リフレッシュトークン失効時、XはOAuth標準に沿って401ではなく400(invalid_grant)を返すことが多い
    if (res.status === 400 || res.status === 401) throw new Error(X_RECONNECT_MESSAGE);
    throw new Error(`X token refresh failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}

export async function getMe(accessToken: string) {
  const res = await fetch(`${API_BASE}/users/me?user.fields=public_metrics`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) await throwWithDiagnostics("X getMe failed", res);
  return (await res.json()) as {
    data: { id: string; username: string; name: string; public_metrics?: Record<string, number> };
  };
}

function browserLikeHeaders(accessToken: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    ...extra,
  };
}

// トークンが失効/取り消し済みの場合にXが返す401は、他のエラーと違い
// 「再連携すれば直る」ことがはっきりしているため、専用の分かりやすいメッセージにする
export const X_RECONNECT_MESSAGE = "Xとの連携が切れています。「アカウント」タブから再連携してください。";

export const X_SERVICE_UNAVAILABLE_MESSAGE =
  "X側で一時的に障害が発生している可能性があります(Service Unavailable)。しばらく経ってから再度お試しください。";

async function throwWithDiagnostics(label: string, res: Response): Promise<never> {
  const body = await res.text();
  console.error(label, { status: res.status, headers: Object.fromEntries(res.headers.entries()), body });
  if (res.status === 401) throw new Error(X_RECONNECT_MESSAGE);
  if (res.status === 503) throw new Error(X_SERVICE_UNAVAILABLE_MESSAGE);
  throw new Error(`${label}: ${res.status} ${body}`);
}

// X側の一時的な5xx(Service Unavailableなど)は数秒後のリトライで復帰することが多いため、
// 4xx(認証・入力エラーなど)は即座に諦め、5xxのみ短い間隔でリトライする
async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastRes: Response | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || res.status < 500) return res;
    lastRes = res;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  return lastRes!;
}

function mediaCategoryFor(mimeType: string): "tweet_image" | "tweet_gif" | "tweet_video" {
  if (mimeType === "image/gif") return "tweet_gif";
  if (mimeType.startsWith("video/")) return "tweet_video";
  return "tweet_image";
}

// Xの公式上限。これを超えると分かりやすいエラーではなく謎の503が返ってくることが
// 実際に確認されているため、リクエストを送る前にこちら側で弾く
export const MAX_BYTES: Record<"tweet_image" | "tweet_gif" | "tweet_video", number> = {
  tweet_image: 5 * 1024 * 1024,
  tweet_gif: 15 * 1024 * 1024,
  tweet_video: 512 * 1024 * 1024,
};
const MAX_BYTES_LABEL: Record<"tweet_image" | "tweet_gif" | "tweet_video", string> = {
  tweet_image: "5MB",
  tweet_gif: "15MB",
  tweet_video: "512MB",
};

const APPEND_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB。動画は1回のAPPENDに収まらないことがあるため分割する
const STATUS_POLL_TIMEOUT_MS = 90_000; // 動画処理の完了待ちの上限(これを超えたら諦めてエラーにする)

// X API v2のメディアアップロード(INIT→APPEND→FINALIZE→[動画/GIFのみ]STATUS待ち)。
// 旧v1.1 upload.x.comはCloudflareのボット対策で弾かれるため、投稿と同じapi.x.comドメインを使う。
export async function uploadMedia(accessToken: string, mediaBuffer: Buffer, mimeType: string) {
  const category = mediaCategoryFor(mimeType);
  console.log("X media upload starting", { mimeType, category, totalBytes: mediaBuffer.length });

  const maxBytes = MAX_BYTES[category];
  if (mediaBuffer.length > maxBytes) {
    const mb = (mediaBuffer.length / (1024 * 1024)).toFixed(1);
    throw new Error(
      `画像/動画のファイルサイズが大きすぎます(${mb}MB)。X側の上限(${category === "tweet_image" ? "画像" : category === "tweet_gif" ? "GIF" : "動画"}: ${MAX_BYTES_LABEL[category]})以下にしてください。`,
    );
  }

  const initRes = await fetchWithRetry(`${MEDIA_UPLOAD_BASE}/initialize`, {
    method: "POST",
    headers: browserLikeHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({ media_type: mimeType, media_category: category, total_bytes: mediaBuffer.length }),
  });
  if (!initRes.ok) await throwWithDiagnostics("X media upload (initialize) failed", initRes);
  const initData = (await initRes.json()) as { data: { id: string } };
  const mediaId = initData.data.id;

  // 動画など大きいファイルは4MBずつに分割してAPPENDする(1回のリクエストに収まらないため)
  for (let offset = 0, segmentIndex = 0; offset < mediaBuffer.length; offset += APPEND_CHUNK_SIZE, segmentIndex++) {
    const chunk = mediaBuffer.subarray(offset, offset + APPEND_CHUNK_SIZE);
    const form = new FormData();
    form.append("segment_index", String(segmentIndex));
    form.append("media", new Blob([new Uint8Array(chunk)], { type: mimeType }));
    const appendRes = await fetchWithRetry(`${MEDIA_UPLOAD_BASE}/${mediaId}/append`, {
      method: "POST",
      headers: browserLikeHeaders(accessToken),
      body: form,
    });
    if (!appendRes.ok) await throwWithDiagnostics("X media upload (append) failed", appendRes);
  }

  const finalizeRes = await fetchWithRetry(`${MEDIA_UPLOAD_BASE}/${mediaId}/finalize`, {
    method: "POST",
    headers: browserLikeHeaders(accessToken, { "Content-Type": "application/json" }),
  });
  if (!finalizeRes.ok) await throwWithDiagnostics("X media upload (finalize) failed", finalizeRes);
  const finalizeData = (await finalizeRes.json()) as {
    data: { id: string; processing_info?: { state: string; check_after_secs?: number } };
  };

  // 動画/GIFはX側で非同期に処理されるため、succeeded/failedになるまで待ってから返す
  if (finalizeData.data.processing_info) {
    await waitForMediaProcessing(accessToken, mediaId, finalizeData.data.processing_info);
  }

  return mediaId;
}

async function waitForMediaProcessing(
  accessToken: string,
  mediaId: string,
  initialInfo: { state: string; check_after_secs?: number; error?: { message: string } },
): Promise<void> {
  let info = initialInfo;
  const deadline = Date.now() + STATUS_POLL_TIMEOUT_MS;

  while (info.state === "pending" || info.state === "in_progress") {
    if (Date.now() > deadline) throw new Error("X media upload timed out (動画の処理待ちがタイムアウトしました)");
    await new Promise((resolve) => setTimeout(resolve, (info.check_after_secs ?? 3) * 1000));

    // STATUSのみ他(INIT/APPEND/FINALIZE)と違い、パス方式ではなくクエリパラメータ方式
    const statusRes = await fetchWithRetry(`${MEDIA_UPLOAD_BASE}?command=STATUS&media_id=${mediaId}`, {
      method: "GET",
      headers: browserLikeHeaders(accessToken),
    });
    if (!statusRes.ok) await throwWithDiagnostics("X media upload (status) failed", statusRes);
    const statusData = (await statusRes.json()) as {
      data: { processing_info?: { state: string; check_after_secs?: number; error?: { message: string } } };
    };
    if (!statusData.data.processing_info) return;
    info = statusData.data.processing_info;
    if (info.state === "failed") {
      throw new Error(`X media processing failed: ${info.error?.message ?? "unknown error"}`);
    }
  }
}

export function guessMimeType(url: string): string {
  const ext = url.split(".").pop()?.toLowerCase().split(/[?#]/)[0];
  switch (ext) {
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "mp4": return "video/mp4";
    case "mov": return "video/quicktime";
    case "webm": return "video/webm";
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
  if (!res.ok) await throwWithDiagnostics("X post failed", res);
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
  if (!res.ok) await throwWithDiagnostics("X repost failed", res);
  return res.json();
}

// 自分の投稿と指標(いいね/リポスト/リプライ/インプレッション)をまとめて取得
export async function getOwnTweetsWithMetrics(params: { accessToken: string; userId: string; startTime?: string; endTime?: string }) {
  const url = new URL(`${API_BASE}/users/${params.userId}/tweets`);
  url.searchParams.set("tweet.fields", "public_metrics,created_at,referenced_tweets");
  url.searchParams.set("max_results", "100");
  if (params.startTime) url.searchParams.set("start_time", params.startTime);
  if (params.endTime) url.searchParams.set("end_time", params.endTime);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${params.accessToken}` } });
  if (!res.ok) await throwWithDiagnostics("X tweets fetch failed", res);
  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      text: string;
      created_at: string;
      public_metrics: Record<string, number>;
      referenced_tweets?: Array<{ type: "retweeted" | "quoted" | "replied_to"; id: string }>;
    }>;
  };
  return data.data ?? [];
}
