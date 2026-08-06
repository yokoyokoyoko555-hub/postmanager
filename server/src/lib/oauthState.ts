import crypto from "node:crypto";

type PendingOAuth = { platform: "x" | "instagram"; codeVerifier?: string; createdAt: number };

const STATE_TTL_MS = 10 * 60 * 1000;
const pending = new Map<string, PendingOAuth>();

export function createState(entry: Omit<PendingOAuth, "createdAt">) {
  const state = crypto.randomUUID();
  pending.set(state, { ...entry, createdAt: Date.now() });
  return state;
}

export function consumeState(state: string) {
  const entry = pending.get(state);
  if (!entry) return null;
  pending.delete(state);
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return null;
  return entry;
}
