export type Platform = "x" | "instagram";
export type DraftStatus = "draft" | "scheduled" | "posted" | "failed";
export type DraftSource = "manual" | "ai";
export type PostMode = "post" | "quote" | "repost";

export interface Account {
  id: string;
  platform: Platform;
  displayName: string;
  handle: string;
  connected: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface Template {
  id: string;
  title: string;
  body: string;
  mediaUrls: string[];
  accountId: string | null;
  createdAt: string;
}

export interface Draft {
  id: string;
  accountId: string;
  platform: Platform;
  text: string;
  mediaUrls: string[];
  status: DraftStatus;
  scheduledAt: string | null;
  postedAt: string | null;
  source: DraftSource;
  templateId: string | null;
  postMode: PostMode;
  quoteTargetId: string | null;
  lastError: string | null;
  createdAt: string;
  postLogs?: { platformPostId: string | null }[];
}

export interface DailyReport {
  id: string;
  accountId: string;
  account?: { displayName: string; handle: string };
  reportDate: string;
  reviewText: string;
  improvementsText: string;
  nextActionsText: string;
  createdAt: string;
}

export interface AccountMetricData {
  id: string;
  followersCount: number;
  profileViews: number;
  reach: number;
  capturedAt: string;
}

export interface PostMetricData {
  id: string;
  platformPostId: string;
  likes: number;
  reposts: number;
  replies: number;
  impressions: number;
  saves: number;
  capturedAt: string;
  text: string | null;
}

export interface AccountAnalytics {
  accountMetric: AccountMetricData | null;
  postMetrics: PostMetricData[];
}
