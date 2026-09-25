/**
 * Assigns public_id to every Interview document that doesn't already have
 * one. See backfillJobPublicIds.ts (the reference implementation) and
 * scripts/lib/backfillPublicId.ts for the full idempotency/collision
 * contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:interview-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { Interview } from "../src/models/Interview.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillInterviewPublicIdsResult = BackfillPublicIdResult;

export async function backfillInterviewPublicIds(): Promise<BackfillInterviewPublicIdsResult> {
  return backfillPublicId(Interview, "int");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillInterviewPublicIds();

  console.log("[backfillInterviewPublicIds] inspected:", result.inspected);
  console.log("[backfillInterviewPublicIds] updated:", result.updated);
  console.log("[backfillInterviewPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillInterviewPublicIds] failed:", err);
    process.exit(1);
  });
}
