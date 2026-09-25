import type { AIScreeningDoc } from "../../models/AIScreening.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { ConflictError } from "../../security/AppError";
import { getAccessibleApplication } from "../applications/applicationAccess.service";
import {
  getApplicationScreeningHistory,
  getLatestApplicationScreening,
} from "../../services/ai/screeningHistory.service";
import {
  getEffectiveScreeningState,
  reserveScreeningRunForProcessing,
  runAndFinalizeScreening,
  type ReportedScreeningStatus,
} from "../../services/ai/screeningRun.service";
import { mapScreeningError } from "./screening.errors";

/**
 * Every one of these three functions performs company authorization
 * (getAccessibleApplication) BEFORE doing anything else — for
 * createScreening in particular, this is what guarantees a cross-company
 * request never reaches createApplicationScreening(), and therefore never
 * triggers a CV download from R2 or a Groq call. getAccessibleApplication
 * itself does no AI/CV work, so this ordering costs nothing extra beyond
 * one authorization-only Application/Job lookup.
 *
 * None of these duplicate CV extraction, AI analysis, or scoring logic —
 * they only add the HTTP-layer concerns (tenant authorization, safe error
 * mapping) on top of the existing screeningHistory.service.ts functions.
 *
 * getAccessibleApplication() deliberately does NOT exclude a soft-deleted
 * Job (see NOT_DELETED_JOB_FILTER's doc comment in Job.model.ts) — reading
 * existing screening history for an Application must keep working after
 * its Job is later soft-deleted. Creating a brand-new screening is
 * different: only createScreening adds its own explicit deleted-Job check
 * below, blocking it before any CV/R2/Groq work is attempted.
 */

/**
 * The single HR-facing "run the initial screening now" action — covers
 * both this ticket's "Start Screening" (a legacy Application with no run
 * row yet) and "Retry Screening" (an existing run currently "failed")
 * cases identically, since both are really "attempt the one initial
 * screening now" from a starting state that allows it. Concurrency and
 * the "not available when pending/processing/completed" rule are both
 * enforced by reserveScreeningRunForProcessing — this function adds only
 * the HTTP-layer concerns (tenant authorization, active-Job gate, safe
 * error mapping) on top of it, exactly as it already did for the
 * pre-existing createApplicationScreening call.
 */
export async function createScreening(applicationId: string, companyId: string): Promise<AIScreeningDoc> {
  const application = await getAccessibleApplication(applicationId, companyId);

  const jobIsAvailable = await Job.exists({ _id: application.job_id, ...NOT_DELETED_JOB_FILTER });
  if (!jobIsAvailable) {
    throw new ConflictError("This job has been deleted; new screenings can no longer be created for it.");
  }

  try {
    const run = await reserveScreeningRunForProcessing(application.id, application.job_id.toString());
    return await runAndFinalizeScreening(run);
  } catch (err) {
    throw mapScreeningError(err);
  }
}

export interface LatestScreeningResult {
  screening: AIScreeningDoc | null;
  /** The current initial-screening lifecycle state — see screeningRun.service.ts's ReportedScreeningStatus/resolveReportedStatus for exactly how this is derived (including stale-processing detection and the persisted-success-wins rule). */
  status: ReportedScreeningStatus;
}

export async function getLatestScreening(applicationId: string, companyId: string): Promise<LatestScreeningResult> {
  const application = await getAccessibleApplication(applicationId, companyId);

  try {
    const [screening, state] = await Promise.all([
      getLatestApplicationScreening(application.id),
      getEffectiveScreeningState(application.id),
    ]);
    return { screening, status: state.status };
  } catch (err) {
    throw mapScreeningError(err);
  }
}

export async function getScreeningHistory(applicationId: string, companyId: string): Promise<AIScreeningDoc[]> {
  const application = await getAccessibleApplication(applicationId, companyId);

  try {
    return await getApplicationScreeningHistory(application.id);
  } catch (err) {
    throw mapScreeningError(err);
  }
}
