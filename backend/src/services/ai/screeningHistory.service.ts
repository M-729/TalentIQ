import { Application } from "../../models/Application.model";
import { AIScreening, type AIScreeningDoc } from "../../models/AIScreening.model";
import { ApplicationCvExtractionError } from "../../modules/applications/applicationCvExtraction.service";
import { env } from "../../config/env";
import { scoreApplicationMatch } from "./candidateMatch.service";

/**
 * Centralized so a historical AIScreening document can always say which
 * formula produced it, even after the algorithm changes later. Never
 * duplicate this literal elsewhere — import it.
 */
export const SCORE_FORMULA_VERSION = "required_skill_coverage_v1";

// ai.service.ts currently has exactly one active implementation (Groq —
// see ai.service.ts's own comment on why it's a swap point). This is a
// plain constant, not derived from any Groq SDK object, so persisting it
// creates no coupling to the raw provider — it will need updating by hand
// if/when a second provider is ever swapped in.
const AI_PROVIDER = "groq";

/**
 * Runs a full screening for this Application (CV extraction, AI CV
 * analysis, deterministic match scoring — all via the existing
 * scoreApplicationMatch(), never reimplemented here) and persists the
 * result as a new, immutable AIScreening document. Screenings are
 * append-only history: this never updates or overwrites a previous
 * screening for the same Application, even on repeated calls.
 *
 * On any failure (CV extraction, AI analysis, JSON validation, or
 * scoring), no document is created and existing screening history for
 * this Application is left untouched — the underlying error (already a
 * safe, specific one from an existing service) propagates unchanged.
 */
export async function createApplicationScreening(applicationId: string): Promise<AIScreeningDoc> {
  const startedAt = Date.now();

  try {
    const { analysis, match } = await scoreApplicationMatch(applicationId);

    // job_id always comes from the Application's own current job — never
    // accepted from an external caller (there is none in this ticket) and
    // never derived from the AI result. Re-fetched here (rather than
    // reusing a lookup from inside scoreApplicationMatch, which doesn't
    // expose one) only after scoring succeeds, so the common not-found
    // failure paths aren't checked twice — scoreApplicationMatch already
    // throws safely for those.
    const application = await Application.findById(applicationId).select("job_id");
    if (!application) {
      throw new ApplicationCvExtractionError("application_not_found", "Application not found.");
    }

    const screening = await AIScreening.create({
      application_id: application._id,
      job_id: application.job_id,
      analysis,
      match,
      ai_metadata: { provider: AI_PROVIDER, model: env.GROQ_MODEL },
      score_formula_version: SCORE_FORMULA_VERSION,
    });

    console.log("[ai] created application screening", {
      applicationId,
      screeningId: screening.id,
      score: match.score,
      durationMs: Date.now() - startedAt,
    });

    return screening;
  } catch (err) {
    const code = err instanceof Error && "code" in err ? (err as { code: unknown }).code : undefined;
    console.error("[ai] failed to create application screening", {
      applicationId,
      code,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

/**
 * Database read only — never triggers AI, never recalculates a score.
 * Returns null when this Application has no screening history yet.
 */
export async function getLatestApplicationScreening(applicationId: string): Promise<AIScreeningDoc | null> {
  return AIScreening.findOne({ application_id: applicationId }).sort({ created_at: -1 });
}

/**
 * Database read only — never triggers AI, never recalculates a score.
 * Newest first. Returns an empty array when this Application has no
 * screening history yet.
 */
export async function getApplicationScreeningHistory(applicationId: string): Promise<AIScreeningDoc[]> {
  return AIScreening.find({ application_id: applicationId }).sort({ created_at: -1 });
}
