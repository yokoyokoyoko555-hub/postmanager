import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

function isRecordNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

// accountIdを指定すると、そのアカウント専用テンプレート + 共通テンプレート(accountId=null)を返す。
// 指定しなければ全テンプレートを返す。
router.get("/", ah(async (req, res) => {
  const { accountId } = req.query as { accountId?: string };
  const templates = await prisma.template.findMany({
    where: accountId ? { OR: [{ accountId }, { accountId: null }] } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(templates);
}));

const templateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  accountId: z.string().nullable().optional(),
  mediaUrls: z.array(z.string().url()).default([]),
});

router.post("/", ah(async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.template.create({ data: parsed.data });
  res.status(201).json(template);
}));

router.put("/:id", ah(async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const template = await prisma.template.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(template);
  } catch (e) {
    if (isRecordNotFound(e)) return res.status(404).json({ error: "テンプレートが見つかりません" });
    throw e;
  }
}));

router.delete("/:id", ah(async (req, res) => {
  try {
    await prisma.template.delete({ where: { id: req.params.id } });
  } catch (e) {
    if (!isRecordNotFound(e)) throw e;
  }
  res.status(204).end();
}));

export default router;
