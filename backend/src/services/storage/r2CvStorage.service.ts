import crypto from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import type { CvStorageService, StoredCvFile, UploadCvInput } from "./cvStorage.types";

const CV_PREFIX = "talentiq/cvs";

let cachedClient: S3Client | null = null;

function ensureConfigured(): { client: S3Client; bucket: string } {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
    throw new Error(
      "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in backend/.env."
    );
  }

  if (!cachedClient) {
    cachedClient = new S3Client({
      // R2 doesn't use AWS regions; Cloudflare's own docs specify "auto"
      // here rather than exposing this as something to configure.
      region: "auto",
      // R2's S3-compatible endpoint is deterministic from the account id
      // — deliberately not a separate env var to configure.
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return { client: cachedClient, bucket: env.R2_BUCKET_NAME };
}

// Never trust the candidate's own filename for display; strip anything
// that isn't a safe display character and cap the length.
function sanitizeDisplayName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]/g, "").trim();
  return (cleaned || "resume").slice(0, 200);
}

export const r2CvStorage: CvStorageService = {
  async upload({ buffer, originalName, mimeType }: UploadCvInput): Promise<StoredCvFile> {
    const { client, bucket } = ensureConfigured();

    // A random id, never the candidate's filename — keeps object keys
    // unguessable and avoids any collision/path-traversal risk from
    // arbitrary user input. No ACL is set: the bucket is private by
    // default (no public access configured on it), which is what
    // actually keeps this object private, not a per-object flag.
    const storageKey = `${CV_PREFIX}/${crypto.randomUUID()}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    return {
      storage_key: storageKey,
      original_name: sanitizeDisplayName(originalName),
      mime_type: mimeType,
      // S3's PutObject response doesn't echo back the object size, but
      // buffer.length is exactly what was just uploaded, so it's already
      // the authoritative value.
      size_bytes: buffer.length,
    };
  },

  async delete(storageKey: string): Promise<void> {
    const { client, bucket } = ensureConfigured();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  },

  async getSignedDownloadUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
    const { client, bucket } = ensureConfigured();
    const command = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  },
};
