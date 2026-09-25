/**
 * Assigns public_id to every CompanyInvitation document that doesn't
 * already have one. This is the ADMIN-facing Pending Invitations list id
 * only — never the invitee's own accept token (token_hash), which this
 * script never reads or touches. See backfillJobPublicIds.ts (the
 * reference implementation) and scripts/lib/backfillPublicId.ts for the
 * full idempotency/collision contract this relies on.
 *
 * Does NOT run automatically as part of any deploy/build/start step.
 *
 * Usage: npm run backfill:company-invitation-public-ids
 */
import { connectDB, disconnectDB } from "../src/config/db";
import { CompanyInvitation } from "../src/models/CompanyInvitation.model";
import { backfillPublicId, type BackfillPublicIdResult } from "./lib/backfillPublicId";

export type BackfillCompanyInvitationPublicIdsResult = BackfillPublicIdResult;

export async function backfillCompanyInvitationPublicIds(): Promise<BackfillCompanyInvitationPublicIdsResult> {
  return backfillPublicId(CompanyInvitation, "invite");
}

async function run(): Promise<void> {
  await connectDB();
  const result = await backfillCompanyInvitationPublicIds();

  console.log("[backfillCompanyInvitationPublicIds] inspected:", result.inspected);
  console.log("[backfillCompanyInvitationPublicIds] updated:", result.updated);
  console.log("[backfillCompanyInvitationPublicIds] skipped (already had public_id):", result.skipped);

  await disconnectDB();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("[backfillCompanyInvitationPublicIds] failed:", err);
    process.exit(1);
  });
}
