import { Application } from "../../models/Application.model";
import { Job } from "../../models/Job.model";
import {
  extractApplicationCvText,
  ApplicationCvExtractionError,
} from "../../modules/applications/applicationCvExtraction.service";
import { aiService, AIServiceError } from "./ai.service";
import { buildCvAnalysisPrompt } from "./cvAnalysis.prompt";
import { cvAnalysisResultSchema } from "./cvAnalysis.schema";
import { CvAnalysisError } from "./cvAnalysis.types";
import type { CvAnalysisResult } from "./cvAnalysis.schema";
import type { JobDataForAnalysis } from "./cvAnalysis.types";

// Conservative even relative to the shared AI service's own 0.2 default —
// structured, evidence-based extraction benefits from the most
// deterministic setting reasonably available, not creative variation.
const CV_ANALYSIS_TEMPERATURE = 0.1;

// The extracted CV text is already capped (see cvParser.service.ts); this
// bounds the JSON *response* instead. Sized generously above what a
// normal CV's worth of structured analysis needs (a few hundred to low
// thousands of tokens), while still well under the schema's theoretical
// worst-case (50 skills + 50 requiredSkillEvidence entries, each with
// evidence text) so a well-formed response is never cut off mid-JSON.
const CV_ANALYSIS_MAX_TOKENS = 3000;

function toJobDataForAnalysis(job: {
  title: string;
  description?: string | null;
  required_skills: string[];
  experience_level?: string | null;
  employment_type?: string | null;
}): JobDataForAnalysis {
  // Built field-by-field, never by spreading the Job document — this is
  // what actually guarantees company_id, created_by, status, salary,
  // etc. never reach the prompt builder, not just the type annotation.
  return {
    title: job.title,
    description: job.description ?? undefined,
    required_skills: job.required_skills,
    experience_level: job.experience_level ?? undefined,
    employment_type: job.employment_type ?? undefined,
  };
}

// Skills are deduplicated case-insensitively (the model is instructed to
// normalize casing itself, but this is a defensive backstop, not a
// substitute) and yearsMentioned is coerced from undefined to null so
// callers always see a consistent `number | null`, never `undefined`.
function normalizeCvAnalysisResult(result: CvAnalysisResult): CvAnalysisResult {
  const seen = new Set<string>();
  const skills = result.skills.filter((skill) => {
    const key = skill.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    ...result,
    skills,
    experience: { ...result.experience, yearsMentioned: result.experience.yearsMentioned ?? null },
  };
}

function toAnalysisFailure(err: unknown): CvAnalysisError {
  if (err instanceof AIServiceError) {
    return err.code === "not_configured"
      ? new CvAnalysisError("ai_not_configured", "AI analysis is not configured.")
      : new CvAnalysisError("ai_provider_failure", "AI analysis provider request failed.");
  }
  return new CvAnalysisError("ai_provider_failure", "AI analysis failed unexpectedly.");
}

/**
 * Resolves an Application's Job, extracts the exact CV submitted for that
 * Application, sends only the minimal necessary Job + CV data to the AI
 * service, and returns a validated, normalized, provider-neutral CV
 * analysis. Does not persist anything, does not move the application
 * through any pipeline, and never returns or implies a hiring decision —
 * AI assists, HR decides.
 *
 * Application/CV-extraction failures (ApplicationCvExtractionError,
 * CvStorageError, CvParseError) are NOT re-wrapped — they already carry a
 * safe, specific code and propagate unchanged, per the instruction to
 * reuse existing errors rather than duplicate them. Only failures that
 * originate in this service's own orchestration (job lookup, the AI call,
 * and validating its output) use CvAnalysisError.
 */
export async function analyzeApplicationCv(applicationId: string): Promise<CvAnalysisResult> {
  const startedAt = Date.now();

  try {
    const application = await Application.findById(applicationId).select("job_id");
    if (!application) {
      throw new ApplicationCvExtractionError("application_not_found", "Application not found.");
    }

    const job = await Job.findById(application.job_id).select(
      "title description required_skills experience_level employment_type"
    );
    if (!job) {
      throw new CvAnalysisError("job_not_found", "Job not found for this application.");
    }

    const extraction = await extractApplicationCvText(applicationId);

    const { systemPrompt, userPrompt } = buildCvAnalysisPrompt({
      job: toJobDataForAnalysis(job),
      cvText: extraction.text,
    });

    let aiResponse;
    try {
      aiResponse = await aiService.generate({
        systemPrompt,
        userPrompt,
        temperature: CV_ANALYSIS_TEMPERATURE,
        maxTokens: CV_ANALYSIS_MAX_TOKENS,
        responseFormat: "json_object",
      });
    } catch (err) {
      throw toAnalysisFailure(err);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(aiResponse.content);
    } catch {
      throw new CvAnalysisError("invalid_ai_json", "AI response was not valid JSON.");
    }

    const validation = cvAnalysisResultSchema.safeParse(parsedJson);
    if (!validation.success) {
      throw new CvAnalysisError("invalid_ai_schema", "AI response did not match the expected analysis schema.");
    }

    const result = normalizeCvAnalysisResult(validation.data);

    console.log("[ai] analyzed application CV", {
      applicationId,
      model: aiResponse.model,
      cvCharacterCount: extraction.characterCount,
      skillsFound: result.skills.length,
      requiredSkillsChecked: result.requiredSkillEvidence.length,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (err) {
    const code = err instanceof Error && "code" in err ? (err as { code: unknown }).code : undefined;
    console.error("[ai] failed to analyze application CV", {
      applicationId,
      code,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
