/**
 * The only Job fields this analysis is allowed to see — deliberately not
 * the full Job document. No company_id, created_by, status, or any other
 * internal/administrative field ever reaches the prompt builder, because
 * this type is what the prompt builder's input is typed against.
 */
export interface JobDataForAnalysis {
  title: string;
  description?: string;
  required_skills: string[];
  experience_level?: string;
  employment_type?: string;
}

export type CvAnalysisErrorCode =
  | "job_not_found"
  | "ai_not_configured"
  | "ai_provider_failure"
  | "invalid_ai_json"
  | "invalid_ai_schema";

/**
 * This service's own failure taxonomy. Application/CV-extraction failures
 * are NOT duplicated here — ApplicationCvExtractionError, CvStorageError,
 * and CvParseError already describe those safely and propagate unchanged
 * (see cvAnalysis.service.ts), per the instruction to reuse existing
 * errors rather than re-wrapping them.
 */
export class CvAnalysisError extends Error {
  public readonly code: CvAnalysisErrorCode;

  constructor(code: CvAnalysisErrorCode, message: string) {
    super(message);
    this.name = "CvAnalysisError";
    this.code = code;
  }
}
