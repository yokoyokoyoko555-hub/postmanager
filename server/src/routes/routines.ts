import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

function isRecordNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

router.get("/", ah(async (req, res) => {
  const { accountId } = req.query as { accountId?: string };
  const routines = await prisma.routinePost.findMany({
    where: accountId ? { accountId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(routines);
}));

const routineSchema = z.object({
  accountId: z.string().min(1),
  text: z.string().min(1),
  mediaUrls: z.array(z.string().url()).default([]),
  frequency: z.enum(["daily", "weekly"]),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  active: z.boolean().default(true),
}).refine((v) => v.frequency === "daily" || v.daysOfWeek.length > 0, {
  message: "曜日指定の場合は少なくとも1つ曜日を選んでください",
  path: ["daysOfWeek"],
});

router.post("/", ah(async (req, res) => {
  const parsed = routineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const account = await prisma.account.findUnique({ where: { id: parsed.data.accountId } });
  if (!account) return res.status(404).json({ error: "account not found" });

  const routine = await prisma.routinePost.create({ data: parsed.data });
  res.status(201).json(routine);
}));

router.put("/:id", ah(async (req, res) => {
  const parsed = routineSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const routine = await prisma.routinePost.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(routine);
  } catch (e) {
    if (isRecordNotFound(e)) return res.status(404).json({ error: "ルーティーンが見つかりません" });
    throw e;
  }
}));

router.delete("/:id", ah(async (req, res) => {
  try {
    await prisma.routinePost.delete({ where: { id: req.params.id } });
  } catch (e) {
    if (!isRecordNotFound(e)) throw e;
  }
  res.status(204).end();
}));

export default router;
