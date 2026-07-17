import { MINIO_BUCKET } from "./minioClient";

const STORAGE_URL = process.env.STORAGE_URL!;
const STORAGE_API_KEY = process.env.STORAGE_API_KEY!;

const extractKey = (url: string): string => {
  const p = decodeURIComponent(new URL(url).pathname.slice(1));
  return p.startsWith(`${MINIO_BUCKET}/`) ? p.slice(MINIO_BUCKET.length + 1) : p;
};

export const presignUrl = async (url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  try {
    const key = extractKey(url);
    const res = await fetch(`${STORAGE_URL}/presign/get`, {
      method: "POST",
      headers: { "x-api-key": STORAGE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json() as { url: string };
    return data.url;
  } catch {
    return url;
  }
};

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
