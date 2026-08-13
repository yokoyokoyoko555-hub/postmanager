import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4はasyncハンドラ内で投げられた(rejectされた)エラーを自動でnext()に
// 渡さないため、そのままだとunhandledRejectionとなりプロセスごと落ちることがある。
// (実際に存在しないレコードへのdelete/updateでサーバー全体がクラッシュした事例あり)
export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
