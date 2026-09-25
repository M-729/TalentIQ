import { backfillApplicationPublicIds } from "../scripts/backfillApplicationPublicIds";
import { Application } from "../src/models/Application.model";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";
import type { JobDoc } from "../src/models/Job.model";

const CV_FILE = {
  storage_key: "talentiq/cvs/backfill-test",
  original_name: "resume.pdf",
  mime_type: "application/pdf",
  size_bytes: 100,
};

async function insertLegacyApplication(job: JobDoc, email: string) {
  const candidate = await Candidate.create({ full_name: "Legacy Candidate", email });
  // Bypasses Application.model.ts's pre("validate") hook, simulating an
  // Application created before public_id existed — the same technique
  // backfillJobPublicIds.script.test.ts uses for Job.
  await Application.collection.insertOne({
    job_id: job._id,
    candidate_id: candidate._id,
    status: "applied",
    applied_at: new Date(),
    cv_file: CV_FILE,
    updated_at: new Date(),
  });
}

describe("backfillApplicationPublicIds", () => {
  let company: CompanyDoc;
  let hr: UserDoc;
  let job: JobDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@backfill-application.test", role: "HR" });
    job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backfill Job", status: "active" });
  });

  it("assigns a public_id to every application missing one", async () => {
    await insertLegacyApplication(job, "legacy1@backfill-application.test");
    await insertLegacyApplication(job, "legacy2@backfill-application.test");

    const result = await backfillApplicationPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const applications = await Application.find({});
    for (const application of applications) {
      expect(application.public_id).toMatch(/^app_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists", async () => {
    const candidate = await Candidate.create({ full_name: "Already Migrated", email: "already@backfill-application.test" });
    const alreadyMigrated = await Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: CV_FILE });
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyApplication(job, "still-legacy@backfill-application.test");

    const result = await backfillApplicationPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 1, skipped: 1 });
    const reread = await Application.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);
  });

  it("is idempotent: a second run after a full run updates nothing", async () => {
    await insertLegacyApplication(job, "run-once@backfill-application.test");

    const first = await backfillApplicationPublicIds();
    expect(first).toEqual({ inspected: 1, updated: 1, skipped: 0 });

    const second = await backfillApplicationPublicIds();
    expect(second).toEqual({ inspected: 1, updated: 0, skipped: 1 });
  });

  it("touches no field other than public_id", async () => {
    await insertLegacyApplication(job, "only-public-id@backfill-application.test");

    await backfillApplicationPublicIds();

    const application = await Application.findOne({});
    expect(application?.status).toBe("applied");
    expect(application?.cv_file.original_name).toBe("resume.pdf");
  });
});
