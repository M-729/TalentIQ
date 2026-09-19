import { r2CvStorage } from "./r2CvStorage.service";
import type { CvStorageService } from "./cvStorage.types";

// The single point application code depends on. Swapping storage
// providers later means changing only this file's export, not
// application.service.ts, its routes, or anything that already consumes
// the CvStorageService interface. Tests mock this entire module.
// (Previously Cloudinary; switched to Cloudflare R2 — see task report.)
export const cvStorage: CvStorageService = r2CvStorage;

export { CvStorageError } from "./cvStorage.types";
export type { CvStorageService, CvStorageErrorCode, StoredCvFile, UploadCvInput } from "./cvStorage.types";
