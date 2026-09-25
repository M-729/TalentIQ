/**
 * Assigns public_id to every Application document that doesn't already
 * have one. See backfillJobPublicIds.ts (the reference implementation)
 * and scripts/lib/backfillPublicId.ts for the full idempotency/collision
 * contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:application-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { Application } from "../src/models/Application.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillApplicationPublicIdsResult = BackfillPublicIdResult;

export async function backfillApplicationPublicIds(): Promise<BackfillApplicationPublicIdsResult> {
  return backfillPublicId(Application, "app");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillApplicationPublicIds();

  console.log("[backfillApplicationPublicIds] inspected:", result.inspected);
  console.log("[backfillApplicationPublicIds] updated:", result.updated);
  console.log("[backfillApplicationPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillApplicationPublicIds] failed:", err);
    process.exit(1);
  });
}
