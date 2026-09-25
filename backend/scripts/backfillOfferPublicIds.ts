/**
 * Assigns public_id to every Offer document that doesn't already have
 * one. See backfillJobPublicIds.ts (the reference implementation) and
 * scripts/lib/backfillPublicId.ts for the full idempotency/collision
 * contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:offer-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { Offer } from "../src/models/Offer.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillOfferPublicIdsResult = BackfillPublicIdResult;

export async function backfillOfferPublicIds(): Promise<BackfillOfferPublicIdsResult> {
  return backfillPublicId(Offer, "offer");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillOfferPublicIds();

  console.log("[backfillOfferPublicIds] inspected:", result.inspected);
  console.log("[backfillOfferPublicIds] updated:", result.updated);
  console.log("[backfillOfferPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillOfferPublicIds] failed:", err);
    process.exit(1);
  });
}
