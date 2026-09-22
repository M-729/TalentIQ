import request from "supertest";
import path from "node:path";
import { createApp } from "../src/app";
import { Job } from "../src/models/Job.model";
import { Application } from "../src/models/Application.model";
import { AIScreeningRun } from "../src/models/AIScreeningRun.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Regression guard for this ticket's explicit rule: submitting a public
// application triggers the initial AI screening automatically, exactly
// once, WITHOUT the candidate's HTTP response ever waiting for it — see
// application.service.ts's submitPublicApplication and
// screeningRun.service.ts's triggerInitialScreeningInBackground. This file
// previously guarded the OLD (pre-automatic-screening) behavior of never
// triggering AI at all; that behavior was an explicit, intentional target
// of this ticket, not something to keep locked in.
jest.mock("../src/services/storage/cvStorage.service", () => ({
  cvStorage: { upload: jest.fn(), delete: jest.fn(), getSignedDownloadUrl: jest.fn(), download: jest.fn() },
}));
jest.mock("../src/modules/applications/cvFileSignature", () => ({
  detectCvFileType: jest.fn(async (buffer: Buffer) => {
    if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";
    return null;
  }),
}));
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
  getLatestApplicationScreening: jest.fn(),
  getApplicationScreeningHistory: jest.fn(),
}));

import { cvStorage } from "../src/services/storage/cvStorage.service";
import { createApplicationScreening } from "../src/services/ai/screeningHistory.service";

const app = createApp();
const FIXTURES = path.join(__dirname, "fixtures");

function screeningFixture() {
  return {
    id: "screening-1",
    application_id: "app-1",
    job_id: "job-1",
    analysis: {
      summary: "Solid candidate.",
      skills: [],
      experience: { yearsMentioned: null, summary: "" },
      education: [],
      strengths: [],
      gaps: [],
      requiredSkillEvidence: [],
    },
    match: {
      score: 80,
      scorable: true,
      totalRequiredSkills: 1,
      foundSkills: 1,
      unclearSkills: 0,
      missingSkills: 0,
      matchedSkills: [],
      unclearRequiredSkills: [],
      missingRequiredSkills: [],
      breakdown: [],
    },
    ai_metadata: { provider: "groq", model: "test-model" },
    score_formula_version: "required_skill_coverage_v1",
    created_at: new Date(),
  };
}

/** No built-in async waitFor in Jest — a minimal, short poll for the background trigger's effect to land. */
async function pollUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000, intervalMs = 10): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("pollUntil: timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe("regression: public application submission triggers automatic AI screening without blocking the response", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    (cvStorage.upload as jest.Mock).mockReset().mockResolvedValue({
      storage_key: "talentiq/cvs/regression-test",
      original_name: "resume.pdf",
      mime_type: "application/pdf",
      size_bytes: 719,
    });
    (createApplicationScreening as jest.Mock).mockReset();
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@no-auto-screening.test", role: "HR" });
  });

  it("returns a successful response without waiting for AI screening to complete", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });

    // Never resolves during this test — if the response awaited it, this
    // request would hang past the test timeout instead of completing.
    let resolveScreening: (value: unknown) => void = () => {};
    (createApplicationScreening as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveScreening = resolve;
      })
    );

    const res = await request(app)
      .post(`/api/v1/public/jobs/${job.id}/applications`)
      .field("full_name", "Jane Candidate")
      .field("email", "jane.candidate@example.test")
      .attach("cv", path.join(FIXTURES, "sample.pdf"));

    expect(res.status).toBe(201);

    // Resolve the still-pending mock and wait for the background chain to
    // fully settle before this test ends — otherwise it can still be
    // writing to the database (afterEach only clears collections, it does
    // not wait for in-flight promises from a previous test) when the NEXT
    // test starts, contaminating it.
    resolveScreening(screeningFixture());
    const application = await pollUntilFound(() => Application.findOne({}).sort({ _id: -1 }));
    await pollUntil(async () => (await AIScreeningRun.findOne({ application_id: application._id }))?.status === "completed");
  });

  it("eventually calls createApplicationScreening exactly once in the background", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });
    (createApplicationScreening as jest.Mock).mockResolvedValue(screeningFixture());

    const res = await request(app)
      .post(`/api/v1/public/jobs/${job.id}/applications`)
      .field("full_name", "Jane Candidate")
      .field("email", "jane.background@example.test")
      .attach("cv", path.join(FIXTURES, "sample.pdf"));

    expect(res.status).toBe(201);

    await pollUntil(() => (createApplicationScreening as jest.Mock).mock.calls.length > 0);
    expect(createApplicationScreening).toHaveBeenCalledTimes(1);

    const candidateApplication = await Application.findOne({}).sort({ _id: -1 });
    expect((createApplicationScreening as jest.Mock).mock.calls[0]![0]).toBe(candidateApplication!.id);
  });

  it("persists a completed AIScreeningRun once the background screening succeeds", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });
    (createApplicationScreening as jest.Mock).mockResolvedValue(screeningFixture());

    await request(app)
      .post(`/api/v1/public/jobs/${job.id}/applications`)
      .field("full_name", "Jane Candidate")
      .field("email", "jane.persisted@example.test")
      .attach("cv", path.join(FIXTURES, "sample.pdf"));

    const application = await pollUntilFound(() => Application.findOne({}).sort({ _id: -1 }));
    await pollUntil(async () => (await AIScreeningRun.findOne({ application_id: application!._id }))?.status === "completed");

    const run = await AIScreeningRun.findOne({ application_id: application!._id });
    expect(run?.status).toBe("completed");
    expect(run?.attempt_count).toBe(1);
  });

  it("does not fail the candidate's application when the background screening itself fails", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });
    (createApplicationScreening as jest.Mock).mockRejectedValue(new Error("simulated screening failure"));

    const res = await request(app)
      .post(`/api/v1/public/jobs/${job.id}/applications`)
      .field("full_name", "Jane Candidate")
      .field("email", "jane.failure@example.test")
      .attach("cv", path.join(FIXTURES, "sample.pdf"));

    expect(res.status).toBe(201);

    const application = await Application.findOne({ "cv_file.original_name": { $exists: true } }).sort({ _id: -1 });
    expect(application).not.toBeNull();

    await pollUntil(async () => (await AIScreeningRun.findOne({ application_id: application!._id }))?.status === "failed");
    const run = await AIScreeningRun.findOne({ application_id: application!._id });
    expect(run?.status).toBe("failed");
  });
});

async function pollUntilFound<T>(fn: () => Promise<T | null>, timeoutMs = 2000, intervalMs = 10): Promise<T> {
  const start = Date.now();
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() - start > timeoutMs) {
      throw new Error("pollUntilFound: timed out waiting for a result");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
