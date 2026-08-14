import { useEffect, useState } from "react";
import {
  Sparkles, Calendar, FileText, Plus, Trash2, Pencil, Clock,
  LayoutGrid, X, Check, Loader2, Users, Layers,
  PackageCheck, Megaphone, Gem, Menu, TrendingUp, History, RefreshCw,
  ChevronRight, ImagePlus, Link2, AlertTriangle, Camera, Send, CheckCircle2, Repeat, ChevronUp, ChevronDown, BarChart3, BookmarkPlus, Search, CalendarClock, Power
} from "lucide-react";
import { api, uploadImageToS3 } from "./api";
import type { Account, AccountAnalytics, DailyReport, Draft, PostMode, RoutineFrequency, RoutinePost, Template } from "./types";

const INK = "#0E0F13";
const PANEL = "#17181F";
const CARD = "#1C1D26";
const HAIRLINE = "#2C2E3A";
const PAPER = "#F1EEE6";
const MUTED = "#8B8D9B";
const GOLD = "#CBA24E";
const GOLD_SOFT = "#8A7237";
const HOLO_A = "#6FD6C9";
const HOLO_B = "#8B7FE8";
const GREEN = "#5FAE7B";
const RED = "#C96A5A";

const FONT_LINK_ID = "xpm-fonts";

function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=IBM+Plex+Sans+JP:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap";
    document.head.appendChild(link);
  }, []);
}

const displayFont = "'Oswald', 'Hiragino Sans', sans-serif";
const bodyFont = "'IBM Plex Sans JP', 'Hiragino Sans', sans-serif";
const monoFont = "'IBM Plex Mono', ui-monospace, monospace";

const TONE_OPTIONS = [
  { id: "hype", label: "煽り系", icon: Megaphone },
  { id: "info", label: "情報系", icon: FileText },
  { id: "sale", label: "セール告知", icon: Gem },
  { id: "unbox", label: "開封速報", icon: PackageCheck },
] as const;

// このシステムは日本のショップ運用が前提のため、閲覧端末の場所に関わらず
// 常に日本時間(JST)で表示・入力する。
const JST_TIMEZONE = "Asia/Tokyo";

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: JST_TIMEZONE })} JST`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: JST_TIMEZONE });
}

// <input type="datetime-local">の値("YYYY-MM-DDTHH:mm")を、閲覧端末の
// タイムゾーンに関係なく「日本時間の壁時計時刻」として解釈しUTC ISOに変換する
function jstLocalInputToIso(localValue: string): string {
  return new Date(`${localValue}:00+09:00`).toISOString();
}

// 閲覧端末のタイムゾーンに関わらず、日本時間での年/月/日/時/分を取得する
function nowJstParts() {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"];
function isVideoUrl(url: string): boolean {
  const ext = url.split(".").pop()?.toLowerCase().split(/[?#]/)[0];
  return !!ext && VIDEO_EXTENSIONS.includes(ext);
}

// Xの上限を超えるファイルは謎の503エラーになるため、アップロード前に弾く
function mediaSizeLimitBytes(file: File): number {
  if (file.type === "image/gif") return 15 * 1024 * 1024;
  if (file.type.startsWith("video/")) return 512 * 1024 * 1024;
  return 5 * 1024 * 1024;
}
function mediaSizeLimitLabel(file: File): string {
  if (file.type === "image/gif") return "GIFは15MB";
  if (file.type.startsWith("video/")) return "動画は512MB";
  return "画像は5MB";
}

function MediaThumb({ url, size = 48 }: { url: string; size?: number }) {
  const style = { width: size, height: size, border: `1px solid ${HAIRLINE}` };
  return isVideoUrl(url) ? (
    <video src={url} muted className="object-cover rounded" style={style} />
  ) : (
    <img src={url} alt="" className="object-cover rounded" style={style} />
  );
}

/* --------------------------------------------------------- 汎用パーツ --------------------------------------------------------- */
function StatusPill({ status, scheduledAt, postedAt }: { status: Draft["status"]; scheduledAt: string | null; postedAt?: string | null }) {
  const map: Record<Draft["status"], { label: string; color: string; bg: string }> = {
    draft: { label: "DRAFT", color: MUTED, bg: "rgba(139,141,155,0.12)" },
    scheduled: { label: `予約 ${formatDateTime(scheduledAt)}`, color: GOLD, bg: "rgba(203,162,78,0.14)" },
    posted: { label: postedAt ? `POSTED ${formatDateTime(postedAt)}` : "POSTED", color: GREEN, bg: "rgba(95,174,123,0.14)" },
    failed: { label: "FAILED", color: RED, bg: "rgba(201,106,90,0.14)" },
  };
  const s = map[status] || map.draft;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] tracking-wide"
      style={{ color: s.color, background: s.bg, fontFamily: monoFont }}
    >
      {s.label}
    </span>
  );
}

function FoilFrame({ children, holo = false }: { children: React.ReactNode; holo?: boolean }) {
  return (
    <div
      className="rounded-xl p-[1.5px]"
      style={{
        background: holo
          ? `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B}, ${HOLO_A})`
          : `linear-gradient(135deg, ${GOLD_SOFT}, ${HAIRLINE} 40%, ${HAIRLINE} 60%, ${GOLD_SOFT})`,
      }}
    >
      <div className="rounded-[10px] h-full" style={{ background: CARD }}>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- 下書きカード --------------------------------------------------------- */
function DraftCard({
  draft, account, onEdit, onDelete, onSchedule, onTogglePosted, onPostNow, onRepost, onSaveAsTemplate, posting = false,
}: {
  draft: Draft; account?: Account;
  onEdit: (d: Draft) => void; onDelete: (d: Draft) => void;
  onSchedule: (d: Draft) => void; onTogglePosted: (d: Draft) => void; onPostNow: (d: Draft) => void;
  onRepost: (d: Draft) => void; onSaveAsTemplate: (text: string, mediaUrls: string[]) => void;
  posting?: boolean;
}) {
  const canPostNow = draft.status !== "posted" && !!account?.connected && !posting;
  const canRepost = draft.status === "posted" && draft.platform === "x" && !!draft.postLogs?.[0]?.platformPostId;
  return (
    <FoilFrame holo={draft.source === "ai"}>
      <div className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: monoFont, fontSize: 11, color: MUTED }}>
            {account ? account.handle : "未割当"}
          </span>
          <StatusPill status={draft.status} scheduledAt={draft.scheduledAt} postedAt={draft.postedAt} />
        </div>
        {draft.postMode !== "post" && (
          <span className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded text-[10px]" style={{ color: HOLO_A, background: "rgba(111,214,201,0.12)", fontFamily: monoFont }}>
            <Repeat size={10} /> {draft.postMode === "repost" ? "リポスト" : "引用リポスト"}
          </span>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap flex-1" style={{ color: PAPER, fontFamily: bodyFont, minHeight: 60 }}>
          {draft.text || <span style={{ color: MUTED }}>本文なし</span>}
        </p>
        {draft.mediaUrls.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {draft.mediaUrls.map((url) => (
              <MediaThumb key={url} url={url} />
            ))}
          </div>
        )}
        {draft.status === "failed" && draft.lastError && (
          <div className="flex items-start gap-1.5 text-[11px]" style={{ color: RED }}>
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{draft.lastError}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }}>No. {draft.id.slice(-6).toUpperCase()}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPostNow(draft)}
              disabled={!canPostNow}
              title={posting ? "投稿処理中…" : account?.connected ? "今すぐ投稿" : "先にアカウント連携が必要です"}
              className="p-1.5 rounded hover:opacity-80 transition disabled:opacity-30 disabled:hover:opacity-30"
              style={{ color: HOLO_A }}
            >
              {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
            <button onClick={() => onSchedule(draft)} title="予約日時を設定" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: GOLD }}>
              <Clock size={15} />
            </button>
            <button onClick={() => onEdit(draft)} title="編集" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: MUTED }}>
              <Pencil size={15} />
            </button>
            {canRepost && (
              <button onClick={() => onRepost(draft)} title="この投稿をリポストする下書きを作成" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: HOLO_A }}>
                <Repeat size={15} />
              </button>
            )}
            <button onClick={() => onSaveAsTemplate(draft.text, draft.mediaUrls)} title="本文をテンプレートとして保存" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: MUTED }}>
              <BookmarkPlus size={15} />
            </button>
            <button onClick={() => onTogglePosted(draft)} title="投稿済みにする(記録用)" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: draft.status === "posted" ? GREEN : MUTED }}>
              <Check size={15} />
            </button>
            <button onClick={() => onDelete(draft)} title="削除" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: RED }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </FoilFrame>
  );
}

/* --------------------------------------------------------- 投稿履歴(蛇腹表示) --------------------------------------------------------- */
function PostedAccordionItem({
  draft, account, open, onToggle, onEdit, onDelete, onTogglePosted, onRepost, onSaveAsTemplate,
  onCreateDraft, onRepostSameTime,
}: {
  draft: Draft; account?: Account; open: boolean; onToggle: () => void;
  onEdit: (d: Draft) => void; onDelete: (d: Draft) => void; onTogglePosted: (d: Draft) => void;
  onRepost: (d: Draft) => void; onSaveAsTemplate: (text: string, mediaUrls: string[]) => void;
  onCreateDraft: (d: Draft) => void; onRepostSameTime: (d: Draft) => void;
}) {
  const canRepost = draft.platform === "x" && !!draft.postLogs?.[0]?.platformPostId;
  const time = draft.postedAt
    ? new Date(draft.postedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: JST_TIMEZONE })
    : "";
  return (
    <FoilFrame>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2.5 text-left min-w-0">
        <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }} className="shrink-0">{time}</span>
        <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }} className="shrink-0 truncate max-w-[30%]">{account?.handle ?? "未割当"}</span>
        <span className="truncate flex-1 text-xs" style={{ color: PAPER }}>
          {draft.text || <span style={{ color: MUTED }}>本文なし</span>}
        </span>
        <ChevronDown size={13} className="shrink-0" style={{ color: MUTED, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 flex flex-col gap-2">
          {draft.postMode !== "post" && (
            <span className="inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded text-[10px]" style={{ color: HOLO_A, background: "rgba(111,214,201,0.12)", fontFamily: monoFont }}>
              <Repeat size={10} /> {draft.postMode === "repost" ? "リポスト" : "引用リポスト"}
            </span>
          )}
          <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: PAPER, fontFamily: bodyFont }}>
            {draft.text || <span style={{ color: MUTED }}>本文なし</span>}
          </p>
          {draft.mediaUrls.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {draft.mediaUrls.map((url) => (
                <MediaThumb key={url} url={url} />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }}>No. {draft.id.slice(-6).toUpperCase()}</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => onEdit(draft)} title="編集" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: MUTED }}>
                <Pencil size={14} />
              </button>
              <button onClick={() => onCreateDraft(draft)} title="この内容を下書きにする" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: MUTED }}>
                <FileText size={14} />
              </button>
              <button onClick={() => onRepostSameTime(draft)} title="同じ文章・同じ時間で本日再投稿する" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: GOLD }}>
                <RefreshCw size={14} />
              </button>
              {canRepost && (
                <button onClick={() => onRepost(draft)} title="この投稿をリポストする下書きを作成" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: HOLO_A }}>
                  <Repeat size={14} />
                </button>
              )}
              <button onClick={() => onSaveAsTemplate(draft.text, draft.mediaUrls)} title="本文をテンプレートとして保存" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: MUTED }}>
                <BookmarkPlus size={14} />
              </button>
              <button onClick={() => onTogglePosted(draft)} title="投稿済みを解除" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: GREEN }}>
                <Check size={14} />
              </button>
              <button onClick={() => onDelete(draft)} title="削除" className="p-1.5 rounded hover:opacity-80 transition" style={{ color: RED }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </FoilFrame>
  );
}

/* --------------------------------------------------------- 下書き編集モーダル --------------------------------------------------------- */
const POST_MODE_OPTIONS = [
  { id: "post", label: "通常投稿" },
  { id: "quote", label: "引用リポスト" },
  { id: "repost", label: "リポスト" },
] as const;

function DraftEditorModal({
  open, onClose, onSave, draft, accounts, templates, drafts, initialText, initialMediaUrls, defaultAccountId, onSaveAsTemplate,
}: {
  open: boolean; onClose: () => void;
  onSave: (v: { accountId: string; text: string; mediaUrls: string[]; postMode: PostMode; quoteTargetId: string | null }) => void;
  draft: Draft | null; accounts: Account[]; templates: Template[]; drafts: Draft[]; initialText?: string; initialMediaUrls?: string[];
  defaultAccountId?: string;
  onSaveAsTemplate: (text: string, mediaUrls: string[]) => void;
}) {
  const [accountId, setAccountId] = useState(draft?.accountId || defaultAccountId || accounts[0]?.id || "");
  const [text, setText] = useState(draft?.text || initialText || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(draft?.mediaUrls || initialMediaUrls || []);
  const [templateId, setTemplateId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [postMode, setPostMode] = useState<PostMode>(draft?.postMode || "post");
  const [quoteTargetId, setQuoteTargetId] = useState(draft?.quoteTargetId || "");

  useEffect(() => {
    setAccountId(draft?.accountId || defaultAccountId || accounts[0]?.id || "");
    setText(draft?.text || initialText || "");
    setMediaUrls(draft?.mediaUrls || initialMediaUrls || []);
    setTemplateId("");
    setPostMode(draft?.postMode || "post");
    setQuoteTargetId(draft?.quoteTargetId || "");
  }, [draft, open, accounts, initialText, initialMediaUrls, defaultAccountId]);

  if (!open) return null;

  const account = accounts.find((a) => a.id === accountId);
  const repostCandidates = drafts.filter(
    (d) => d.accountId === accountId && d.status === "posted" && d.postLogs?.[0]?.platformPostId,
  );

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((t) => t.id === id);
    if (t) {
      setText(t.body);
      setMediaUrls(t.mediaUrls);
    }
  };

  const templatesForAccount = templates.filter((t) => t.accountId === null || t.accountId === accountId);

  const selectRepostTarget = (targetId: string) => {
    setQuoteTargetId(targetId);
    if (postMode === "repost") {
      const target = repostCandidates.find((d) => d.postLogs?.[0]?.platformPostId === targetId);
      if (target) setText(`🔁 リポスト: ${target.text.slice(0, 60)}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const oversized = files.filter((f) => f.size > mediaSizeLimitBytes(f));
    if (oversized.length > 0) {
      alert(oversized.map((f) => `「${f.name}」が大きすぎます(${mediaSizeLimitLabel(f)}まで)`).join("\n"));
    }
    const validFiles = files.filter((f) => f.size <= mediaSizeLimitBytes(f));
    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of validFiles) {
        urls.push(await uploadImageToS3(file));
      }
      setMediaUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <h3 style={{ fontFamily: displayFont, color: PAPER, letterSpacing: 0.5 }} className="text-base uppercase">
            {draft ? "下書きを編集" : "新規下書き"}
          </h3>
          <button onClick={onClose} style={{ color: MUTED }}><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>アカウント</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.displayName} ({a.handle})</option>
              ))}
            </select>
          </div>
          {account?.platform === "x" && (
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>投稿タイプ</label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {POST_MODE_OPTIONS.map((p) => {
                  const active = postMode === p.id;
                  return (
                    <button key={p.id} onClick={() => setPostMode(p.id)} className="px-2 py-2 rounded text-xs" style={{ background: active ? "rgba(111,214,201,0.15)" : CARD, color: active ? HOLO_A : MUTED, border: `1px solid ${active ? HOLO_A : HAIRLINE}` }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {postMode !== "post" && account?.platform === "x" && (
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>リポスト対象(このアカウントの過去の投稿済み投稿)</label>
              <select value={quoteTargetId} onChange={(e) => selectRepostTarget(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
                <option value="">選択してください</option>
                {repostCandidates.map((d) => (
                  <option key={d.id} value={d.postLogs?.[0]?.platformPostId ?? ""}>
                    {formatDateTime(d.postedAt)} — {d.text.slice(0, 40)}
                  </option>
                ))}
              </select>
              {repostCandidates.length === 0 && (
                <p className="text-[11px] mt-1" style={{ color: MUTED }}>このアカウントには投稿済みの投稿がまだありません。</p>
              )}
            </div>
          )}
          {templatesForAccount.length > 0 && postMode !== "repost" && (
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>テンプレートから作成(任意)</label>
              <select value={templateId} onChange={(e) => applyTemplate(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
                <option value="">選択しない</option>
                {templatesForAccount.map((t) => <option key={t.id} value={t.id}>{t.accountId ? t.title : `${t.title}(共通)`}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>
              {postMode === "repost" ? "本文(リポストのため送信されません)" : postMode === "quote" ? "引用コメント" : "本文"}
            </label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={postMode === "repost" ? 2 : 6} disabled={postMode === "repost"} className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed disabled:opacity-60" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }} placeholder={postMode === "quote" ? "引用に添えるコメントを入力…" : "投稿文を入力…"} />
            <div className="flex items-center justify-between mt-1">
              {postMode !== "repost" ? (
                <button onClick={() => onSaveAsTemplate(text, mediaUrls)} disabled={!text.trim()} className="flex items-center gap-1 text-[11px] disabled:opacity-40" style={{ color: HOLO_A, fontFamily: monoFont }}>
                  <BookmarkPlus size={12} /> テンプレートとして保存
                </button>
              ) : <span />}
              <span className="text-[11px]" style={{ color: text.length > 280 ? RED : MUTED, fontFamily: monoFont }}>{text.length} / 280</span>
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>画像・動画(任意、Instagramは1枚必須)</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {mediaUrls.map((url) => (
                <div key={url} className="relative">
                  <MediaThumb url={url} size={64} />
                  <button onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))} className="absolute -top-1.5 -right-1.5 rounded-full p-0.5" style={{ background: RED, color: INK }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer" style={{ border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                <span className="text-[9px]">ライブラリ</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
              <label className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer" style={{ border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                <span className="text-[9px]">カメラ</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button
            onClick={() => {
              if (!accountId || !text.trim()) return;
              if (postMode !== "post" && !quoteTargetId) return;
              onSave({ accountId, text, mediaUrls, postMode, quoteTargetId: postMode === "post" ? null : quoteTargetId });
            }}
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ background: GOLD, color: INK }}
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- 予約日時モーダル --------------------------------------------------------- */
function ScheduleSelect({ value, onChange, options, label }: { value: number; onChange: (v: number) => void; options: { value: number; label: string }[]; label: string }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="text-[10px] block mb-1" style={{ color: MUTED, fontFamily: monoFont }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded px-2 py-2 text-sm"
        style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ScheduleModal({ open, onClose, onConfirm, draft }: { open: boolean; onClose: () => void; onConfirm: (iso: string) => void; draft: Draft | null }) {
  const defaults = nowJstParts();
  const [year, setYear] = useState(defaults.year);
  const [month, setMonth] = useState(defaults.month);
  const [day, setDay] = useState(defaults.day);
  const [hour, setHour] = useState(defaults.hour);
  const [minute, setMinute] = useState(defaults.minute);

  useEffect(() => {
    if (open) {
      const d = nowJstParts();
      setYear(d.year); setMonth(d.month); setDay(d.day); setHour(d.hour); setMinute(d.minute);
    }
  }, [draft, open]);

  const maxDay = daysInMonth(year, month);
  useEffect(() => { if (day > maxDay) setDay(maxDay); }, [maxDay, day]);

  // 現在時刻(JST、モーダルを開いた時点)より前の日時は選べないようにする
  const isCurrentYear = year === defaults.year;
  const minMonth = isCurrentYear ? defaults.month : 1;
  const isCurrentYearMonth = isCurrentYear && month === defaults.month;
  const minDay = isCurrentYearMonth ? defaults.day : 1;
  const isCurrentDate = isCurrentYearMonth && day === defaults.day;
  const minHour = isCurrentDate ? defaults.hour : 0;
  const isCurrentHour = isCurrentDate && hour === defaults.hour;
  const minMinute = isCurrentHour ? defaults.minute : 0;

  useEffect(() => { if (month < minMonth) setMonth(minMonth); }, [minMonth, month]);
  useEffect(() => { if (day < minDay) setDay(minDay); }, [minDay, day]);
  useEffect(() => { if (hour < minHour) setHour(minHour); }, [minHour, hour]);
  useEffect(() => { if (minute < minMinute) setMinute(minMinute); }, [minMinute, minute]);

  if (!open) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const localValue = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <h3 style={{ fontFamily: displayFont, color: PAPER }} className="text-base uppercase mb-1">投稿予約日時</h3>
        <p className="text-xs mb-3" style={{ color: MUTED, fontFamily: monoFont }}>日本時間(JST)で選択してください(現在時刻以降のみ)</p>
        <div className="flex gap-2 mb-2">
          <ScheduleSelect label="年" value={year} onChange={setYear} options={[0, 1, 2].map((n) => ({ value: defaults.year + n, label: `${defaults.year + n}年` }))} />
          <ScheduleSelect label="月" value={month} onChange={setMonth} options={Array.from({ length: 12 - minMonth + 1 }, (_, i) => ({ value: minMonth + i, label: `${minMonth + i}月` }))} />
          <ScheduleSelect label="日" value={day} onChange={setDay} options={Array.from({ length: maxDay - minDay + 1 }, (_, i) => ({ value: minDay + i, label: `${minDay + i}日` }))} />
        </div>
        <div className="flex gap-2 mb-4">
          <ScheduleSelect label="時" value={hour} onChange={setHour} options={Array.from({ length: 24 - minHour }, (_, i) => ({ value: minHour + i, label: `${pad(minHour + i)}時` }))} />
          <ScheduleSelect label="分" value={minute} onChange={setMinute} options={Array.from({ length: 60 - minMinute }, (_, i) => ({ value: minMinute + i, label: `${pad(minMinute + i)}分` }))} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button onClick={() => onConfirm(jstLocalInputToIso(localValue))} className="px-4 py-2 rounded text-sm font-medium" style={{ background: GOLD, color: INK }}>予約する</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- テンプレート編集モーダル --------------------------------------------------------- */
function TemplateEditorModal({
  open, onClose, onSave, template, accounts, defaultAccountId,
}: {
  open: boolean; onClose: () => void;
  onSave: (v: { title: string; body: string; accountId: string | null; mediaUrls: string[] }) => void;
  template: Template | null; accounts: Account[]; defaultAccountId: string | null;
}) {
  const [title, setTitle] = useState(template?.title || "");
  const [body, setBody] = useState(template?.body || "");
  const [accountId, setAccountId] = useState<string | null>(template ? template.accountId : defaultAccountId);
  const [mediaUrls, setMediaUrls] = useState<string[]>(template?.mediaUrls || []);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    setTitle(template?.title || "");
    setBody(template?.body || "");
    setAccountId(template ? template.accountId : defaultAccountId);
    setMediaUrls(template?.mediaUrls || []);
  }, [template, open, defaultAccountId]);
  if (!open) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const oversized = files.filter((f) => f.size > mediaSizeLimitBytes(f));
    if (oversized.length > 0) {
      alert(oversized.map((f) => `「${f.name}」が大きすぎます(${mediaSizeLimitLabel(f)}まで)`).join("\n"));
    }
    const validFiles = files.filter((f) => f.size <= mediaSizeLimitBytes(f));
    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of validFiles) {
        urls.push(await uploadImageToS3(file, "templates"));
      }
      setMediaUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <h3 style={{ fontFamily: displayFont, color: PAPER }} className="text-base uppercase">{template ? "テンプレート編集" : "新規テンプレート"}</h3>
          <button onClick={onClose} style={{ color: MUTED }}><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>テンプレート名</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }} placeholder="例: 新入荷速報" />
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>公開範囲</label>
            <select value={accountId ?? ""} onChange={(e) => setAccountId(e.target.value || null)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
              <option value="">共通(すべてのアカウント)</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName}専用</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>
              本文 <span style={{ color: HOLO_A }}>{"{商品名}"} {"{URL}"} のように差し替え箇所を波括弧で書けます</span>
            </label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }} />
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>画像・動画(任意)</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {mediaUrls.map((url) => (
                <div key={url} className="relative">
                  <MediaThumb url={url} size={64} />
                  <button onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))} className="absolute -top-1.5 -right-1.5 rounded-full p-0.5" style={{ background: RED, color: INK }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer" style={{ border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                <span className="text-[9px]">ライブラリ</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
              <label className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer" style={{ border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                <span className="text-[9px]">カメラ</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button onClick={() => { if (title.trim() && body.trim()) onSave({ title, body, accountId, mediaUrls }); }} className="px-4 py-2 rounded text-sm font-medium" style={{ background: GOLD, color: INK }}>保存する</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- ルーティーン編集モーダル --------------------------------------------------------- */
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function RoutineEditorModal({
  open, onClose, onSave, routine, accounts, defaultAccountId,
}: {
  open: boolean; onClose: () => void;
  onSave: (v: {
    accountId: string; text: string; mediaUrls: string[]; frequency: RoutineFrequency;
    daysOfWeek: number[]; hour: number; minute: number; active: boolean;
  }) => void;
  routine: RoutinePost | null; accounts: Account[]; defaultAccountId: string;
}) {
  const [accountId, setAccountId] = useState(routine?.accountId || defaultAccountId);
  const [text, setText] = useState(routine?.text || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(routine?.mediaUrls || []);
  const [uploading, setUploading] = useState(false);
  const [frequency, setFrequency] = useState<RoutineFrequency>(routine?.frequency || "weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(routine?.daysOfWeek || []);
  const [hour, setHour] = useState(routine?.hour ?? 15);
  const [minute, setMinute] = useState(routine?.minute ?? 0);
  const [active, setActive] = useState(routine?.active ?? true);

  useEffect(() => {
    setAccountId(routine?.accountId || defaultAccountId);
    setText(routine?.text || "");
    setMediaUrls(routine?.mediaUrls || []);
    setFrequency(routine?.frequency || "weekly");
    setDaysOfWeek(routine?.daysOfWeek || []);
    setHour(routine?.hour ?? 15);
    setMinute(routine?.minute ?? 0);
    setActive(routine?.active ?? true);
  }, [routine, open, defaultAccountId]);

  if (!open) return null;

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const oversized = files.filter((f) => f.size > mediaSizeLimitBytes(f));
    if (oversized.length > 0) {
      alert(oversized.map((f) => `「${f.name}」が大きすぎます(${mediaSizeLimitLabel(f)}まで)`).join("\n"));
    }
    const validFiles = files.filter((f) => f.size <= mediaSizeLimitBytes(f));
    if (validFiles.length === 0) {
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of validFiles) {
        urls.push(await uploadImageToS3(file, "drafts"));
      }
      setMediaUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const canSave = accountId && text.trim() && (frequency === "daily" || daysOfWeek.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg rounded-xl max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <h3 style={{ fontFamily: displayFont, color: PAPER }} className="text-base uppercase">{routine ? "ルーティーン編集" : "新規ルーティーン"}</h3>
          <button onClick={onClose} style={{ color: MUTED }}><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>アカウント</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.displayName} ({a.handle})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>繰り返し</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {([{ id: "daily", label: "毎日" }, { id: "weekly", label: "曜日指定" }] as const).map((f) => {
                const activeF = frequency === f.id;
                return (
                  <button key={f.id} onClick={() => setFrequency(f.id)} className="px-2 py-2 rounded text-xs" style={{ background: activeF ? "rgba(111,214,201,0.15)" : CARD, color: activeF ? HOLO_A : MUTED, border: `1px solid ${activeF ? HOLO_A : HAIRLINE}` }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          {frequency === "weekly" && (
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>曜日(複数選択可)</label>
              <div className="flex gap-1 mt-1">
                {WEEKDAY_LABELS.map((label, d) => {
                  const activeD = daysOfWeek.includes(d);
                  return (
                    <button key={d} onClick={() => toggleDay(d)} className="flex-1 py-2 rounded text-xs" style={{ background: activeD ? "rgba(203,162,78,0.15)" : CARD, color: activeD ? GOLD : MUTED, border: `1px solid ${activeD ? GOLD_SOFT : HAIRLINE}` }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <ScheduleSelect label="時" value={hour} onChange={setHour} options={Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${pad2(i)}時` }))} />
            <ScheduleSelect label="分" value={minute} onChange={setMinute} options={Array.from({ length: 60 }, (_, i) => ({ value: i, label: `${pad2(i)}分` }))} />
          </div>
          <p className="text-[11px]" style={{ color: MUTED }}>日本時間(JST)で毎回この時刻以降に自動で予約投稿が作成されます。</p>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>本文</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }} placeholder="繰り返し投稿する内容を入力…" />
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>画像・動画(任意)</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {mediaUrls.map((url) => (
                <div key={url} className="relative">
                  <MediaThumb url={url} size={64} />
                  <button onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))} className="absolute -top-1.5 -right-1.5 rounded-full p-0.5" style={{ background: RED, color: INK }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <label className="w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded cursor-pointer" style={{ border: `1px dashed ${HAIRLINE}`, color: MUTED }}>
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                <span className="text-[9px]">ライブラリ</span>
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            有効にする(オフにすると一時停止できます)
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button
            onClick={() => { if (canSave) onSave({ accountId, text, mediaUrls, frequency, daysOfWeek: frequency === "daily" ? [] : daysOfWeek, hour, minute, active }); }}
            disabled={!canSave}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-40"
            style={{ background: GOLD, color: INK }}
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- アカウント追加モーダル --------------------------------------------------------- */
function AccountEditorModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (v: { platform: "x" | "instagram"; displayName: string; handle: string }) => void }) {
  const [platform, setPlatform] = useState<"x" | "instagram">("x");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  useEffect(() => { if (open) { setPlatform("x"); setDisplayName(""); setHandle(""); } }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <h3 style={{ fontFamily: displayFont, color: PAPER }} className="text-base uppercase mb-4">アカウントを追加</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>プラットフォーム</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as "x" | "instagram")} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
              <option value="x">X (旧Twitter)</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>表示名</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }} placeholder="例: 秋葉原本店" />
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>ハンドル/ID</label>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }} placeholder="例: @cardshop_akb" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button onClick={() => { if (displayName.trim() && handle.trim()) onSave({ platform, displayName, handle }); }} className="px-4 py-2 rounded text-sm font-medium" style={{ background: GOLD, color: INK }}>追加する</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- AI生成モーダル --------------------------------------------------------- */
function AIGenerateModal({
  open, onClose, accounts, defaultAccountId, onAdopt,
}: { open: boolean; onClose: () => void; accounts: Account[]; defaultAccountId: string; onAdopt: (v: { accountId: string; text: string }) => void }) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [input, setInput] = useState("");
  const [tone, setTone] = useState<(typeof TONE_OPTIONS)[number]["id"]>("hype");
  const [provider, setProvider] = useState<"claude" | "openai">("claude");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<{ label: string; text: string }[]>([]);

  useEffect(() => {
    if (open) { setAccountId(defaultAccountId); setInput(""); setVariants([]); setError(""); }
  }, [open, defaultAccountId]);

  if (!open) return null;

  const generate = async () => {
    if (!input.trim() || !accountId) return;
    setLoading(true);
    setError("");
    setVariants([]);
    try {
      const { variants } = await api.ai.generateDraft({ accountId, input, tone, provider });
      setVariants(variants);
    } catch {
      setError("生成に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="w-full max-w-2xl rounded-xl max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <h3 className="flex items-center gap-2 text-base uppercase" style={{ fontFamily: displayFont, color: PAPER }}>
            <Sparkles size={16} style={{ color: HOLO_A }} /> AI下書き生成
          </h3>
          <button onClick={onClose} style={{ color: MUTED }}><X size={18} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>アカウント</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full mt-1 rounded px-3 py-2 text-sm" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName} ({a.handle})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>AIモデル</label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {([
                  { id: "claude", label: "Claude" },
                  { id: "openai", label: "ChatGPT" },
                ] as const).map((p) => {
                  const active = provider === p.id;
                  return (
                    <button key={p.id} onClick={() => setProvider(p.id)} className="flex items-center justify-center gap-1.5 px-2 py-2 rounded text-xs" style={{ background: active ? "rgba(111,214,201,0.15)" : CARD, color: active ? HOLO_A : MUTED, border: `1px solid ${active ? HOLO_A : HAIRLINE}` }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>トーン</label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {TONE_OPTIONS.map((t) => {
                const Icon = t.icon;
                const active = tone === t.id;
                return (
                  <button key={t.id} onClick={() => setTone(t.id)} className="flex items-center gap-1.5 px-2 py-2 rounded text-xs" style={{ background: active ? "rgba(203,162,78,0.15)" : CARD, color: active ? GOLD : MUTED, border: `1px solid ${active ? GOLD_SOFT : HAIRLINE}` }}>
                    <Icon size={12} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>投稿のもとになる情報</label>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={4} placeholder="例: ○○弾のシングルカードが本日入荷。人気カード多数、通販は明日10時から受付開始。" className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed" style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }} />
          </div>
          <button onClick={generate} disabled={loading || !input.trim()} className="flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "生成中…" : "3パターン生成する"}
          </button>
          {error && <p className="text-sm" style={{ color: RED }}>{error}</p>}
          {variants.length > 0 && (
            <div className="flex flex-col gap-3 pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              {variants.map((v, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${HAIRLINE}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontFamily: monoFont, fontSize: 11, color: HOLO_A }}>{v.label || `パターン${i + 1}`}</span>
                    <button onClick={() => onAdopt({ accountId, text: v.text })} className="text-xs px-3 py-1 rounded" style={{ background: GOLD, color: INK }}>下書きに採用</button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: PAPER, fontFamily: bodyFont }}>{v.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- メイン --------------------------------------------------------- */
export default function App() {
  useFonts();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState(() => localStorage.getItem("xpm:activeAccountId") || "all");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [routines, setRoutines] = useState<RoutinePost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [tab, setTab] = useState(() => localStorage.getItem("xpm:tab") || "dashboard");
  const [ready, setReady] = useState(false);

  useEffect(() => { localStorage.setItem("xpm:tab", tab); }, [tab]);
  useEffect(() => { localStorage.setItem("xpm:activeAccountId", activeAccountId); }, [activeAccountId]);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Draft | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [accountAnalytics, setAccountAnalytics] = useState<AccountAnalytics | null>(null);
  const [reportsPage, setReportsPage] = useState(0);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedPostedId, setExpandedPostedId] = useState<string | null>(null);
  const [postingIds, setPostingIds] = useState<Set<string>>(new Set());
  const [templateSearch, setTemplateSearch] = useState("");
  const [draftInitialText, setDraftInitialText] = useState<string | undefined>(undefined);
  const [draftInitialMediaUrls, setDraftInitialMediaUrls] = useState<string[] | undefined>(undefined);
  const [draftInitialAccountId, setDraftInitialAccountId] = useState<string | undefined>(undefined);
  const [routineEditorOpen, setRoutineEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutinePost | null>(null);

  const reloadAll = async () => {
    try {
      const [a, t, d, r, rt] = await Promise.all([
        api.accounts.list(), api.templates.list(), api.drafts.list(), api.ai.dailyReportHistory(), api.routines.list(),
      ]);
      setAccounts(a); setTemplates(t); setDrafts(d); setReports(r); setRoutines(rt);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => { reloadAll(); }, []);

  useEffect(() => {
    if (tab === "dashboard" && activeAccountId !== "all") {
      api.metrics.get(activeAccountId).then(setAccountAnalytics).catch(() => setAccountAnalytics(null));
    } else {
      setAccountAnalytics(null);
    }
  }, [tab, activeAccountId]);

  useEffect(() => { setReportsPage(0); }, [activeAccountId, tab]);

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: JST_TIMEZONE });
  const sortedReports = [...reports].sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
  const reportsForActiveAccount = activeAccountId === "all" ? [] : sortedReports.filter((r) => r.accountId === activeAccountId);
  const latestReportForActiveAccount = reportsForActiveAccount[0] || null;
  const latestReportPerAccount = accounts
    .map((a) => ({ account: a, report: sortedReports.find((r) => r.accountId === a.id) || null }))
    .filter((x): x is { account: Account; report: DailyReport } => x.report !== null);

  const generateDailyReport = async () => {
    setReportLoading(true);
    setReportError("");
    try {
      const { reports: newReports, errors } = await api.ai.dailyReport(
        activeAccountId === "all" ? undefined : { accountId: activeAccountId },
      );
      setReports((prev) => [...newReports, ...prev.filter((r) => !newReports.some((n) => n.id === r.id))]);
      if (errors?.length) setReportError(`一部のアカウントでレポート生成に失敗しました: ${errors.map((e) => e.error).join(" / ")}`);
      if (activeAccountId !== "all") {
        api.metrics.get(activeAccountId).then(setAccountAnalytics).catch(() => {});
      }
    } catch (e) {
      setReportError(`レポート生成に失敗しました: ${(e as Error).message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const visibleDrafts = drafts.filter((d) => {
    if (activeAccountId !== "all" && d.accountId !== activeAccountId) return false;
    if (tab === "drafts") return d.status === "draft";
    if (tab === "scheduled") return d.status === "scheduled";
    if (tab === "posted") return d.status === "posted";
    if (tab === "failed") return d.status === "failed";
    return true;
  }).sort((a, b) => {
    if (tab === "scheduled") return new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime();
    if (tab === "posted") return new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const accountOf = (id: string) => accounts.find((a) => a.id === id);

  const saveDraft = async (
    { accountId, text, mediaUrls, postMode, quoteTargetId }:
    { accountId: string; text: string; mediaUrls: string[]; postMode: PostMode; quoteTargetId: string | null },
  ) => {
    if (editingDraft) {
      const updated = await api.drafts.update(editingDraft.id, { accountId, text, mediaUrls, postMode, quoteTargetId });
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } else {
      const created = await api.drafts.create({ accountId, text, mediaUrls, source: "manual", postMode, quoteTargetId: quoteTargetId ?? undefined });
      setDrafts((prev) => [created, ...prev]);
    }
    setEditorOpen(false);
    setEditingDraft(null);
    setDraftInitialText(undefined);
    setDraftInitialMediaUrls(undefined);
    setDraftInitialAccountId(undefined);
  };

  const deleteDraft = async (draft: Draft) => {
    await api.drafts.remove(draft.id);
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
  };

  const togglePosted = async (draft: Draft) => {
    const updated = await api.drafts.togglePosted(draft.id);
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const postNow = async (draft: Draft) => {
    if (postingIds.has(draft.id)) return; // 連打防止
    const account = accountOf(draft.accountId);
    if (!account?.connected) {
      alert("先にアカウント連携が必要です(「アカウント」タブから連携できます)");
      return;
    }
    if (!confirm(`${account.displayName}(${account.handle})として今すぐ投稿します。よろしいですか?`)) return;
    setPostingIds((prev) => new Set(prev).add(draft.id));
    try {
      const updated = await api.drafts.postNow(draft.id);
      setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (e) {
      alert(`投稿に失敗しました: ${(e as Error).message}`);
      reloadAll();
    } finally {
      setPostingIds((prev) => {
        const next = new Set(prev);
        next.delete(draft.id);
        return next;
      });
    }
  };

  const repostDraft = async (draft: Draft) => {
    const targetId = draft.postLogs?.[0]?.platformPostId;
    if (!targetId) {
      alert("リポスト対象の投稿IDが見つかりませんでした");
      return;
    }
    const created = await api.drafts.create({
      accountId: draft.accountId,
      text: `🔁 リポスト: ${draft.text.slice(0, 60)}`,
      source: "manual",
      postMode: "repost",
      quoteTargetId: targetId,
    });
    setDrafts((prev) => [created, ...prev]);
    setTab("drafts");
    alert("下書きに追加しました。「予約」または「今すぐ投稿」から実行できます。");
  };

  const confirmSchedule = async (iso: string) => {
    if (!scheduleTarget) return;
    const updated = await api.drafts.schedule(scheduleTarget.id, iso);
    setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setScheduleTarget(null);
  };

  const saveTemplate = async ({ title, body, accountId, mediaUrls }: { title: string; body: string; accountId: string | null; mediaUrls: string[] }) => {
    if (editingTemplate) {
      const updated = await api.templates.update(editingTemplate.id, { title, body, accountId, mediaUrls });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } else {
      const created = await api.templates.create({ title, body, accountId, mediaUrls });
      setTemplates((prev) => [created, ...prev]);
    }
    setTemplateEditorOpen(false);
    setEditingTemplate(null);
  };

  const deleteTemplate = async (t: Template) => {
    await api.templates.remove(t.id);
    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
  };

  const saveRoutine = async (v: {
    accountId: string; text: string; mediaUrls: string[]; frequency: RoutineFrequency;
    daysOfWeek: number[]; hour: number; minute: number; active: boolean;
  }) => {
    if (editingRoutine) {
      const updated = await api.routines.update(editingRoutine.id, v);
      setRoutines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } else {
      const created = await api.routines.create(v);
      setRoutines((prev) => [created, ...prev]);
    }
    setRoutineEditorOpen(false);
    setEditingRoutine(null);
  };

  const deleteRoutine = async (r: RoutinePost) => {
    if (!confirm("このルーティーンを削除しますか?")) return;
    await api.routines.remove(r.id);
    setRoutines((prev) => prev.filter((x) => x.id !== r.id));
  };

  const toggleRoutineActive = async (r: RoutinePost) => {
    const updated = await api.routines.update(r.id, {
      accountId: r.accountId, text: r.text, mediaUrls: r.mediaUrls, frequency: r.frequency,
      daysOfWeek: r.daysOfWeek, hour: r.hour, minute: r.minute, active: !r.active,
    });
    setRoutines((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  const saveTextAsTemplate = async (body: string, mediaUrls: string[] = [], accountId: string | null = null) => {
    if (!body.trim()) return;
    const title = window.prompt("テンプレート名を入力してください");
    if (!title) return;
    const created = await api.templates.create({ title, body, accountId, mediaUrls });
    setTemplates((prev) => [created, ...prev]);
    alert("テンプレートに保存しました");
  };

  const createDraftFromTemplate = (template: Template) => {
    setEditingDraft(null);
    setDraftInitialText(template.body);
    setDraftInitialMediaUrls(template.mediaUrls);
    setDraftInitialAccountId(undefined);
    setEditorOpen(true);
  };

  // 過去の投稿を下書きとして複製する(本文・画像・アカウントを引き継ぐ)
  const createDraftFromPost = (draft: Draft) => {
    setEditingDraft(null);
    setDraftInitialText(draft.text);
    setDraftInitialMediaUrls(draft.mediaUrls);
    setDraftInitialAccountId(draft.accountId);
    setEditorOpen(true);
  };

  // 過去の投稿と同じ文章・同じ時刻(JST)で、日付だけ本日にして予約投稿を作成する
  const repostSameTimeToday = async (draft: Draft) => {
    if (!draft.postedAt) {
      alert("元の投稿日時が不明なため実行できません");
      return;
    }
    const account = accountOf(draft.accountId);
    const origShifted = new Date(new Date(draft.postedAt).getTime() + 9 * 60 * 60 * 1000);
    const hour = origShifted.getUTCHours();
    const minute = origShifted.getUTCMinutes();
    const today = nowJstParts();
    const pad = (n: number) => String(n).padStart(2, "0");
    const localValue = `${today.year}-${pad(today.month)}-${pad(today.day)}T${pad(hour)}:${pad(minute)}`;
    if (!confirm(`${account?.displayName ?? ""}として、同じ内容を本日${pad(hour)}:${pad(minute)}に予約投稿します。よろしいですか?`)) return;
    try {
      const created = await api.drafts.create({ accountId: draft.accountId, text: draft.text, mediaUrls: draft.mediaUrls, source: "manual" });
      const scheduled = await api.drafts.schedule(created.id, jstLocalInputToIso(localValue));
      setDrafts((prev) => [scheduled, ...prev]);
      setTab("scheduled");
      alert("本日の同時刻に予約投稿として登録しました。");
    } catch (e) {
      alert(`予約投稿の作成に失敗しました: ${(e as Error).message}`);
    }
  };

  const saveAccount = async (v: { platform: "x" | "instagram"; displayName: string; handle: string }) => {
    const created = await api.accounts.create(v);
    setAccounts((prev) => [...prev, created]);
    setAccountEditorOpen(false);
  };

  const deleteAccount = async (a: Account) => {
    await api.accounts.remove(a.id);
    setAccounts((prev) => prev.filter((x) => x.id !== a.id));
  };

  const moveAccount = async (id: string, direction: "up" | "down") => {
    const index = accounts.findIndex((a) => a.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= accounts.length) return;
    const reordered = [...accounts];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setAccounts(reordered);
    try {
      const updated = await api.accounts.reorder(reordered.map((a) => a.id));
      setAccounts(updated);
    } catch (e) {
      alert(`並び替えに失敗しました: ${(e as Error).message}`);
      reloadAll();
    }
  };

  const adoptAIVariant = async ({ accountId, text }: { accountId: string; text: string }) => {
    const created = await api.drafts.create({ accountId, text, source: "ai" });
    setDrafts((prev) => [created, ...prev]);
    setAiOpen(false);
  };

  const tabs = [
    { id: "dashboard", label: "ダッシュボード", icon: TrendingUp },
    { id: "drafts", label: "下書き", icon: FileText },
    { id: "scheduled", label: "予約投稿", icon: Calendar },
    { id: "routines", label: "ルーティーン", icon: CalendarClock },
    { id: "posted", label: "投稿履歴", icon: CheckCircle2 },
    { id: "failed", label: "失敗", icon: AlertTriangle },
    { id: "templates", label: "テンプレート", icon: Layers },
    { id: "accounts", label: "アカウント", icon: Users },
    { id: "reports", label: "レポート履歴", icon: History },
  ];

  const AccountNav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="px-5 mb-6 flex items-center justify-between md:block">
        <div>
          <div className="text-[11px] tracking-widest uppercase" style={{ color: MUTED, fontFamily: monoFont }}>Post Binder</div>
          <div className="text-lg mt-1" style={{ color: PAPER, fontFamily: displayFont, letterSpacing: 0.5 }}>X運用管理</div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1" style={{ color: MUTED }}><X size={20} /></button>
      </div>
      <div className="mx-3 mb-2 text-[10px] tracking-widest uppercase md:hidden" style={{ color: MUTED, fontFamily: monoFont }}>メニュー</div>
      <div className="md:hidden mb-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); onNavigate?.(); }} className="flex items-center gap-2 mx-3 px-3 py-2.5 rounded text-sm mb-1 w-[calc(100%-1.5rem)]" style={{ background: active ? CARD : "transparent", color: active ? PAPER : MUTED }}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>
      <div className="mx-3 mb-2 border-t md:hidden" style={{ borderColor: HAIRLINE }} />
      <button onClick={() => { setActiveAccountId("all"); onNavigate?.(); }} className="flex items-center gap-2 mx-3 px-3 py-2.5 rounded text-sm mb-1" style={{ background: activeAccountId === "all" ? "rgba(203,162,78,0.12)" : "transparent", color: activeAccountId === "all" ? GOLD : MUTED }}>
        <Users size={15} /> すべてのアカウント
      </button>
      <div className="mx-3 my-2 text-[10px] tracking-widest uppercase" style={{ color: MUTED, fontFamily: monoFont }}>アカウント</div>
      {accounts.map((a) => (
        <button key={a.id} onClick={() => { setActiveAccountId(a.id); onNavigate?.(); }} className="flex flex-col items-start mx-3 px-3 py-2.5 rounded mb-1 text-left w-[calc(100%-1.5rem)]" style={{ background: activeAccountId === a.id ? "rgba(203,162,78,0.12)" : "transparent" }}>
          <span className="text-sm flex items-center gap-1.5" style={{ color: activeAccountId === a.id ? GOLD : PAPER }}>
            {a.displayName}
            {!a.connected && <span title="未連携" style={{ width: 6, height: 6, borderRadius: 999, background: RED, display: "inline-block" }} />}
          </span>
          <span className="text-[11px]" style={{ color: MUTED, fontFamily: monoFont }}>{a.handle}</span>
        </button>
      ))}
      <div className="mt-auto px-5 pt-4 text-[11px] leading-relaxed" style={{ color: MUTED, borderTop: `1px solid ${HAIRLINE}` }}>
        赤丸はプラットフォーム未連携のアカウント。「アカウント」タブから連携できます。
      </div>
    </>
  );

  if (!ready) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: INK }}>
        <Loader2 size={24} className="animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex" style={{ background: INK, fontFamily: bodyFont }}>
      <div className="hidden md:flex w-56 shrink-0 flex-col py-5" style={{ background: PANEL, borderRight: `1px solid ${HAIRLINE}` }}>
        <AccountNav />
      </div>
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[80vw] flex flex-col py-5 h-full" style={{ background: PANEL }}>
            <AccountNav onNavigate={() => setSidebarOpen(false)} />
          </div>
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 -ml-1.5 shrink-0" style={{ color: PAPER }}><Menu size={20} /></button>
            <span className="md:hidden text-sm truncate" style={{ color: PAPER, fontFamily: displayFont }}>
              {tabs.find((t) => t.id === tab)?.label}
            </span>
            <div className="hidden md:flex items-center gap-1 overflow-x-auto -mx-1 px-1 min-w-0" style={{ scrollbarWidth: "none" }}>
              {tabs.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button key={t.id} onClick={() => setTab(t.id)} className="flex items-center gap-1.5 px-3 py-2 rounded text-sm shrink-0" style={{ color: active ? PAPER : MUTED, background: active ? CARD : "transparent" }}>
                    <Icon size={14} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tab !== "dashboard" && tab !== "reports" && tab !== "accounts" && tab !== "routines" && accounts.length > 0 && (
              <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap" style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}>
                <Sparkles size={14} /> <span className="hidden xs:inline">AI生成</span>
              </button>
            )}
            {tab === "templates" && (
              <button onClick={() => { setEditingTemplate(null); setTemplateEditorOpen(true); }} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap" style={{ background: GOLD, color: INK }}>
                <Plus size={14} /> <span className="hidden xs:inline">新規テンプレート</span>
              </button>
            )}
            {tab === "accounts" && (
              <button onClick={() => setAccountEditorOpen(true)} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap" style={{ background: GOLD, color: INK }}>
                <Plus size={14} /> <span className="hidden xs:inline">アカウント追加</span>
              </button>
            )}
            {tab === "routines" && accounts.length > 0 && (
              <button onClick={() => { setEditingRoutine(null); setRoutineEditorOpen(true); }} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap" style={{ background: GOLD, color: INK }}>
                <Plus size={14} /> <span className="hidden xs:inline">新規ルーティーン</span>
              </button>
            )}
            {(tab === "drafts" || tab === "scheduled") && accounts.length > 0 && (
              <button onClick={() => { setEditingDraft(null); setEditorOpen(true); }} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap" style={{ background: GOLD, color: INK }}>
                <Plus size={14} /> <span className="hidden xs:inline">新規下書き</span>
              </button>
            )}
            {tab === "dashboard" && (
              <button onClick={generateDailyReport} disabled={reportLoading} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50" style={{ background: GOLD, color: INK }}>
                {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                <span className="hidden xs:inline">{reportLoading ? "生成中…" : "本日のレポートを更新"}</span>
              </button>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2 px-4 sm:px-6 py-2" style={{ borderBottom: `1px solid ${HAIRLINE}`, background: PANEL }}>
          <Users size={13} style={{ color: MUTED }} className="shrink-0" />
          <select
            value={activeAccountId}
            onChange={(e) => setActiveAccountId(e.target.value)}
            className="text-sm rounded px-2 py-1.5 max-w-full"
            style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
          >
            <option value="all">すべてのアカウント</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}{!a.connected ? "(未連携)" : ""}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loadError && (
            <div className="max-w-2xl mx-auto mb-4 p-3 rounded text-sm flex items-center gap-2" style={{ background: "rgba(201,106,90,0.12)", color: RED }}>
              <AlertTriangle size={14} /> {loadError}
            </div>
          )}

          {tab === "dashboard" ? (
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>
                  毎日11:00に自動更新(本番運用時)・{todayStr}
                  {activeAccountId === "all" && accounts.length > 0 && " ・全アカウント分をまとめて生成できます"}
                </span>
              </div>
              {reportError && <p className="text-sm" style={{ color: RED }}>{reportError}</p>}
              {activeAccountId !== "all" && accountAnalytics && (
                <AnalyticsSummary data={accountAnalytics} platform={accountOf(activeAccountId)?.platform ?? "x"} />
              )}
              {activeAccountId !== "all" ? (
                !latestReportForActiveAccount ? (
                  <FoilFrame holo>
                    <div className="p-6 flex flex-col items-center text-center gap-3">
                      <TrendingUp size={24} style={{ color: HOLO_A }} />
                      <p className="text-sm" style={{ color: MUTED }}>このアカウントのレポートはまだありません。ボタンから生成すると、直近の投稿と実測の指標をもとに振り返り・改善点・ネクストアクションをAIがまとめます。</p>
                      <button onClick={generateDailyReport} disabled={reportLoading} className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}>
                        {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {reportLoading ? "生成中…" : "レポートを生成"}
                      </button>
                    </div>
                  </FoilFrame>
                ) : (
                  <ReportCard report={latestReportForActiveAccount} />
                )
              ) : latestReportPerAccount.length === 0 ? (
                <FoilFrame holo>
                  <div className="p-6 flex flex-col items-center text-center gap-3">
                    <TrendingUp size={24} style={{ color: HOLO_A }} />
                    <p className="text-sm" style={{ color: MUTED }}>まだレポートがありません。ボタンを押すと全アカウント分をまとめて生成します。</p>
                    <button onClick={generateDailyReport} disabled={reportLoading || accounts.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}>
                      {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {reportLoading ? "生成中…" : "全アカウント分を生成"}
                    </button>
                  </div>
                </FoilFrame>
              ) : (
                latestReportPerAccount.map(({ account, report }) => <ReportCard key={account.id} report={report} />)
              )}
            </div>
          ) : tab === "reports" ? (
            (() => {
              const visibleReports = activeAccountId === "all" ? sortedReports : sortedReports.filter((r) => r.accountId === activeAccountId);
              const pageSize = 10;
              const totalPages = Math.max(1, Math.ceil(visibleReports.length / pageSize));
              const page = Math.min(reportsPage, totalPages - 1);
              const paged = visibleReports.slice(page * pageSize, page * pageSize + pageSize);
              return visibleReports.length === 0 ? (
                <EmptyState text="過去のレポートはまだありません。ダッシュボードでレポートを生成すると、ここに履歴が溜まっていきます。" />
              ) : (
                <div className="max-w-2xl mx-auto flex flex-col gap-3">
                  {paged.map((r) => (
                    <ReportAccordionItem
                      key={r.id}
                      report={r}
                      open={expandedReportId === r.id}
                      onToggle={() => setExpandedReportId((prev) => (prev === r.id ? null : r.id))}
                    />
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <button onClick={() => setReportsPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded text-xs disabled:opacity-30" style={{ color: MUTED, border: `1px solid ${HAIRLINE}` }}>前へ</button>
                      <span className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>{page + 1} / {totalPages}</span>
                      <button onClick={() => setReportsPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded text-xs disabled:opacity-30" style={{ color: MUTED, border: `1px solid ${HAIRLINE}` }}>次へ</button>
                    </div>
                  )}
                </div>
              );
            })()
          ) : tab === "templates" ? (
            templates.length === 0 ? (
              <EmptyState text="テンプレートはまだありません。よく使う投稿文の型を登録しておくと、下書き作成が速くなります。" />
            ) : (() => {
              const q = templateSearch.trim().toLowerCase();
              const matchesSearch = (t: Template) =>
                !q || t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);

              const sharedTemplates = templates.filter((t) => t.accountId === null && matchesSearch(t));
              const scopedTemplates = (activeAccountId === "all"
                ? templates.filter((t) => t.accountId !== null)
                : templates.filter((t) => t.accountId === activeAccountId)
              ).filter(matchesSearch);

              const renderCard = (t: Template) => (
                <FoilFrame key={t.id}>
                  <div className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium" style={{ color: PAPER, fontFamily: displayFont }}>{t.title}</span>
                      <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded" style={{ color: MUTED, fontFamily: monoFont, border: `1px solid ${HAIRLINE}` }}>
                        {t.accountId ? accountOf(t.accountId)?.displayName ?? "?" : "共通"}
                      </span>
                    </div>
                    <p className="text-xs whitespace-pre-wrap flex-1" style={{ color: MUTED }}>{t.body}</p>
                    {t.mediaUrls.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap">
                        {t.mediaUrls.map((url) => (
                          <MediaThumb key={url} url={url} />
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => createDraftFromTemplate(t)}
                      disabled={accounts.length === 0}
                      className="flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium disabled:opacity-40"
                      style={{ background: GOLD, color: INK }}
                    >
                      <FileText size={13} /> この内容で下書き作成
                    </button>
                    <div className="flex justify-end gap-1 pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                      <button onClick={() => { setEditingTemplate(t); setTemplateEditorOpen(true); }} className="p-1.5 rounded" style={{ color: MUTED }}><Pencil size={14} /></button>
                      <button onClick={() => deleteTemplate(t)} className="p-1.5 rounded" style={{ color: RED }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </FoilFrame>
              );

              return (
                <div className="flex flex-col gap-6">
                  <div className="relative max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
                    <input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder="テンプレートを検索(名前・本文)"
                      className="w-full rounded pl-8 pr-3 py-2 text-sm"
                      style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
                    />
                  </div>
                  {sharedTemplates.length === 0 && scopedTemplates.length === 0 && q ? (
                    <p className="text-xs" style={{ color: MUTED }}>「{templateSearch}」に一致するテンプレートは見つかりませんでした。</p>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs uppercase tracking-wide mb-2" style={{ color: MUTED, fontFamily: monoFont }}>共通テンプレート</div>
                        {sharedTemplates.length === 0 ? (
                          <p className="text-xs" style={{ color: MUTED }}>{q ? "一致するテンプレートはありません。" : "まだありません。"}</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{sharedTemplates.map(renderCard)}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide mb-2" style={{ color: MUTED, fontFamily: monoFont }}>
                          {activeAccountId === "all" ? "アカウント専用テンプレート" : `${accountOf(activeAccountId)?.displayName ?? ""}専用テンプレート`}
                        </div>
                        {scopedTemplates.length === 0 ? (
                          <p className="text-xs" style={{ color: MUTED }}>{q ? "一致するテンプレートはありません。" : "まだありません。"}</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{scopedTemplates.map(renderCard)}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()
          ) : tab === "routines" ? (
            routines.length === 0 ? (
              <EmptyState text="ルーティーンはまだありません。「新規ルーティーン」から、毎週・毎日の定期投稿を設定できます。" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {routines.map((r) => {
                  const scheduleLabel = r.frequency === "daily"
                    ? `毎日 ${pad2(r.hour)}:${pad2(r.minute)}`
                    : `毎週 ${r.daysOfWeek.map((d) => WEEKDAY_LABELS[d]).join("・")} ${pad2(r.hour)}:${pad2(r.minute)}`;
                  return (
                    <FoilFrame key={r.id} holo>
                      <div className="p-4 flex flex-col gap-3 h-full">
                        <div className="flex items-center justify-between gap-2">
                          <span style={{ fontFamily: monoFont, fontSize: 11, color: MUTED }}>{accountOf(r.accountId)?.handle ?? "未割当"}</span>
                          <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded flex items-center gap-1" style={{ color: r.active ? GREEN : MUTED, fontFamily: monoFont, border: `1px solid ${HAIRLINE}` }}>
                            <CalendarClock size={10} /> {r.active ? "有効" : "停止中"}
                          </span>
                        </div>
                        <div className="text-sm" style={{ color: GOLD, fontFamily: monoFont }}>{scheduleLabel}</div>
                        <p className="text-xs whitespace-pre-wrap flex-1" style={{ color: MUTED }}>{r.text}</p>
                        {r.mediaUrls.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {r.mediaUrls.map((url) => <MediaThumb key={url} url={url} />)}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                          <button onClick={() => toggleRoutineActive(r)} title={r.active ? "一時停止する" : "再開する"} className="p-1.5 rounded hover:opacity-80 transition" style={{ color: r.active ? GREEN : MUTED }}>
                            <Power size={14} />
                          </button>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingRoutine(r); setRoutineEditorOpen(true); }} className="p-1.5 rounded" style={{ color: MUTED }}><Pencil size={14} /></button>
                            <button onClick={() => deleteRoutine(r)} className="p-1.5 rounded" style={{ color: RED }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    </FoilFrame>
                  );
                })}
              </div>
            )
          ) : tab === "accounts" ? (
            accounts.length === 0 ? (
              <EmptyState text="アカウントがまだ登録されていません。右上の「アカウント追加」から登録しましょう。" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {accounts.map((a) => (
                  <FoilFrame key={a.id}>
                    <div className="p-4 flex flex-col gap-3 h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: PAPER, fontFamily: displayFont }}>{a.displayName}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded" style={{ color: MUTED, fontFamily: monoFont, border: `1px solid ${HAIRLINE}` }}>{a.platform}</span>
                      </div>
                      <span className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>{a.handle}</span>
                      <div className="flex items-center gap-1.5 text-xs" style={{ color: a.connected ? GREEN : RED }}>
                        <Link2 size={12} /> {a.connected ? "連携済み" : "未連携"}
                      </div>
                      <a
                        href={`/api/accounts/${a.platform}/oauth/start`}
                        className="text-xs px-3 py-1.5 rounded text-center"
                        style={a.connected ? { color: MUTED, border: `1px solid ${HAIRLINE}` } : { background: GOLD, color: INK }}
                      >
                        {a.connected
                          ? "再連携する(権限更新など)"
                          : a.platform === "x" ? "Xと連携する" : "Instagramと連携する"}
                      </a>
                      <div className="flex items-center justify-between pt-2 mt-auto" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveAccount(a.id, "up")} disabled={accounts[0]?.id === a.id} className="p-1.5 rounded disabled:opacity-30" style={{ color: MUTED }}><ChevronUp size={14} /></button>
                          <button onClick={() => moveAccount(a.id, "down")} disabled={accounts[accounts.length - 1]?.id === a.id} className="p-1.5 rounded disabled:opacity-30" style={{ color: MUTED }}><ChevronDown size={14} /></button>
                        </div>
                        <button onClick={() => deleteAccount(a)} className="p-1.5 rounded" style={{ color: RED }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </FoilFrame>
                ))}
              </div>
            )
          ) : tab === "posted" ? (
            visibleDrafts.length === 0 ? (
              <EmptyState text="投稿済みの投稿はまだありません。「今すぐ投稿」や予約投稿が実行されるとここに履歴が残ります。" />
            ) : (() => {
              const dayColumns = [
                { offset: 0, label: "本日" },
                { offset: 1, label: "昨日" },
                { offset: 2, label: "一昨日" },
              ].map(({ offset, label }) => {
                const d = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
                const key = d.toLocaleDateString("sv-SE", { timeZone: JST_TIMEZONE });
                const dateLabel = d.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", timeZone: JST_TIMEZONE });
                return { key, label, dateLabel };
              });

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {dayColumns.map((col) => {
                    const items = visibleDrafts.filter(
                      (d) => d.postedAt && new Date(d.postedAt).toLocaleDateString("sv-SE", { timeZone: JST_TIMEZONE }) === col.key,
                    );
                    return (
                      <div key={col.key} className="flex flex-col gap-2 min-w-0">
                        <div className="text-xs uppercase tracking-wide flex items-center gap-1.5" style={{ color: MUTED, fontFamily: monoFont }}>
                          {col.label} <span style={{ color: HAIRLINE }}>|</span> {col.dateLabel} <span style={{ color: HAIRLINE }}>|</span> {items.length}件
                        </div>
                        {items.length === 0 ? (
                          <p className="text-xs" style={{ color: MUTED }}>投稿なし</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {items.map((d) => (
                              <PostedAccordionItem
                                key={d.id}
                                draft={d}
                                account={accountOf(d.accountId)}
                                open={expandedPostedId === d.id}
                                onToggle={() => setExpandedPostedId((prev) => (prev === d.id ? null : d.id))}
                                onEdit={(dd) => { setEditingDraft(dd); setEditorOpen(true); }}
                                onDelete={deleteDraft}
                                onTogglePosted={togglePosted}
                                onRepost={repostDraft}
                                onSaveAsTemplate={saveTextAsTemplate}
                                onCreateDraft={createDraftFromPost}
                                onRepostSameTime={repostSameTimeToday}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : visibleDrafts.length === 0 ? (
            <EmptyState text={
              tab === "scheduled" ? "予約中の投稿はありません。下書きから時計アイコンで日時を設定できます。"
                : tab === "failed" ? "失敗した投稿はありません。"
                : accounts.length === 0 ? "先に「アカウント」タブでアカウントを登録してください。"
                : "下書きはまだありません。右上の「新規下書き」か「AI生成」から作成しましょう。"
            } />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleDrafts.map((d) => (
                <DraftCard
                  key={d.id}
                  draft={d}
                  account={accountOf(d.accountId)}
                  onEdit={(dd) => { setEditingDraft(dd); setEditorOpen(true); }}
                  onDelete={deleteDraft}
                  onSchedule={(dd) => setScheduleTarget(dd)}
                  onTogglePosted={togglePosted}
                  onPostNow={postNow}
                  onRepost={repostDraft}
                  onSaveAsTemplate={saveTextAsTemplate}
                  posting={postingIds.has(d.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <DraftEditorModal
        open={editorOpen}
        draft={editingDraft}
        accounts={accounts}
        templates={templates}
        drafts={drafts}
        initialText={draftInitialText}
        initialMediaUrls={draftInitialMediaUrls}
        defaultAccountId={draftInitialAccountId ?? (activeAccountId === "all" ? undefined : activeAccountId)}
        onClose={() => { setEditorOpen(false); setEditingDraft(null); setDraftInitialText(undefined); setDraftInitialMediaUrls(undefined); setDraftInitialAccountId(undefined); }}
        onSave={saveDraft}
        onSaveAsTemplate={saveTextAsTemplate}
      />
      <ScheduleModal open={!!scheduleTarget} draft={scheduleTarget} onClose={() => setScheduleTarget(null)} onConfirm={confirmSchedule} />
      <TemplateEditorModal
        open={templateEditorOpen}
        template={editingTemplate}
        accounts={accounts}
        defaultAccountId={activeAccountId === "all" ? null : activeAccountId}
        onClose={() => { setTemplateEditorOpen(false); setEditingTemplate(null); }}
        onSave={saveTemplate}
      />
      <AccountEditorModal open={accountEditorOpen} onClose={() => setAccountEditorOpen(false)} onSave={saveAccount} />
      <AIGenerateModal open={aiOpen} accounts={accounts} defaultAccountId={activeAccountId === "all" ? accounts[0]?.id : activeAccountId} onClose={() => setAiOpen(false)} onAdopt={adoptAIVariant} />
      <RoutineEditorModal
        open={routineEditorOpen}
        routine={editingRoutine}
        accounts={accounts}
        defaultAccountId={activeAccountId === "all" ? (accounts[0]?.id ?? "") : activeAccountId}
        onClose={() => { setRoutineEditorOpen(false); setEditingRoutine(null); }}
        onSave={saveRoutine}
      />
    </div>
  );
}

function ReportCard({ report }: { report: DailyReport }) {
  return (
    <FoilFrame holo>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} style={{ color: HOLO_A }} />
            <span style={{ fontFamily: monoFont, fontSize: 12, color: MUTED }}>{formatDate(report.reportDate)} のデイリーレポート</span>
          </div>
          {report.account && (
            <span className="text-xs" style={{ color: PAPER, fontFamily: displayFont }}>{report.account.displayName}</span>
          )}
        </div>
        <ReportSection label="直近の振り返り" text={report.reviewText} />
        <ReportSection label="改善点" text={report.improvementsText} />
        <ReportSection label="ネクストアクション" text={report.nextActionsText} />
      </div>
    </FoilFrame>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded p-2.5 text-center" style={{ background: CARD, border: `1px solid ${HAIRLINE}` }}>
      <div className="text-lg" style={{ color: PAPER, fontFamily: displayFont }}>{value.toLocaleString()}</div>
      <div className="text-[10px]" style={{ color: MUTED, fontFamily: monoFont }}>{label}</div>
    </div>
  );
}

function AnalyticsSummary({ data, platform }: { data: AccountAnalytics; platform: Account["platform"] }) {
  const am = data.accountMetric;
  return (
    <FoilFrame>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} style={{ color: HOLO_A }} />
            <span className="text-xs uppercase tracking-wide" style={{ color: MUTED, fontFamily: monoFont }}>アナリティクス</span>
          </div>
          {am && (
            <span className="text-[10px]" style={{ color: MUTED, fontFamily: monoFont }}>
              最終更新: {formatDateTime(am.capturedAt)}
            </span>
          )}
        </div>
        {!am ? (
          <p className="text-xs" style={{ color: MUTED }}>まだ指標データがありません。「レポートを生成」を押すと最新の指標を取得します。</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="フォロワー数" value={am.followersCount} />
            {platform === "instagram" ? (
              <>
                <StatTile label="リーチ" value={am.reach} />
                <StatTile label="プロフィール閲覧" value={am.profileViews} />
              </>
            ) : (
              <>
                <StatTile label="投稿数(指標あり)" value={data.postMetrics.length} />
                <StatTile
                  label="合計インプレッション"
                  value={data.postMetrics.reduce((sum, m) => sum + m.impressions, 0)}
                />
              </>
            )}
          </div>
        )}
        {data.postMetrics.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            {data.postMetrics.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate" style={{ color: PAPER }}>{m.text ? m.text.slice(0, 30) : "(本文不明)"}</span>
                <span className="shrink-0" style={{ color: MUTED, fontFamily: monoFont }}>
                  ❤{m.likes} 🔁{m.reposts} 💬{m.replies} 👁{m.impressions}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </FoilFrame>
  );
}

function ReportAccordionItem({ report, open, onToggle }: { report: DailyReport; open: boolean; onToggle: () => void }) {
  return (
    <FoilFrame holo>
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp size={15} style={{ color: HOLO_A }} className="shrink-0" />
          <span className="truncate" style={{ fontFamily: monoFont, fontSize: 12, color: MUTED }}>{formatDate(report.reportDate)}</span>
          {report.account && (
            <span className="truncate text-xs" style={{ color: PAPER, fontFamily: displayFont }}>{report.account.displayName}</span>
          )}
        </div>
        <ChevronDown size={16} className="shrink-0" style={{ color: MUTED, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4">
          <ReportSection label="直近の振り返り" text={report.reviewText} />
          <ReportSection label="改善点" text={report.improvementsText} />
          <ReportSection label="ネクストアクション" text={report.nextActionsText} />
        </div>
      )}
    </FoilFrame>
  );
}

function ReportSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <ChevronRight size={12} style={{ color: GOLD }} />
        <span className="text-xs uppercase tracking-wide" style={{ color: GOLD, fontFamily: monoFont }}>{label}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: PAPER, fontFamily: bodyFont }}>
        {text || <span style={{ color: MUTED }}>内容なし</span>}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <LayoutGrid size={28} style={{ color: HAIRLINE }} />
      <p className="text-sm max-w-sm" style={{ color: MUTED }}>{text}</p>
    </div>
  );
}
