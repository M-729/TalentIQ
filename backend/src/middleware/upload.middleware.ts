import multer from "multer";
import { BadRequestError } from "../security/AppError";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

export const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024;

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

/**
 * Route-scoped multipart middleware for the CV field. Memory storage only
 * — files are small (5MB max) and this app never needs them to touch the
 * backend's own filesystem; the buffer goes straight to cvStorage.
 *
 * fileFilter here is a fast, cheap rejection based on client-declared
 * mimetype/extension — NOT the authoritative check. It only rules out
 * obviously-wrong uploads before spending time buffering them. The real
 * authority is the content-signature check in cvFileSignature.ts, run
 * after the full buffer is available (a client can lie about mimetype/
 * extension; it can't fake the file's actual magic bytes as easily).
 */
export const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = getExtension(file.originalname);
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(extension)) {
      cb(new BadRequestError("Only PDF and DOCX files are accepted."));
      return;
    }
    cb(null, true);
  },
}).single("cv");
