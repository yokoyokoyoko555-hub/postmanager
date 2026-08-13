import { Router } from "express";
import { ah } from "../lib/asyncHandler.js";
import { migrateTemplateOnlyImagesToTemplatesFolder } from "../lib/migrateTemplateImages.js";

const router = Router();

// 一度限りの手動移行用。既に移動済みのものは対象に入らないので、複数回叩いても安全。
router.get("/migrate-template-images", ah(async (_req, res) => {
  const result = await migrateTemplateOnlyImagesToTemplatesFolder();
  res.json(result);
}));

export default router;
