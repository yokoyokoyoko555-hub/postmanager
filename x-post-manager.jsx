import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Calendar, FileText, Plus, Trash2, Pencil, Clock,
  LayoutGrid, X, Check, ChevronDown, Loader2, Users, Layers,
  PackageCheck, Megaphone, Gem, Menu, TrendingUp, History, RefreshCw,
  ChevronRight
} from "lucide-react";

/* ---------------------------------------------------------
   トークン: トレカ鑑定スラブ ✕ ディスプレイケースの世界観
   背景 = ショーケースの黒、フォイルゴールド = 予約(狙い玉)、
   ホロ(藍〜青緑) = AI生成(レアパック演出)
--------------------------------------------------------- */
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

const SEED_ACCOUNTS = [
  { id: "acc_1", name: "秋葉原本店", handle: "@cardshop_akb" },
  { id: "acc_2", name: "大阪日本橋店", handle: "@cardshop_osk" },
];

const SEED_TEMPLATES = [
  {
    id: "tpl_1",
    title: "新入荷速報",
    body: "【新入荷】{商品名} 本日入荷しました📦\n数量限定につきお早めに！店頭・通販どちらもご購入いただけます🔥\n▼通販はこちら\n{URL}",
  },
  {
    id: "tpl_2",
    title: "セール告知",
    body: "【期間限定セール】{セール内容}\n{期間}まで開催中です⏰ お見逃しなく！\n▼詳細・通販はこちら\n{URL}",
  },
];

const SEED_DRAFTS = [
  {
    id: "d_1",
    accountId: "acc_1",
    text: "【新入荷】最新弾シングルカード、本日より店頭・通販にて販売開始📦\n人気カードは即完売の可能性ありです、お早めに🔥",
    status: "draft",
    scheduledAt: null,
    source: "manual",
    createdAt: Date.now() - 86400000,
  },
];

const TONE_OPTIONS = [
  { id: "hype", label: "煽り系", icon: Megaphone },
  { id: "info", label: "情報系", icon: FileText },
  { id: "sale", label: "セール告知", icon: Gem },
  { id: "unbox", label: "開封速報", icon: PackageCheck },
];

async function storageGet(key) {
  try {
    const res = await window.storage.get(key);
    return res ? JSON.parse(res.value) : null;
  } catch (e) {
    return null;
  }
}
async function storageSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage set failed", key, e);
  }
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------------------------------------------------------
   汎用パーツ
--------------------------------------------------------- */
function StatusPill({ status, scheduledAt }) {
  const map = {
    draft: { label: "DRAFT", color: MUTED, bg: "rgba(139,141,155,0.12)" },
    scheduled: { label: `予約 ${formatDateTime(scheduledAt)}`, color: GOLD, bg: "rgba(203,162,78,0.14)" },
    posted: { label: "POSTED", color: GREEN, bg: "rgba(95,174,123,0.14)" },
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

function FoilFrame({ children, holo = false }) {
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

/* ---------------------------------------------------------
   下書きカード
--------------------------------------------------------- */
function DraftCard({ draft, account, onEdit, onDelete, onSchedule, onTogglePosted }) {
  return (
    <FoilFrame holo={draft.source === "ai"}>
      <div className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: monoFont, fontSize: 11, color: MUTED }}>
            {account ? account.handle : "未割当"}
          </span>
          <StatusPill status={draft.status} scheduledAt={draft.scheduledAt} />
        </div>
        <p
          className="text-sm leading-relaxed whitespace-pre-wrap flex-1"
          style={{ color: PAPER, fontFamily: bodyFont, minHeight: 60 }}
        >
          {draft.text || <span style={{ color: MUTED }}>本文なし</span>}
        </p>
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <span style={{ fontFamily: monoFont, fontSize: 10, color: MUTED }}>
            No. {draft.id.slice(-6).toUpperCase()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSchedule(draft)}
              title="予約日時を設定"
              className="p-1.5 rounded hover:opacity-80 transition"
              style={{ color: GOLD }}
            >
              <Clock size={15} />
            </button>
            <button
              onClick={() => onEdit(draft)}
              title="編集"
              className="p-1.5 rounded hover:opacity-80 transition"
              style={{ color: MUTED }}
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => onTogglePosted(draft)}
              title="投稿済みにする(記録用)"
              className="p-1.5 rounded hover:opacity-80 transition"
              style={{ color: draft.status === "posted" ? GREEN : MUTED }}
            >
              <Check size={15} />
            </button>
            <button
              onClick={() => onDelete(draft)}
              title="削除"
              className="p-1.5 rounded hover:opacity-80 transition"
              style={{ color: "#C96A5A" }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    </FoilFrame>
  );
}

/* ---------------------------------------------------------
   下書き編集モーダル
--------------------------------------------------------- */
function DraftEditorModal({ open, onClose, onSave, draft, accounts, templates }) {
  const [accountId, setAccountId] = useState(draft?.accountId || accounts[0]?.id || "");
  const [text, setText] = useState(draft?.text || "");
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    setAccountId(draft?.accountId || accounts[0]?.id || "");
    setText(draft?.text || "");
    setTemplateId("");
  }, [draft, open]);

  if (!open) return null;

  const applyTemplate = (id) => {
    setTemplateId(id);
    const t = templates.find((t) => t.id === id);
    if (t) setText(t.body);
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
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full mt-1 rounded px-3 py-2 text-sm"
              style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.handle})</option>
              ))}
            </select>
          </div>
          {templates.length > 0 && (
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>テンプレートから作成(任意)</label>
              <select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full mt-1 rounded px-3 py-2 text-sm"
                style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
              >
                <option value="">選択しない</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>本文</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed"
              style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }}
              placeholder="投稿文を入力…"
            />
            <div className="text-right text-[11px] mt-1" style={{ color: text.length > 280 ? "#C96A5A" : MUTED, fontFamily: monoFont }}>
              {text.length} / 280
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button
            onClick={() => { if (text.trim()) onSave({ accountId, text }); }}
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

/* ---------------------------------------------------------
   予約日時モーダル
--------------------------------------------------------- */
function ScheduleModal({ open, onClose, onConfirm, draft }) {
  const [dt, setDt] = useState("");
  useEffect(() => { setDt(""); }, [draft, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: PANEL, border: `1px solid ${HAIRLINE}` }}>
        <h3 style={{ fontFamily: displayFont, color: PAPER }} className="text-base uppercase mb-4">投稿予約日時</h3>
        <input
          type="datetime-local"
          value={dt}
          onChange={(e) => setDt(e.target.value)}
          className="w-full rounded px-3 py-2 text-sm mb-4"
          style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button
            onClick={() => { if (dt) onConfirm(new Date(dt).toISOString()); }}
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ background: GOLD, color: INK }}
          >
            予約する
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   テンプレート編集モーダル
--------------------------------------------------------- */
function TemplateEditorModal({ open, onClose, onSave, template }) {
  const [title, setTitle] = useState(template?.title || "");
  const [body, setBody] = useState(template?.body || "");
  useEffect(() => {
    setTitle(template?.title || "");
    setBody(template?.body || "");
  }, [template, open]);
  if (!open) return null;
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
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 rounded px-3 py-2 text-sm"
              style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
              placeholder="例: 新入荷速報"
            />
          </div>
          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>
              本文 <span style={{ color: HOLO_A }}>{"{商品名}"} {"{URL}"} のように差し替え箇所を波括弧で書けます</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed"
              style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: MUTED }}>キャンセル</button>
          <button
            onClick={() => { if (title.trim() && body.trim()) onSave({ title, body }); }}
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

/* ---------------------------------------------------------
   AI生成モーダル
--------------------------------------------------------- */
function AIGenerateModal({ open, onClose, accounts, defaultAccountId, onAdopt }) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [input, setInput] = useState("");
  const [tone, setTone] = useState("hype");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    if (open) {
      setAccountId(defaultAccountId);
      setInput("");
      setVariants([]);
      setError("");
    }
  }, [open, defaultAccountId]);

  if (!open) return null;

  const account = accounts.find((a) => a.id === accountId);
  const toneLabel = TONE_OPTIONS.find((t) => t.id === tone)?.label || "";

  const generate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    setVariants([]);
    try {
      const prompt = `あなたはトレーディングカードショップのSNS運用担当者です。以下の情報をもとに、X(旧Twitter)向けの投稿文案を3パターン作成してください。

【店舗アカウント】
${account ? `${account.name} (${account.handle})` : "未指定"}

【投稿の元情報】
${input}

【希望トーン】
${toneLabel}

【条件】
・140字前後、長くても280字以内
・トレーディングカードショップの来店・通販利用の後押しを意識する
・絵文字は適度に(使いすぎない)
・ハッシュタグは0〜2個
・3パターンはそれぞれ違う切り口にする

出力は次のJSON形式のみを返してください。前置きや説明、コードブロック記法は一切不要です:
[{"label":"パターンの特徴を5文字程度で","text":"投稿文そのもの"}]`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const textBlock = (data.content || []).find((c) => c.type === "text");
      const raw = textBlock ? textBlock.text : "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
      setVariants(parsed);
    } catch (e) {
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
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full mt-1 rounded px-3 py-2 text-sm"
                style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}` }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.handle})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>トーン</label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {TONE_OPTIONS.map((t) => {
                  const Icon = t.icon;
                  const active = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className="flex items-center gap-1.5 px-2 py-2 rounded text-xs"
                      style={{
                        background: active ? "rgba(203,162,78,0.15)" : CARD,
                        color: active ? GOLD : MUTED,
                        border: `1px solid ${active ? GOLD_SOFT : HAIRLINE}`,
                      }}
                    >
                      <Icon size={12} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>投稿のもとになる情報</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              placeholder="例: ○○弾のシングルカードが本日入荷。人気カード多数、通販は明日10時から受付開始。"
              className="w-full mt-1 rounded px-3 py-2 text-sm leading-relaxed"
              style={{ background: CARD, color: PAPER, border: `1px solid ${HAIRLINE}`, fontFamily: bodyFont }}
            />
          </div>

          <button
            onClick={generate}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center gap-2 py-2.5 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "生成中…" : "3パターン生成する"}
          </button>

          {error && <p className="text-sm" style={{ color: "#C96A5A" }}>{error}</p>}

          {variants.length > 0 && (
            <div className="flex flex-col gap-3 pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              {variants.map((v, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: CARD, border: `1px solid ${HAIRLINE}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontFamily: monoFont, fontSize: 11, color: HOLO_A }}>{v.label || `パターン${i + 1}`}</span>
                    <button
                      onClick={() => onAdopt({ accountId, text: v.text })}
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: GOLD, color: INK }}
                    >
                      下書きに採用
                    </button>
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

/* ---------------------------------------------------------
   メイン
--------------------------------------------------------- */
export default function XPostManager() {
  useFonts();

  const [accounts] = useState(SEED_ACCOUNTS);
  const [activeAccountId, setActiveAccountId] = useState("all");
  const [templates, setTemplates] = useState(SEED_TEMPLATES);
  const [drafts, setDrafts] = useState(SEED_DRAFTS);
  const [reports, setReports] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [ready, setReady] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, d, r] = await Promise.all([
        storageGet("xpm:templates"),
        storageGet("xpm:drafts"),
        storageGet("xpm:reports"),
      ]);
      if (t) setTemplates(t);
      if (d) setDrafts(d);
      if (r) setReports(r);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) storageSet("xpm:templates", templates); }, [templates, ready]);
  useEffect(() => { if (ready) storageSet("xpm:drafts", drafts); }, [drafts, ready]);
  useEffect(() => { if (ready) storageSet("xpm:reports", reports); }, [reports, ready]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const latestReport = reports[0] || null;

  const generateDailyReport = async () => {
    setReportLoading(true);
    setReportError("");
    try {
      const postedDrafts = drafts.filter((d) => d.status === "posted" || d.status === "scheduled").slice(0, 8);
      const contextLines = postedDrafts.length
        ? postedDrafts.map((d) => `- [${accountOf(d.accountId)?.handle || "unknown"}] ${d.text.slice(0, 60)}`).join("\n")
        : "（前日の投稿記録なし）";

      const prompt = `あなたはトレーディングカードショップのSNS運用アドバイザーです。以下は前日投稿された(または予約されている)投稿の一部です。これをもとに、実運用を想定したデイリーレポートを作成してください。実際のいいね数などの数値データが無い場合は、投稿内容の質から一般的に読み取れる傾向として記述してください。

【前日の投稿】
${contextLines}

出力は次のJSON形式のみを返してください。前置き・コードブロック記法は不要です:
{"review":"前日の振り返り(3〜4文)","improvements":"改善点(3〜4文)","next_actions":"ネクストアクション(3〜4文、箇条書き調でも可)"}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const textBlock = (data.content || []).find((c) => c.type === "text");
      const raw = textBlock ? textBlock.text : "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const newReport = {
        id: uid("rpt"),
        date: todayStr,
        review: parsed.review || "",
        improvements: parsed.improvements || "",
        nextActions: parsed.next_actions || "",
        createdAt: Date.now(),
      };
      setReports((prev) => [newReport, ...prev.filter((r) => r.date !== todayStr)]);
    } catch (e) {
      setReportError("レポート生成に失敗しました。もう一度お試しください。");
    } finally {
      setReportLoading(false);
    }
  };

  const visibleDrafts = drafts.filter((d) => {
    if (activeAccountId !== "all" && d.accountId !== activeAccountId) return false;
    if (tab === "drafts") return d.status === "draft";
    if (tab === "scheduled") return d.status === "scheduled";
    return true;
  }).sort((a, b) => {
    if (tab === "scheduled") return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    return b.createdAt - a.createdAt;
  });

  const accountOf = (id) => accounts.find((a) => a.id === id);

  const saveDraft = ({ accountId, text }) => {
    if (editingDraft) {
      setDrafts((prev) => prev.map((d) => (d.id === editingDraft.id ? { ...d, accountId, text } : d)));
    } else {
      setDrafts((prev) => [
        { id: uid("d"), accountId, text, status: "draft", scheduledAt: null, source: "manual", createdAt: Date.now() },
        ...prev,
      ]);
    }
    setEditorOpen(false);
    setEditingDraft(null);
  };

  const deleteDraft = (draft) => setDrafts((prev) => prev.filter((d) => d.id !== draft.id));

  const togglePosted = (draft) =>
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, status: d.status === "posted" ? "draft" : "posted" } : d)));

  const confirmSchedule = (iso) => {
    setDrafts((prev) => prev.map((d) => (d.id === scheduleTarget.id ? { ...d, status: "scheduled", scheduledAt: iso } : d)));
    setScheduleTarget(null);
  };

  const saveTemplate = ({ title, body }) => {
    if (editingTemplate) {
      setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? { ...t, title, body } : t)));
    } else {
      setTemplates((prev) => [{ id: uid("tpl"), title, body }, ...prev]);
    }
    setTemplateEditorOpen(false);
    setEditingTemplate(null);
  };

  const deleteTemplate = (t) => setTemplates((prev) => prev.filter((x) => x.id !== t.id));

  const adoptAIVariant = ({ accountId, text }) => {
    setDrafts((prev) => [
      { id: uid("d"), accountId, text, status: "draft", scheduledAt: null, source: "ai", createdAt: Date.now() },
      ...prev,
    ]);
    setAiOpen(false);
  };

  const tabs = [
    { id: "dashboard", label: "ダッシュボード", icon: TrendingUp },
    { id: "drafts", label: "下書き", icon: FileText },
    { id: "scheduled", label: "予約投稿", icon: Calendar },
    { id: "templates", label: "テンプレート", icon: Layers },
    { id: "reports", label: "レポート履歴", icon: History },
  ];

  const AccountNav = ({ onNavigate }) => (
    <>
      <div className="px-5 mb-6 flex items-center justify-between md:block">
        <div>
          <div className="text-[11px] tracking-widest uppercase" style={{ color: MUTED, fontFamily: monoFont }}>Post Binder</div>
          <div className="text-lg mt-1" style={{ color: PAPER, fontFamily: displayFont, letterSpacing: 0.5 }}>X運用管理</div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1" style={{ color: MUTED }}>
          <X size={20} />
        </button>
      </div>

      <button
        onClick={() => { setActiveAccountId("all"); onNavigate && onNavigate(); }}
        className="flex items-center gap-2 mx-3 px-3 py-2.5 rounded text-sm mb-1"
        style={{
          background: activeAccountId === "all" ? "rgba(203,162,78,0.12)" : "transparent",
          color: activeAccountId === "all" ? GOLD : MUTED,
        }}
      >
        <Users size={15} /> すべてのアカウント
      </button>

      <div className="mx-3 my-2 text-[10px] tracking-widest uppercase" style={{ color: MUTED, fontFamily: monoFont }}>アカウント</div>
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => { setActiveAccountId(a.id); onNavigate && onNavigate(); }}
          className="flex flex-col items-start mx-3 px-3 py-2.5 rounded mb-1 text-left w-[calc(100%-1.5rem)]"
          style={{
            background: activeAccountId === a.id ? "rgba(203,162,78,0.12)" : "transparent",
          }}
        >
          <span className="text-sm" style={{ color: activeAccountId === a.id ? GOLD : PAPER }}>{a.name}</span>
          <span className="text-[11px]" style={{ color: MUTED, fontFamily: monoFont }}>{a.handle}</span>
        </button>
      ))}

      <div className="mt-auto px-5 pt-4 text-[11px] leading-relaxed" style={{ color: MUTED, borderTop: `1px solid ${HAIRLINE}` }}>
        実投稿・自動予約実行にはXのAPI連携が別途必要です。現状はUIプロトタイプです。
      </div>
    </>
  );

  const activeAccountLabel =
    activeAccountId === "all" ? "すべてのアカウント" : accountOf(activeAccountId)?.name || "";

  return (
    <div className="min-h-screen w-full flex" style={{ background: INK, fontFamily: bodyFont }}>
      {/* サイドバー: デスクトップは常時表示 */}
      <div className="hidden md:flex w-56 shrink-0 flex-col py-5" style={{ background: PANEL, borderRight: `1px solid ${HAIRLINE}` }}>
        <AccountNav />
      </div>

      {/* サイドバー: モバイルはドロワー */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[80vw] flex flex-col py-5 h-full" style={{ background: PANEL }}>
            <AccountNav onNavigate={() => setSidebarOpen(false)} />
          </div>
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* メイン */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-col gap-3 px-4 sm:px-6 py-4 sm:py-5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 -ml-1.5 shrink-0" style={{ color: PAPER }}>
                <Menu size={20} />
              </button>
              <span className="md:hidden text-sm truncate" style={{ color: PAPER, fontFamily: displayFont }}>{activeAccountLabel}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tab !== "dashboard" && tab !== "reports" && (
                <button
                  onClick={() => setAiOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap"
                  style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}
                >
                  <Sparkles size={14} /> <span className="hidden xs:inline">AI生成</span>
                </button>
              )}
              {tab === "templates" && (
                <button
                  onClick={() => { setEditingTemplate(null); setTemplateEditorOpen(true); }}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap"
                  style={{ background: GOLD, color: INK }}
                >
                  <Plus size={14} /> <span className="hidden xs:inline">新規テンプレート</span>
                </button>
              )}
              {(tab === "drafts" || tab === "scheduled") && (
                <button
                  onClick={() => { setEditingDraft(null); setEditorOpen(true); }}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap"
                  style={{ background: GOLD, color: INK }}
                >
                  <Plus size={14} /> <span className="hidden xs:inline">新規下書き</span>
                </button>
              )}
              {tab === "dashboard" && (
                <button
                  onClick={generateDailyReport}
                  disabled={reportLoading}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded text-xs sm:text-sm font-medium whitespace-nowrap disabled:opacity-50"
                  style={{ background: GOLD, color: INK }}
                >
                  {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span className="hidden xs:inline">{reportLoading ? "生成中…" : "本日のレポートを更新"}</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded text-sm shrink-0"
                  style={{ color: active ? PAPER : MUTED, background: active ? CARD : "transparent" }}
                >
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "dashboard" ? (
            <div className="max-w-2xl mx-auto flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: MUTED, fontFamily: monoFont }}>
                  毎日11:00に自動更新（本番運用時）・{todayStr}
                </span>
              </div>
              {reportError && <p className="text-sm" style={{ color: "#C96A5A" }}>{reportError}</p>}
              {!latestReport ? (
                <FoilFrame holo>
                  <div className="p-6 flex flex-col items-center text-center gap-3">
                    <TrendingUp size={24} style={{ color: HOLO_A }} />
                    <p className="text-sm" style={{ color: MUTED }}>
                      まだ本日のレポートがありません。ボタンから生成すると、前日の投稿をもとに振り返り・改善点・ネクストアクションをAIがまとめます。
                    </p>
                    <button
                      onClick={generateDailyReport}
                      disabled={reportLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                      style={{ background: `linear-gradient(135deg, ${HOLO_A}, ${HOLO_B})`, color: INK }}
                    >
                      {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {reportLoading ? "生成中…" : "レポートを生成"}
                    </button>
                  </div>
                </FoilFrame>
              ) : (
                <ReportCard report={latestReport} />
              )}
            </div>
          ) : tab === "reports" ? (
            reports.length === 0 ? (
              <EmptyState text="過去のレポートはまだありません。ダッシュボードでレポートを生成すると、ここに履歴が溜まっていきます。" />
            ) : (
              <div className="max-w-2xl mx-auto flex flex-col gap-4">
                {reports.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            )
          ) : tab === "templates" ? (
            templates.length === 0 ? (
              <EmptyState text="テンプレートはまだありません。よく使う投稿文の型を登録しておくと、下書き作成が速くなります。" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <FoilFrame key={t.id}>
                    <div className="p-4 flex flex-col gap-3 h-full">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: PAPER, fontFamily: displayFont }}>{t.title}</span>
                      </div>
                      <p className="text-xs whitespace-pre-wrap flex-1" style={{ color: MUTED }}>{t.body}</p>
                      <div className="flex justify-end gap-1 pt-2" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                        <button onClick={() => { setEditingTemplate(t); setTemplateEditorOpen(true); }} className="p-1.5 rounded" style={{ color: MUTED }}><Pencil size={14} /></button>
                        <button onClick={() => deleteTemplate(t)} className="p-1.5 rounded" style={{ color: "#C96A5A" }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </FoilFrame>
                ))}
              </div>
            )
          ) : visibleDrafts.length === 0 ? (
            <EmptyState
              text={
                tab === "scheduled"
                  ? "予約中の投稿はありません。下書きから時計アイコンで日時を設定できます。"
                  : "下書きはまだありません。右上の「新規下書き」か「AI生成」から作成しましょう。"
              }
            />
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
        onClose={() => { setEditorOpen(false); setEditingDraft(null); }}
        onSave={saveDraft}
      />
      <ScheduleModal
        open={!!scheduleTarget}
        draft={scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        onConfirm={confirmSchedule}
      />
      <TemplateEditorModal
        open={templateEditorOpen}
        template={editingTemplate}
        onClose={() => { setTemplateEditorOpen(false); setEditingTemplate(null); }}
        onSave={saveTemplate}
      />
      <AIGenerateModal
        open={aiOpen}
        accounts={accounts}
        defaultAccountId={activeAccountId === "all" ? accounts[0]?.id : activeAccountId}
        onClose={() => setAiOpen(false)}
        onAdopt={adoptAIVariant}
      />
    </div>
  );
}

function ReportCard({ report }) {
  return (
    <FoilFrame holo>
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} style={{ color: HOLO_A }} />
          <span style={{ fontFamily: monoFont, fontSize: 12, color: MUTED }}>{report.date} のデイリーレポート</span>
        </div>
        <ReportSection label="前日の振り返り" text={report.review} />
        <ReportSection label="改善点" text={report.improvements} />
        <ReportSection label="ネクストアクション" text={report.nextActions} />
      </div>
    </FoilFrame>
  );
}

function ReportSection({ label, text }) {
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

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <LayoutGrid size={28} style={{ color: HAIRLINE }} />
      <p className="text-sm max-w-sm" style={{ color: MUTED }}>{text}</p>
    </div>
  );
}
