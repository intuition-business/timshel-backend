import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME!;
const EXPIRES_IN = 43200; // 12 horas

export const presignUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  try {
    const key = decodeURIComponent(new URL(url).pathname.slice(1));
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: EXPIRES_IN });
  } catch {
    return url;
  }
};

// Presigna campos de imagen/video en un array de objetos en paralelo
export const presignFields = async <T extends Record<string, any>>(
  items: T[],
  fields: (keyof T)[]
): Promise<T[]> => {
  return Promise.all(
    items.map(async (item) => {
      const updated = { ...item };
      await Promise.all(
        fields.map(async (field) => {
          (updated as any)[field] = await presignUrl(item[field]);
        })
      );
      return updated;
    })
  );
};
