import { Router } from "express";
import { z } from "zod";
import { createPresignedUpload } from "../lib/s3.js";

const router = Router();

const presignSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

router.post("/presign", async (req, res) => {
  const parsed = presignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await createPresignedUpload(parsed.data);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: "S3設定が不足しています", detail: (e as Error).message });
  }
});

export default router;
