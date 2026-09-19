import { Application } from "../../models/Application.model";
import { cvStorage } from "../../services/storage/cvStorage.service";
import { parseCv } from "../../services/cv/cvParser.service";
import type { ParseCvResult } from "../../services/cv/cvParser.service";

export type ApplicationCvExtractionErrorCode = "application_not_found" | "no_cv_on_application";

export class ApplicationCvExtractionError extends Error {
  public readonly code: ApplicationCvExtractionErrorCode;

  constructor(code: ApplicationCvExtractionErrorCode, message: string) {
    super(message);
    this.name = "ApplicationCvExtractionError";
    this.code = code;
  }
}

function parserLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return "unknown";
}

/**
 * Internal business service only — nothing exposes this over HTTP yet, so
 * no company-facing authorization is applied here (see task report for
 * why: that belongs to whichever future ticket adds a route). The
 * upcoming Groq CV-analysis ticket is the intended caller.
 *
 * Downloads and parses the exact CV submitted for this specific
 * Application — never the candidate's most recent CV across other
 * applications (see Application.model.ts's cv_file comment for why the
 * CV belongs to the Application, not the Candidate).
 */
export async function extractApplicationCvText(applicationId: string): Promise<ParseCvResult> {
  const startedAt = Date.now();
  const parser = { type: "unknown" };

  try {
    const application = await Application.findById(applicationId).select("cv_file");
    if (!application) {
      throw new ApplicationCvExtractionError("application_not_found", "Application not found.");
    }

    if (!application.cv_file) {
      throw new ApplicationCvExtractionError("no_cv_on_application", "Application has no CV file.");
    }

    const { storage_key, mime_type } = application.cv_file;
    parser.type = parserLabel(mime_type);

    const buffer = await cvStorage.download(storage_key);

    const result = await parseCv({
      buffer,
      mimeType: mime_type,
      originalName: application.cv_file.original_name,
    });

    console.log("[cv] extracted application CV text", {
      applicationId,
      parser: parser.type,
      fileSizeBytes: buffer.length,
      characterCount: result.characterCount,
      truncated: result.truncated,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (err) {
    const code = err instanceof Error && "code" in err ? (err as { code: unknown }).code : undefined;
    console.error("[cv] failed to extract application CV text", {
      applicationId,
      parser: parser.type,
      code,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
