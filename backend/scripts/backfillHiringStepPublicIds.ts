/**
 * Assigns public_id to every HiringStep document that doesn't already
 * have one. See backfillJobPublicIds.ts (the reference implementation)
 * and scripts/lib/backfillPublicId.ts for the full idempotency/collision
 * contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:hiring-step-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { HiringStep } from "../src/models/HiringStep.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillHiringStepPublicIdsResult = BackfillPublicIdResult;

export async function backfillHiringStepPublicIds(): Promise<BackfillHiringStepPublicIdsResult> {
  return backfillPublicId(HiringStep, "step");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillHiringStepPublicIds();

  console.log("[backfillHiringStepPublicIds] inspected:", result.inspected);
  console.log("[backfillHiringStepPublicIds] updated:", result.updated);
  console.log("[backfillHiringStepPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillHiringStepPublicIds] failed:", err);
    process.exit(1);
  });
}
