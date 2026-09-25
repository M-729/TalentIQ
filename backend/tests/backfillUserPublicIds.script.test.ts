import { backfillUserPublicIds } from "../scripts/backfillUserPublicIds";
import { User } from "../src/models/User.model";
import { createCompany } from "./helpers/factories";
import { hashPassword } from "../src/security/password";
import type { CompanyDoc } from "../src/models/Company.model";

async function insertLegacyUser(company: CompanyDoc, email: string) {
  const password_hash = await hashPassword("Password123!");
  // Bypasses User.model.ts's pre("validate") hook — simulates a User
  // created before public_id existed.
  await User.collection.insertOne({
    company_id: company._id,
    name: "Legacy User",
    email,
    password_hash,
    role: "HR",
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
  });
}

describe("backfillUserPublicIds", () => {
  let company: CompanyDoc;

  beforeEach(async () => {
    company = await createCompany();
  });

  it("assigns a public_id to every user missing one", async () => {
    await insertLegacyUser(company, "legacy1@backfill-user.test");
    await insertLegacyUser(company, "legacy2@backfill-user.test");

    const result = await backfillUserPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await User.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^user_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists, and is idempotent on rerun", async () => {
    const password_hash = await hashPassword("Password123!");
    const alreadyMigrated = await User.create({
      company_id: company.id,
      name: "Already Migrated",
      email: "already@backfill-user.test",
      password_hash,
      role: "HR",
      status: "active",
    });
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyUser(company, "still-legacy@backfill-user.test");

    const first = await backfillUserPublicIds();
    expect(first).toEqual({ inspected: 2, updated: 1, skipped: 1 });

    const reread = await User.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);

    const second = await backfillUserPublicIds();
    expect(second).toEqual({ inspected: 2, updated: 0, skipped: 2 });
  });
});
