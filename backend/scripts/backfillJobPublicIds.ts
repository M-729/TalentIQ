/**
 * Assigns public_id to every Job document that doesn't already have one —
 * see Job.model.ts's public_id field doc comment for why these can exist
 * (any Job created before that field was added). New Jobs never need this:
 * they get a public_id automatically on creation via the model's own
 * pre("validate") hook.
 *
 * Idempotent and safe to re-run any number of times — see
 * scripts/lib/backfillPublicId.ts for the shared contract every per-
 * resource backfill script (this one included) relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step —
 * intentionally a manually-triggered, one-off operation. backfillJobPublicIds()
 * itself is exported (and does no connect/disconnect of its own) purely so
 * backend/tests/backfillJobPublicIds.script.test.ts can exercise it against
 * the test database directly; only running this file itself as a script
 * (see the require.main guard below) connects/disconnects and logs.
 *
 * Usage: npm run backfill:job-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { Job } from "../src/models/Job.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillJobPublicIdsResult = BackfillPublicIdResult;

export async function backfillJobPublicIds(): Promise<BackfillJobPublicIdsResult> {
  return backfillPublicId(Job, "job");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillJobPublicIds();

  console.log("[backfillJobPublicIds] inspected:", result.inspected);
  console.log("[backfillJobPublicIds] updated:", result.updated);
  console.log("[backfillJobPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

// Only runs when this file is executed directly (`ts-node
// scripts/backfillJobPublicIds.ts`) — importing backfillJobPublicIds()
// elsewhere (e.g. from a test) never triggers this.
if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillJobPublicIds] failed:", err);
    process.exit(1);
  });
}
