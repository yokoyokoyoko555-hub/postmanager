import type { NextFunction, Request, Response } from "express";

// 管理画面全体を守る簡易Basic認証。BASIC_AUTH_PASSWORDが未設定の場合は
// ローカル開発を妨げないよう認証をスキップする。
export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return next();

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const reqUser = decoded.slice(0, sep);
    const reqPass = decoded.slice(sep + 1);
    if (reqUser === user && reqPass === pass) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="postmanager"');
  res.status(401).send("Authentication required");
}
