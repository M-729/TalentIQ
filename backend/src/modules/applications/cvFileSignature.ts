export type DetectedCvType = "pdf" | "docx";

// `file-type` is ESM-only; this backend compiles to CommonJS, so it's
// loaded via a dynamic import() (which Node/TS support from CJS for
// exactly this interop case) rather than a static require(). The import
// is resolved once and cached.
let fileTypeModulePromise: Promise<typeof import("file-type")> | null = null;

function loadFileTypeModule(): Promise<typeof import("file-type")> {
  fileTypeModulePromise ??= import("file-type");
  return fileTypeModulePromise;
}

/**
 * Authoritative content-based check: confirms the buffer's actual bytes
 * are a real PDF or a real Word (docx) OOXML package, regardless of what
 * the client claimed via filename/mimetype. This is what actually stops
 * a renamed executable or script from being accepted as a "resume.pdf".
 */
export async function detectCvFileType(buffer: Buffer): Promise<DetectedCvType | null> {
  const { fileTypeFromBuffer } = await loadFileTypeModule();
  const result = await fileTypeFromBuffer(buffer);

  if (!result) return null;
  if (result.mime === "application/pdf") return "pdf";
  if (result.mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return null;
}
