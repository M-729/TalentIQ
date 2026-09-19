import { BadGatewayError, NotFoundError, ServiceUnavailableError, UnprocessableEntityError } from "../../security/AppError";

/**
 * Maps the screening pipeline's existing internal error codes (from
 * ApplicationCvExtractionError, CvStorageError, CvParseError, and
 * CvAnalysisError — none of which are HTTP-aware, since nothing exposed
 * them over a route before this ticket) to a safe AppError the existing
 * error middleware already knows how to render. Every mapped error gets
 * a brand-new, fixed, safe message here — the original error's message
 * (which may describe internal provider/parser detail) is never reused,
 * so nothing about Groq, R2, or parser internals ever reaches an HTTP
 * response.
 *
 * An error whose name/code isn't recognized here is returned unchanged,
 * so it falls through to error.middleware.ts's generic 500 handler —
 * exactly the existing safe default for anything unexpected.
 */
export function mapScreeningError(err: unknown): unknown {
  if (!(err instanceof Error)) {
    return err;
  }

  const code = "code" in err ? (err as Error & { code?: unknown }).code : undefined;
  if (typeof code !== "string") {
    return err;
  }

  const codeMap = ERROR_NAME_TO_CODE_MAP[err.name];
  const factory = codeMap?.[code];
  return factory ? factory() : err;
}

const CV_EXTRACTION_CODE_MAP: Record<string, () => Error> = {
  application_not_found: () => new NotFoundError("Application not found"),
  no_cv_on_application: () => new UnprocessableEntityError("This application has no CV to screen."),
};

const CV_STORAGE_CODE_MAP: Record<string, () => Error> = {
  not_found: () => new UnprocessableEntityError("The CV for this application could not be found in storage."),
  provider_error: () => new ServiceUnavailableError("CV storage is temporarily unavailable."),
};

const CV_PARSE_CODE_MAP: Record<string, () => Error> = {
  unsupported_format: () => new UnprocessableEntityError("This CV's file type is not supported for screening."),
  no_extractable_text: () => new UnprocessableEntityError("This CV contains no extractable text."),
  empty_text: () => new UnprocessableEntityError("This CV contains no extractable text."),
  malformed: () => new UnprocessableEntityError("This CV file could not be read."),
  parse_failed: () => new UnprocessableEntityError("This CV file could not be read."),
};

const CV_ANALYSIS_CODE_MAP: Record<string, () => Error> = {
  job_not_found: () => new NotFoundError("Job not found for this application."),
  ai_not_configured: () => new ServiceUnavailableError("AI screening is not currently available."),
  ai_provider_failure: () => new ServiceUnavailableError("The AI provider is temporarily unavailable."),
  invalid_ai_json: () => new BadGatewayError("The AI returned an invalid response."),
  invalid_ai_schema: () => new BadGatewayError("The AI returned an unexpected response."),
};

const ERROR_NAME_TO_CODE_MAP: Record<string, Record<string, () => Error> | undefined> = {
  ApplicationCvExtractionError: CV_EXTRACTION_CODE_MAP,
  CvStorageError: CV_STORAGE_CODE_MAP,
  CvParseError: CV_PARSE_CODE_MAP,
  CvAnalysisError: CV_ANALYSIS_CODE_MAP,
};
