import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { postDraftNow } from "../lib/publish.js";

const router = Router();

router.get("/", async (req, res) => {
  const { accountId, status } = req.query as { accountId?: string; status?: string };
  const drafts = await prisma.draft.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      // リポスト対象の候補選択用に、投稿成功時のプラットフォーム投稿IDを1件だけ添える
      postLogs: { where: { status: "success" }, orderBy: { executedAt: "desc" }, take: 1 },
    },
  });
  res.json(drafts);
});

const createDraftSchema = z.object({
  accountId: z.string().min(1),
  text: z.string().min(1),
  mediaUrls: z.array(z.string().url()).default([]),
  source: z.enum(["manual", "ai"]).default("manual"),
  templateId: z.string().optional(),
  postMode: z.enum(["post", "quote", "repost"]).default("post"),
  quoteTargetId: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = createDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const account = await prisma.account.findUnique({ where: { id: parsed.data.accountId } });
  if (!account) return res.status(404).json({ error: "account not found" });

  const draft = await prisma.draft.create({
    data: { ...parsed.data, platform: account.platform },
  });
  res.status(201).json(draft);
});

const updateDraftSchema = z.object({
  text: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  postMode: z.enum(["post", "quote", "repost"]).optional(),
  quoteTargetId: z.string().nullable().optional(),
});

router.put("/:id", async (req, res) => {
  const parsed = updateDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const draft = await prisma.draft.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(draft);
});

router.delete("/:id", async (req, res) => {
  await prisma.draft.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

const scheduleSchema = z.object({ scheduledAt: z.string().datetime() });

router.post("/:id/schedule", async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const draft = await prisma.draft.update({
    where: { id: req.params.id },
    data: { status: "scheduled", scheduledAt: new Date(parsed.data.scheduledAt) },
  });
  res.json(draft);
});

router.post("/:id/unschedule", async (req, res) => {
  const draft = await prisma.draft.update({
    where: { id: req.params.id },
    data: { status: "draft", scheduledAt: null },
  });
  res.json(draft);
});

// 即時投稿(予約を待たず今すぐ実際にプラットフォームへ投稿する)
router.post("/:id/post-now", async (req, res) => {
  try {
    const result = await postDraftNow(req.params.id);
    if (result.ok) return res.json(result.draft);
    return res.status(502).json({ error: "投稿に失敗しました", detail: result.error, draft: result.draft });
  } catch (e) {
    res.status(500).json({ error: "投稿処理でエラーが発生しました", detail: (e as Error).message });
  }
});

// 記録用の手動ステータス切替(実投稿を伴わない)
router.post("/:id/toggle-posted", async (req, res) => {
  const current = await prisma.draft.findUniqueOrThrow({ where: { id: req.params.id } });
  const draft = await prisma.draft.update({
    where: { id: req.params.id },
    data: {
      status: current.status === "posted" ? "draft" : "posted",
      postedAt: current.status === "posted" ? null : new Date(),
    },
  });
  res.json(draft);
});

export default router;
