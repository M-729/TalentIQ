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

/**
 * Storage abstraction that application.service.ts depends on, instead of
 * any specific provider's SDK directly. Swapping providers later means
 * changing only cvStorage.service.ts's export, not the application flow,
 * its routes, or its tests (which mock this interface entirely).
 */
export interface CvStorageService {
  upload(input: UploadCvInput): Promise<StoredCvFile>;
  delete(storageKey: string): Promise<void>;
  /**
   * Not called by anything in this ticket — a ready extension point for a
   * future authorized HR CV-download endpoint and for server-side AI CV
   * retrieval, neither of which should ever go through a permanently
   * public URL.
   */
  getSignedDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
}
