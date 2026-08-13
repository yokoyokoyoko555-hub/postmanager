import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ah } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { createState, consumeState } from "../lib/oauthState.js";
import * as x from "../platforms/x.js";
import * as instagram from "../platforms/instagram.js";

const router = Router();

function isRecordNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

router.get("/", ah(async (_req, res) => {
  const accounts = await prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json(
    accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      displayName: a.displayName,
      handle: a.handle,
      connected: Boolean(a.oauthAccessToken),
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
    })),
  );
}));

const createAccountSchema = z.object({
  platform: z.enum(["x", "instagram"]),
  displayName: z.string().min(1),
  handle: z.string().min(1),
});

// OAuth連携前でも、店舗側で先にアカウント枠だけ登録できるようにする
router.post("/", ah(async (req, res) => {
  const parsed = createAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const maxOrder = await prisma.account.aggregate({ _max: { sortOrder: true } });
  const account = await prisma.account.create({
    data: { ...parsed.data, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json(account);
}));

const reorderSchema = z.object({ orderedIds: z.array(z.string().min(1)) });

// アカウントの並び順を丸ごと入れ替える(orderedIdsの並び=新しい表示順)
router.put("/reorder", ah(async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.account.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  const accounts = await prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json(
    accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      displayName: a.displayName,
      handle: a.handle,
      connected: Boolean(a.oauthAccessToken),
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
    })),
  );
}));

router.delete("/:id", ah(async (req, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
  } catch (e) {
    if (!isRecordNotFound(e)) throw e;
  }
  res.status(204).end();
}));

// --- X OAuth (PKCE) ---
router.get("/x/oauth/start", (_req, res) => {
  try {
    const { codeVerifier, codeChallenge } = x.generatePkcePair();
    const state = createState({ platform: "x", codeVerifier });
    const url = x.getAuthorizeUrl({ state, codeChallenge });
    res.redirect(url);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/x/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return res.status(400).send("missing code/state");
    const entry = consumeState(state);
    if (!entry?.codeVerifier) return res.status(400).send("invalid or expired state");

    const token = await x.exchangeCodeForToken(code, entry.codeVerifier);
    const me = await x.getMe(token.access_token);

    await prisma.account.upsert({
      where: { platform_handle: { platform: "x", handle: `@${me.data.username}` } },
      create: {
        platform: "x",
        displayName: me.data.name,
        handle: `@${me.data.username}`,
        platformUserId: me.data.id,
        oauthAccessToken: token.access_token,
        oauthRefreshToken: token.refresh_token,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
      update: {
        displayName: me.data.name,
        platformUserId: me.data.id,
        oauthAccessToken: token.access_token,
        oauthRefreshToken: token.refresh_token,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
    });

    res.redirect("/?connected=x");
  } catch (e) {
    res.status(500).send((e as Error).message);
  }
});

// --- Instagram OAuth ---
router.get("/instagram/oauth/start", (_req, res) => {
  try {
    const state = createState({ platform: "instagram" });
    res.redirect(instagram.getAuthorizeUrl(state));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/instagram/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return res.status(400).send("missing code/state");
    if (!consumeState(state)) return res.status(400).send("invalid or expired state");

    const shortLived = await instagram.exchangeCodeForToken(code);
    const longLived = await instagram.exchangeForLongLivedToken(shortLived.access_token);
    const found = await instagram.findInstagramBusinessAccount(longLived.access_token);
    if (!found) return res.status(400).send("Instagramビジネスアカウントが見つかりませんでした");

    const followers = await instagram.getFollowersCount({
      igUserId: found.igUserId,
      accessToken: found.pageAccessToken,
    });

    await prisma.account.upsert({
      where: { platform_handle: { platform: "instagram", handle: found.igUserId } },
      create: {
        platform: "instagram",
        displayName: `IG (${followers}フォロワー)`,
        handle: found.igUserId,
        oauthAccessToken: found.pageAccessToken,
        igBusinessAccountId: found.igUserId,
        tokenExpiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      },
      update: {
        oauthAccessToken: found.pageAccessToken,
        tokenExpiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      },
    });

    res.redirect("/?connected=instagram");
  } catch (e) {
    res.status(500).send((e as Error).message);
  }
});

export default router;
