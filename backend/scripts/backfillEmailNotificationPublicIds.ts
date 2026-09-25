/**
 * Assigns public_id to every EmailNotification document that doesn't
 * already have one. See backfillJobPublicIds.ts (the reference
 * implementation) and scripts/lib/backfillPublicId.ts for the full
 * idempotency/collision contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:email-notification-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { EmailNotification } from "../src/models/EmailNotification.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillEmailNotificationPublicIdsResult = BackfillPublicIdResult;

export async function backfillEmailNotificationPublicIds(): Promise<BackfillEmailNotificationPublicIdsResult> {
  return backfillPublicId(EmailNotification, "notif");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillEmailNotificationPublicIds();

  console.log("[backfillEmailNotificationPublicIds] inspected:", result.inspected);
  console.log("[backfillEmailNotificationPublicIds] updated:", result.updated);
  console.log("[backfillEmailNotificationPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillEmailNotificationPublicIds] failed:", err);
    process.exit(1);
  });
}
