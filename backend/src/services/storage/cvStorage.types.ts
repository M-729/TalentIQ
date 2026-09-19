export interface StoredCvFile {
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface UploadCvInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export type CvStorageErrorCode = "not_found" | "provider_error";

export class CvStorageError extends Error {
  public readonly code: CvStorageErrorCode;

  constructor(code: CvStorageErrorCode, message: string) {
    super(message);
    this.name = "CvStorageError";
    this.code = code;
  }
}

/**
 * Storage abstraction that application.service.ts (and, as of this
 * ticket, the internal CV extraction service) depends on, instead of any
 * specific provider's SDK directly. Swapping providers later means
 * changing only cvStorage.service.ts's export, not the application flow,
 * its routes, or its tests (which mock this interface entirely).
 */
export interface CvStorageService {
  upload(input: UploadCvInput): Promise<StoredCvFile>;
  delete(storageKey: string): Promise<void>;
  /**
   * Not called by anything in this ticket — a ready extension point for a
   * future authorized HR CV-download endpoint, which should go through a
   * short-lived signed URL rather than a permanently public one.
   */
  getSignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  /**
   * Retrieves the file's raw bytes directly, server-side — no signed URL,
   * no outbound HTTP fetch of one. This is what server-side CV parsing
   * (and, later, AI analysis) uses; getSignedDownloadUrl() stays reserved
   * for a future browser-facing HR download flow. Throws CvStorageError
   * on a missing object or any other provider failure.
   */
  download(storageKey: string): Promise<Buffer>;
}
