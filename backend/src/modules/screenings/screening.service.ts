import type { AIScreeningDoc } from "../../models/AIScreening.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { ConflictError } from "../../security/AppError";
import { getAccessibleApplication } from "../applications/applicationAccess.service";
import {
  createApplicationScreening,
  getApplicationScreeningHistory,
  getLatestApplicationScreening,
} from "../../services/ai/screeningHistory.service";
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

export async function createScreening(applicationId: string, companyId: string): Promise<AIScreeningDoc> {
  const application = await getAccessibleApplication(applicationId, companyId);

  const jobIsAvailable = await Job.exists({ _id: application.job_id, ...NOT_DELETED_JOB_FILTER });
  if (!jobIsAvailable) {
    throw new ConflictError("This job has been deleted; new screenings can no longer be created for it.");
  }

  try {
    return await createApplicationScreening(applicationId);
  } catch (err) {
    throw mapScreeningError(err);
  }
}

export async function getLatestScreening(applicationId: string, companyId: string): Promise<AIScreeningDoc | null> {
  await getAccessibleApplication(applicationId, companyId);

  try {
    return await getLatestApplicationScreening(applicationId);
  } catch (err) {
    throw mapScreeningError(err);
  }
}

export async function getScreeningHistory(applicationId: string, companyId: string): Promise<AIScreeningDoc[]> {
  await getAccessibleApplication(applicationId, companyId);

  try {
    return await getApplicationScreeningHistory(applicationId);
  } catch (err) {
    throw mapScreeningError(err);
  }
}
