import { backfillCompanyInvitationPublicIds } from "../scripts/backfillCompanyInvitationPublicIds";
import { CompanyInvitation } from "../src/models/CompanyInvitation.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

async function insertLegacyInvitation(company: CompanyDoc, hr: UserDoc, email: string) {
  // Bypasses CompanyInvitation.model.ts's pre("validate") hook —
  // simulates an invitation created before public_id existed.
  await CompanyInvitation.collection.insertOne({
    company_id: company._id,
    email,
    role: "HR",
    status: "pending",
    invited_by_user_id: hr._id,
    token_hash: `legacy-hash-${email}`,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    email_status: "sent",
    email_attempt_count: 1,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

describe("backfillCompanyInvitationPublicIds", () => {
  let company: CompanyDoc;
  let admin: UserDoc;

  beforeEach(async () => {
    company = await createCompany();
    admin = await createUser({ companyId: company.id, email: "admin@backfill-invitation.test", role: "ADMIN" });
  });

  it("assigns a public_id to every invitation missing one, never touching token_hash", async () => {
    await insertLegacyInvitation(company, admin, "legacy1@backfill-invitation.test");
    await insertLegacyInvitation(company, admin, "legacy2@backfill-invitation.test");

    const result = await backfillCompanyInvitationPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await CompanyInvitation.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^invite_[a-f0-9]{24}$/);
    }
    expect(docs.map((d) => d.token_hash).sort()).toEqual(
      ["legacy-hash-legacy1@backfill-invitation.test", "legacy-hash-legacy2@backfill-invitation.test"].sort()
    );
  });

  it("never changes a public_id that already exists, and is idempotent on rerun", async () => {
    const alreadyMigrated = await CompanyInvitation.create({
      company_id: company.id,
      email: "already@backfill-invitation.test",
      role: "HR",
      invited_by_user_id: admin.id,
      token_hash: "already-hash",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyInvitation(company, admin, "still-legacy@backfill-invitation.test");

    const first = await backfillCompanyInvitationPublicIds();
    expect(first).toEqual({ inspected: 2, updated: 1, skipped: 1 });

    const reread = await CompanyInvitation.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);

    const second = await backfillCompanyInvitationPublicIds();
    expect(second).toEqual({ inspected: 2, updated: 0, skipped: 2 });
  });
});
