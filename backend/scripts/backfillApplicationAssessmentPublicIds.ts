/**
 * Assigns public_id to every ApplicationAssessment document that doesn't
 * already have one. See backfillJobPublicIds.ts (the reference
 * implementation) and scripts/lib/backfillPublicId.ts for the full
 * idempotency/collision contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:assessment-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { ApplicationAssessment } from "../src/models/ApplicationAssessment.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillApplicationAssessmentPublicIdsResult = BackfillPublicIdResult;

export async function backfillApplicationAssessmentPublicIds(): Promise<BackfillApplicationAssessmentPublicIdsResult> {
  return backfillPublicId(ApplicationAssessment, "assess");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillApplicationAssessmentPublicIds();

  console.log("[backfillApplicationAssessmentPublicIds] inspected:", result.inspected);
  console.log("[backfillApplicationAssessmentPublicIds] updated:", result.updated);
  console.log("[backfillApplicationAssessmentPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillApplicationAssessmentPublicIds] failed:", err);
    process.exit(1);
  });
}
