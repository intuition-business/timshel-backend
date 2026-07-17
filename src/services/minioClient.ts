import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const minioS3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT!,
  region: process.env.MINIO_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
});

export const MINIO_BUCKET = process.env.STORAGE_BUCKET || "timshell";

const extractKey = (url: string): string => {
  const p = decodeURIComponent(new URL(url).pathname.slice(1));
  return p.startsWith(`${MINIO_BUCKET}/`) ? p.slice(MINIO_BUCKET.length + 1) : p;
};

export const deleteFromMinio = async (url?: string) => {
  if (!url) return;
  try {
    await minioS3.send(new DeleteObjectCommand({ Bucket: MINIO_BUCKET, Key: extractKey(url) }));
  } catch (err) {
    console.warn("No se pudo eliminar archivo de MinIO:", err);
  }
};
