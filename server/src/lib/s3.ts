import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function s3Client() {
  if (!client) {
    const region = process.env.AWS_REGION;
    if (!region) throw new Error("AWS_REGION is not configured");
    client = new S3Client({ region });
  }
  return client;
}

export async function createPresignedUpload(params: { fileName: string; contentType: string }) {
  const bucket = process.env.S3_BUCKET_NAME;
  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (!bucket) throw new Error("S3_BUCKET_NAME is not configured");
  if (!publicBase) throw new Error("S3_PUBLIC_BASE_URL is not configured");

  const ext = params.fileName.includes(".") ? params.fileName.split(".").pop() : "jpg";
  const key = `drafts/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.contentType,
    ACL: "public-read",
  });
  const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 300 });
  const publicUrl = `${publicBase.replace(/\/$/, "")}/${key}`;
  return { uploadUrl, publicUrl, key };
}
