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
import templatesRouter from "./routes/templates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// 本番ビルド時はReactの静的ファイルを配信する
if (process.env.NODE_ENV === "production") {
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`server listening on :${port}`);
});
