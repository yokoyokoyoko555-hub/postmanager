import sharp from "sharp";

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Xの投稿画面や公式アプリは、投稿前に裏側で自動的に画像を圧縮している。
// このシステムはR2の元ファイルをそのまま送っていたため、Xの上限(5MB)を
// 超えた画像が謎の503で弾かれていた。同様に自動圧縮してから送る。
export async function compressImageIfNeeded(
  buffer: Buffer,
  mimeType: string,
  maxBytes: number,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (buffer.length <= maxBytes) return { buffer, mimeType };
  if (!COMPRESSIBLE_TYPES.has(mimeType)) return { buffer, mimeType }; // GIF/動画は対象外

  let quality = 85;
  let width: number | undefined;
  let output = buffer;

  for (let attempt = 0; attempt < 6; attempt++) {
    let pipeline = sharp(buffer, { failOn: "none" }).rotate(); // EXIFの向きを反映してから加工する
    if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
    output = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    if (output.length <= maxBytes) {
      console.log("compressed image for X upload", {
        originalBytes: buffer.length,
        compressedBytes: output.length,
        quality,
        width: width ?? "original",
      });
      return { buffer: output, mimeType: "image/jpeg" };
    }
    quality = Math.max(40, quality - 15);
    width = width ? Math.round(width * 0.85) : 2000;
  }

  // 6回試しても収まらない場合は、その時点の(最も小さい)結果をそのまま使う。
  // アップロード側の事前サイズチェックで最終的に弾かれる可能性はあるが、
  // 元のサイズよりは大幅に縮小できているはず
  console.warn("compressImageIfNeeded: could not fit under limit after retries", {
    originalBytes: buffer.length,
    finalBytes: output.length,
    maxBytes,
  });
  return { buffer: output, mimeType: "image/jpeg" };
}
