import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const router = Router();

// accountIdを指定すると、そのアカウント専用テンプレート + 共通テンプレート(accountId=null)を返す。
// 指定しなければ全テンプレートを返す。
router.get("/", async (req, res) => {
  const { accountId } = req.query as { accountId?: string };
  const templates = await prisma.template.findMany({
    where: accountId ? { OR: [{ accountId }, { accountId: null }] } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(templates);
});

const templateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  accountId: z.string().nullable().optional(),
});

router.post("/", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.template.create({ data: parsed.data });
  res.status(201).json(template);
});

router.put("/:id", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.template.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(template);
});

router.delete("/:id", async (req, res) => {
  await prisma.template.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
