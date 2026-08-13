import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function s3Client() {
  if (!client) {
    const region = process.env.AWS_REGION;
    if (!region) throw new Error("AWS_REGION is not configured");
    // Cloudflare R2 / Backblaze B2 等のS3互換サービスを使う場合はS3_ENDPOINTを設定する。
    // 未設定なら通常のAWS S3として動作する。
    const endpoint = process.env.S3_ENDPOINT;
    client = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }
  return client;
}

export async function createPresignedUpload(params: { fileName: string; contentType: string; folder?: "drafts" | "templates" }) {
  const bucket = process.env.S3_BUCKET_NAME;
  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (!bucket) throw new Error("S3_BUCKET_NAME is not configured");
  if (!publicBase) throw new Error("S3_PUBLIC_BASE_URL is not configured");

  const ext = params.fileName.includes(".") ? params.fileName.split(".").pop() : "jpg";
  const key = `${params.folder ?? "drafts"}/${crypto.randomUUID()}.${ext}`;

  // 2023年4月以降に作成されたS3バケットはデフォルトでACLが無効化されているため、
  // オブジェクト単位のACL指定はしない。公開読み取りはバケットポリシーで許可する運用にする。
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 300 });
  const publicUrl = `${publicBase.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key };
}
