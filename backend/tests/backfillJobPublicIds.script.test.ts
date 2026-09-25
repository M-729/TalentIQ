import { backfillJobPublicIds } from "../scripts/backfillJobPublicIds";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

async function insertLegacyJob(company: CompanyDoc, hr: UserDoc, title: string) {
  // Bypasses Job.model.ts's pre("validate") hook (which only fires for
  // save()/create()) — the same technique job.model.test.ts uses to
  // simulate a Job created before public_id existed, i.e. exactly what
  // this script exists to backfill.
  await Job.collection.insertOne({
    company_id: company._id,
    created_by: hr._id,
    title,
    required_skills: [],
    status: "draft",
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

describe("backfillJobPublicIds", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@backfill.test", role: "HR" });
  });

  it("assigns a public_id to every job missing one", async () => {
    await insertLegacyJob(company, hr, "Legacy One");
    await insertLegacyJob(company, hr, "Legacy Two");

    const result = await backfillJobPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });

    const jobs = await Job.find({}).sort({ title: 1 });
    expect(jobs[0]?.public_id).toMatch(/^job_[a-f0-9]{24}$/);
    expect(jobs[1]?.public_id).toMatch(/^job_[a-f0-9]{24}$/);
    expect(jobs[0]?.public_id).not.toBe(jobs[1]?.public_id);
  });

  it("never changes a public_id that already exists", async () => {
    const alreadyMigrated = await Job.create({ company_id: company.id, created_by: hr.id, title: "Already Migrated" });
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyJob(company, hr, "Still Legacy");

    const result = await backfillJobPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 1, skipped: 1 });

    const reread = await Job.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);
  });

  it("touches no field other than public_id", async () => {
    await insertLegacyJob(company, hr, "Only Public Id Changes");

    await backfillJobPublicIds();

    const job = await Job.findOne({ title: "Only Public Id Changes" }).select("+deleted_at");
    expect(job?.title).toBe("Only Public Id Changes");
    expect(job?.status).toBe("draft");
    expect(job?.deleted_at).toBeNull();
    expect(job?.required_skills).toEqual([]);
  });

  it("is idempotent: a second run after a full run updates nothing", async () => {
    await insertLegacyJob(company, hr, "Run Once");

    const first = await backfillJobPublicIds();
    expect(first).toEqual({ inspected: 1, updated: 1, skipped: 0 });

    const assignedPublicId = (await Job.findOne({ title: "Run Once" }))?.public_id;

    const second = await backfillJobPublicIds();
    expect(second).toEqual({ inspected: 1, updated: 0, skipped: 1 });

    const reread = await Job.findOne({ title: "Run Once" });
    expect(reread?.public_id).toBe(assignedPublicId);
  });

  it("reports zero inspected/updated/skipped when there are no jobs at all", async () => {
    const result = await backfillJobPublicIds();
    expect(result).toEqual({ inspected: 0, updated: 0, skipped: 0 });
  });
});
