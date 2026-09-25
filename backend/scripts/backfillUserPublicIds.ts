/**
 * Assigns public_id to every User document that doesn't already have
 * one. This is only ever used by the Team Settings Deactivate/Reactivate
 * path — never authentication, which continues to use the real Mongo
 * _id (the JWT's own `sub` claim) exclusively. See backfillJobPublicIds.ts
 * (the reference implementation) and scripts/lib/backfillPublicId.ts for
 * the full idempotency/collision contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:user-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { User } from "../src/models/User.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillUserPublicIdsResult = BackfillPublicIdResult;

export async function backfillUserPublicIds(): Promise<BackfillUserPublicIdsResult> {
  return backfillPublicId(User, "user");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillUserPublicIds();

  console.log("[backfillUserPublicIds] inspected:", result.inspected);
  console.log("[backfillUserPublicIds] updated:", result.updated);
  console.log("[backfillUserPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillUserPublicIds] failed:", err);
    process.exit(1);
  });
}
