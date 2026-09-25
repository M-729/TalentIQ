import { backfillOfferPublicIds } from "../scripts/backfillOfferPublicIds";
import { Offer } from "../src/models/Offer.model";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";
import type { JobDoc } from "../src/models/Job.model";

async function insertLegacyOffer(job: JobDoc, hr: UserDoc, email: string) {
  const candidate = await Candidate.create({ full_name: "Legacy Candidate", email });
  const application = await Application.create({
    job_id: job.id,
    candidate_id: candidate.id,
    status: "in_process",
    cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
  });

  // Bypasses Offer.model.ts's pre("validate") hook — simulates an Offer
  // created before public_id existed.
  await Offer.collection.insertOne({
    company_id: job.company_id,
    application_id: application._id,
    candidate_id: candidate._id,
    job_id: job._id,
    status: "draft",
    title: "Backend Engineer",
    created_by_user_id: hr._id,
    updated_by_user_id: hr._id,
    is_live: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

describe("backfillOfferPublicIds", () => {
  let company: CompanyDoc;
  let hr: UserDoc;
  let job: JobDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@backfill-offer.test", role: "HR" });
    job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backfill Job", status: "active" });
  });

  it("assigns a public_id to every offer missing one", async () => {
    await insertLegacyOffer(job, hr, "legacy1@backfill-offer.test");
    await insertLegacyOffer(job, hr, "legacy2@backfill-offer.test");

    const result = await backfillOfferPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await Offer.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^offer_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists, and is idempotent on rerun", async () => {
    await insertLegacyOffer(job, hr, "legacy@backfill-offer.test");

    const first = await backfillOfferPublicIds();
    expect(first).toEqual({ inspected: 1, updated: 1, skipped: 0 });

    const assigned = (await Offer.findOne({}))?.public_id;

    const second = await backfillOfferPublicIds();
    expect(second).toEqual({ inspected: 1, updated: 0, skipped: 1 });

    const reread = await Offer.findOne({});
    expect(reread?.public_id).toBe(assigned);
  });
});
