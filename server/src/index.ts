import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { basicAuth } from "./lib/basicAuth.js";
import accountsRouter from "./routes/accounts.js";
import aiRouter from "./routes/ai.js";
import draftsRouter from "./routes/drafts.js";
import mediaRouter from "./routes/media.js";
import metricsRouter from "./routes/metrics.js";
import templatesRouter from "./routes/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ルートハンドラ内の想定外の例外(存在しないレコードのdelete/updateなど)で
// プロセス全体が落ちてサービス停止に繋がらないよう、最後の砦としてログのみ出して継続する
process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException", err);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", basicAuth);
app.use("/api/accounts", accountsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/drafts", draftsRouter);
app.use("/api/ai", aiRouter);
app.use("/api/media", mediaRouter);
app.use("/api/metrics", metricsRouter);

// 本番ビルド時はReactの静的ファイルを配信する
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

// ルート内で処理しきれなかったエラーはここでJSONとして返す(プロセスを落とさない)
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server] unhandled route error", err);
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : "unknown error";
  res.status(500).json({ error: "サーバーエラーが発生しました", detail: message });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`server listening on :${port}`);
});
