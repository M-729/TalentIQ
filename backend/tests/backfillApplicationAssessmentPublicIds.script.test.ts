import { backfillApplicationAssessmentPublicIds } from "../scripts/backfillApplicationAssessmentPublicIds";
import { ApplicationAssessment } from "../src/models/ApplicationAssessment.model";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { HiringStep } from "../src/models/HiringStep.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";
import type { JobDoc } from "../src/models/Job.model";

async function insertLegacyAssessment(job: JobDoc, hr: UserDoc, email: string) {
  const candidate = await Candidate.create({ full_name: "Legacy Candidate", email });
  const step = await HiringStep.create({ job_id: job.id, name: `Technical Assessment ${email}`, type: "assessment", position: 0 });
  const application = await Application.create({
    job_id: job.id,
    candidate_id: candidate.id,
    current_step_id: step.id,
    status: "in_process",
    cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
  });

  // Bypasses ApplicationAssessment.model.ts's pre("validate") hook —
  // simulates a record created before public_id existed.
  await ApplicationAssessment.collection.insertOne({
    company_id: job.company_id,
    application_id: application._id,
    job_id: job._id,
    hiring_step_id: step._id,
    name: "Backend Technical Test",
    external_url: "https://external-platform.example/test/abc",
    status: "pending",
    grade: null,
    notes: null,
    created_by_user_id: hr._id,
    updated_by_user_id: hr._id,
    sent_at: null,
    result_recorded_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

describe("backfillApplicationAssessmentPublicIds", () => {
  let company: CompanyDoc;
  let hr: UserDoc;
  let job: JobDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@backfill-assessment.test", role: "HR" });
    job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backfill Job", status: "active" });
  });

  it("assigns a public_id to every assessment missing one", async () => {
    await insertLegacyAssessment(job, hr, "legacy1@backfill-assessment.test");
    await insertLegacyAssessment(job, hr, "legacy2@backfill-assessment.test");

    const result = await backfillApplicationAssessmentPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await ApplicationAssessment.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^assess_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists, and is idempotent on rerun", async () => {
    await insertLegacyAssessment(job, hr, "legacy@backfill-assessment.test");

    const first = await backfillApplicationAssessmentPublicIds();
    expect(first).toEqual({ inspected: 1, updated: 1, skipped: 0 });

    const assigned = (await ApplicationAssessment.findOne({}))?.public_id;

    const second = await backfillApplicationAssessmentPublicIds();
    expect(second).toEqual({ inspected: 1, updated: 0, skipped: 1 });

    const reread = await ApplicationAssessment.findOne({});
    expect(reread?.public_id).toBe(assigned);
  });
});
