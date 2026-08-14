import type { Account, AccountAnalytics, DailyReport, Draft, RoutineFrequency, RoutinePost, Template } from "./types";

const API_BASE = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL || "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const api = {
  accounts: {
    list: () => request<Account[]>("/accounts"),
    create: (data: { platform: string; displayName: string; handle: string }) =>
      request<Account>("/accounts", { method: "POST", body: JSON.stringify(data) }),
    remove: (id: string) => request<null>(`/accounts/${id}`, { method: "DELETE" }),
    reorder: (orderedIds: string[]) =>
      request<Account[]>("/accounts/reorder", { method: "PUT", body: JSON.stringify({ orderedIds }) }),
  },
  templates: {
    list: () => request<Template[]>("/templates"),
    create: (data: { title: string; body: string; accountId: string | null; mediaUrls?: string[] }) =>
      request<Template>("/templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: { title: string; body: string; accountId: string | null; mediaUrls?: string[] }) =>
      request<Template>(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<null>(`/templates/${id}`, { method: "DELETE" }),
  },
  drafts: {
    list: (params?: { accountId?: string; status?: string }) => {
      const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : "";
      return request<Draft[]>(`/drafts${qs ? `?${qs}` : ""}`);
    },
    create: (data: {
      accountId: string; text: string; mediaUrls?: string[]; source?: string; templateId?: string;
      postMode?: "post" | "quote" | "repost"; quoteTargetId?: string;
    }) => request<Draft>("/drafts", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ text: string; accountId: string; mediaUrls: string[]; postMode: string; quoteTargetId: string | null }>) =>
      request<Draft>(`/drafts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<null>(`/drafts/${id}`, { method: "DELETE" }),
    schedule: (id: string, scheduledAt: string) =>
      request<Draft>(`/drafts/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
    unschedule: (id: string) => request<Draft>(`/drafts/${id}/unschedule`, { method: "POST" }),
    togglePosted: (id: string) => request<Draft>(`/drafts/${id}/toggle-posted`, { method: "POST" }),
    postNow: (id: string) => request<Draft>(`/drafts/${id}/post-now`, { method: "POST" }),
  },
  ai: {
    generateDraft: (data: { accountId: string; input: string; tone: string; provider: "claude" | "openai" }) =>
      request<{ variants: { label: string; text: string }[] }>("/ai/generate-draft", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    dailyReport: (data?: { accountId?: string; provider?: "claude" | "openai" }) =>
      request<{ reports: DailyReport[]; errors?: { accountId: string; error: string }[] }>("/ai/daily-report", {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
    dailyReportHistory: (accountId?: string) =>
      request<DailyReport[]>(`/ai/daily-report/history${accountId ? `?accountId=${accountId}` : ""}`),
  },
  metrics: {
    get: (accountId: string) => request<AccountAnalytics>(`/metrics?accountId=${accountId}`),
  },
  routines: {
    list: (accountId?: string) => request<RoutinePost[]>(`/routines${accountId ? `?accountId=${accountId}` : ""}`),
    create: (data: {
      accountId: string; text: string; mediaUrls?: string[]; frequency: RoutineFrequency;
      daysOfWeek: number[]; hour: number; minute: number; active?: boolean;
    }) => request<RoutinePost>("/routines", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: {
      accountId: string; text: string; mediaUrls?: string[]; frequency: RoutineFrequency;
      daysOfWeek: number[]; hour: number; minute: number; active?: boolean;
    }) => request<RoutinePost>(`/routines/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: string) => request<null>(`/routines/${id}`, { method: "DELETE" }),
  },
  media: {
    presign: (data: { fileName: string; contentType: string; folder?: "drafts" | "templates" }) =>
      request<{ uploadUrl: string; publicUrl: string; key: string }>("/media/presign", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};

export async function uploadImageToS3(file: File, folder: "drafts" | "templates" = "drafts"): Promise<string> {
  const { uploadUrl, publicUrl } = await api.media.presign({ fileName: file.name, contentType: file.type, folder });
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("画像のアップロードに失敗しました");
  return publicUrl;
}
