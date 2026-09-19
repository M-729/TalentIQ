import type { AIScreeningDoc } from "../../models/AIScreening.model";
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
 */

export async function createScreening(applicationId: string, companyId: string): Promise<AIScreeningDoc> {
  await getAccessibleApplication(applicationId, companyId);

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
