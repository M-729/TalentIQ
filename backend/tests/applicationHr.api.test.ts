import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate, type CandidateDoc } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc, type ApplicationStatus } from "../src/models/Application.model";
import { HiringStep } from "../src/models/HiringStep.model";
import { AIScreening } from "../src/models/AIScreening.model";
import { AIScreeningRun } from "../src/models/AIScreeningRun.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

const CV_FILE = {
  storage_key: "talentiq/cvs/should-never-be-returned",
  original_name: "resume.pdf",
  mime_type: "application/pdf",
  size_bytes: 12345,
};

const VALID_ANALYSIS_SNAPSHOT = {
  summary: "Backend developer with Node.js and TypeScript experience.",
  skills: [{ name: "Node.js" }],
  experience: { yearsMentioned: 5, summary: "5 years." },
  education: [],
  strengths: [],
  gaps: [],
  requiredSkillEvidence: [{ skill: "Node.js", status: "found" as const }],
};

const VALID_MATCH_SNAPSHOT = {
  score: 63,
  scorable: true,
  totalRequiredSkills: 1,
  foundSkills: 1,
  unclearSkills: 0,
  missingSkills: 0,
  matchedSkills: ["Node.js"],
  unclearRequiredSkills: [],
  missingRequiredSkills: [],
  breakdown: [{ skill: "Node.js", status: "found" as const, weight: 1 as const }],
};

async function insertScreening(applicationId: string, jobId: string, overrides: Record<string, unknown> = {}) {
  return AIScreening.create({
    application_id: applicationId,
    job_id: jobId,
    analysis: VALID_ANALYSIS_SNAPSHOT,
    match: VALID_MATCH_SNAPSHOT,
    ai_metadata: { provider: "groq", model: "openai/gpt-oss-120b" },
    score_formula_version: "required_skill_coverage_v1",
    ...overrides,
  });
}

describe("HR Applications Management API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });
  });

  async function createApplication(
    company: CompanyDoc,
    hr: UserDoc,
    options: {
      jobOverrides?: Record<string, unknown>;
      candidateOverrides?: Record<string, unknown>;
      status?: ApplicationStatus;
      applied_at?: Date;
    } = {}
  ): Promise<{ job: JobDoc; candidate: CandidateDoc; application: ApplicationDoc }> {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
      status: "active",
      required_skills: ["Node.js"],
      ...options.jobOverrides,
    });
    const candidate = await Candidate.create({
      full_name: "Taylor Example",
      email: `candidate-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
      ...options.candidateOverrides,
    });
    const application = await Application.create({
      job_id: job.id,
      candidate_id: candidate.id,
      cv_file: CV_FILE,
      status: options.status,
      ...(options.applied_at ? { applied_at: options.applied_at } : {}),
    });
    return { job, candidate, application };
  }

  // ===== AUTH =====
  describe("authentication and role authorization", () => {
    it("rejects an unauthenticated list request with 401", async () => {
      const res = await request(app).get("/api/v1/applications");
      expect(res.status).toBe(401);
    });

    it("rejects an unauthenticated detail request with 401", async () => {
      const { application } = await createApplication(companyA, hrA);
      const res = await request(app).get(`/api/v1/applications/${application.public_id}`);
      expect(res.status).toBe(401);
    });

    it("allows an authenticated HR user", async () => {
      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
    });

    it("allows an authenticated ADMIN user", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(admin, companyA.id));
      expect(res.status).toBe(200);
    });
  });

  // ===== TENANT ISOLATION =====
  describe("tenant isolation", () => {
    it("list returns only applications belonging to the caller's company", async () => {
      await createApplication(companyA, hrA);
      await createApplication(companyA, hrA);
      await createApplication(companyB, hrB);

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.applications).toHaveLength(2);
    });

    it("detail works for a same-company application", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.application.id).toBe(application.id);
    });

    it("returns 404 for a cross-company application detail", async () => {
      const { application } = await createApplication(companyB, hrB);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("returns 404 for a well-formed public_id that doesn't exist", async () => {
      const missingId = `app_${"a".repeat(24)}`;

      const res = await request(app)
        .get(`/api/v1/applications/${missingId}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("returns a same-company application looked up by its public_id", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.application.id).toBe(application.id);
      expect(res.body.application.public_id).toBe(application.public_id);
    });

    // Phase 2 cutover: legacy dual-accept lookup is gone — a raw Mongo
    // ObjectId is now just an invalid id format, not an alternate valid id.
    it("rejects an application looked up by its legacy Mongo ObjectId", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(400);
    });

    it("returns 404 for another company's application looked up by public_id (tenant scoping preserved)", async () => {
      const { application } = await createApplication(companyB, hrB);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("candidate being a global entity does not leak across companies", async () => {
      // The same candidate (a global entity with no company_id of its own)
      // applies to a job in each company — each company must see only
      // their own Application against that shared candidate.
      const candidate = await Candidate.create({ full_name: "Shared Candidate", email: "shared-candidate@test.local" });
      const jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Job A", status: "active" });
      const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Job B", status: "active" });
      await Application.create({ job_id: jobA.id, candidate_id: candidate.id, cv_file: CV_FILE });
      await Application.create({ job_id: jobB.id, candidate_id: candidate.id, cv_file: CV_FILE });

      const resA = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      const resB = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrB, companyB.id));

      expect(resA.body.applications).toHaveLength(1);
      expect(resA.body.applications[0].job.id).toBe(jobA.id);
      expect(resB.body.applications).toHaveLength(1);
      expect(resB.body.applications[0].job.id).toBe(jobB.id);
    });
  });

  // ===== LIST =====
  describe("GET /api/v1/applications", () => {
    it("returns newest applications first by default", async () => {
      const { application: older } = await createApplication(companyA, hrA, {
        applied_at: new Date("2024-01-01T00:00:00.000Z"),
      });
      const { application: newer } = await createApplication(companyA, hrA, {
        applied_at: new Date("2024-02-01T00:00:00.000Z"),
      });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.applications.map((a: { id: string }) => a.id)).toEqual([newer.id, older.id]);
    });

    it("paginates results", async () => {
      for (let i = 0; i < 5; i++) {
        await createApplication(companyA, hrA);
      }

      const res = await request(app)
        .get("/api/v1/applications?page=2&limit=2")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.applications).toHaveLength(2);
      expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    });

    it("accepts the maximum safe limit of 100", async () => {
      const res = await request(app)
        .get("/api/v1/applications?limit=100")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
    });

    it("rejects a limit above the safe maximum", async () => {
      const res = await request(app)
        .get("/api/v1/applications?limit=101")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("filters by status", async () => {
      await createApplication(companyA, hrA, { status: "applied" });
      const { application: hired } = await createApplication(companyA, hrA, { status: "hired" });

      const res = await request(app)
        .get("/api/v1/applications?status=hired")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].id).toBe(hired.id);
    });

    // The jobId filter is a "special attention" case (Job used as an
    // external filter parameter on another resource's list, not Job's own
    // URL) — resolved to Job's real internal id before being used against
    // Application.job_id. Only the Job's public_id resolves (Phase 2).
    it("filters by jobId, restricted to the caller's own company", async () => {
      const { job: jobA1, application: appA1 } = await createApplication(companyA, hrA);
      await createApplication(companyA, hrA); // a second, different job in the same company

      const res = await request(app)
        .get(`/api/v1/applications?jobId=${jobA1.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].id).toBe(appA1.id);
    });

    it("returns 404 when jobId filter references another company's job", async () => {
      const { job: jobB } = await createApplication(companyB, hrB);

      const res = await request(app)
        .get(`/api/v1/applications?jobId=${jobB.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    // Phase 2 cutover: legacy dual-accept lookup is gone for the jobId
    // filter too — a raw Mongo ObjectId is now just an invalid id format.
    it("rejects a jobId filter given as the Job's legacy Mongo ObjectId", async () => {
      const { job: jobA1 } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications?jobId=${jobA1.id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(400);
    });

    it("searches by candidate full name", async () => {
      const { application: match } = await createApplication(companyA, hrA, {
        candidateOverrides: { full_name: "Priya Sharma" },
      });
      await createApplication(companyA, hrA, { candidateOverrides: { full_name: "Jordan Lee" } });

      const res = await request(app)
        .get("/api/v1/applications?search=priya")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].id).toBe(match.id);
    });

    it("searches by candidate email", async () => {
      const { application: match } = await createApplication(companyA, hrA, {
        candidateOverrides: { email: "distinctive.search.target@test.local" },
      });
      await createApplication(companyA, hrA);

      const res = await request(app)
        .get("/api/v1/applications?search=distinctive.search.target")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.applications).toHaveLength(1);
      expect(res.body.applications[0].id).toBe(match.id);
    });

    it("returns an empty array when nothing matches", async () => {
      await createApplication(companyA, hrA);

      const res = await request(app)
        .get("/api/v1/applications?search=no-such-candidate-xyz")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.applications).toEqual([]);
    });
  });

  // ===== PIPELINE STAGE (current_step) IN LIST =====
  describe("GET /api/v1/applications — pipeline stage / current_step", () => {
    // 1. applied + no current step -> New Applicant (the frontend maps
    // this; the backend contract is simply current_step: null).
    it("returns null current_step for an applied application with no current stage", async () => {
      const { application } = await createApplication(companyA, hrA, { status: "applied" });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      const row = res.body.applications.find((a: { id: string }) => a.id === application.id);
      expect(row.current_step).toBeNull();
      expect(row.status).toBe("applied");
    });

    // 2. in_process + Interview step -> actual stage name.
    it("returns the current_step name/type for an in_process application sitting in an interview-type stage", async () => {
      const { job, application } = await createApplication(companyA, hrA);
      const step = await HiringStep.create({ job_id: job.id, name: "Technical Interview", type: "interview", position: 0 });
      await Application.updateOne({ _id: application.id }, { $set: { status: "in_process", current_step_id: step._id } });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      const row = res.body.applications.find((a: { id: string }) => a.id === application.id);
      expect(row.current_step).toEqual({ id: step.id, name: "Technical Interview", type: "interview" });
    });

    // 3. in_process + Assessment step -> actual stage name.
    it("returns the current_step name/type for an in_process application sitting in an assessment-type stage", async () => {
      const { job, application } = await createApplication(companyA, hrA);
      const step = await HiringStep.create({ job_id: job.id, name: "External Assessment", type: "assessment", position: 0 });
      await Application.updateOne({ _id: application.id }, { $set: { status: "in_process", current_step_id: step._id } });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      const row = res.body.applications.find((a: { id: string }) => a.id === application.id);
      expect(row.current_step).toEqual({ id: step.id, name: "External Assessment", type: "assessment" });
    });

    it("reflects a renamed HiringStep immediately in the list, same as detail", async () => {
      const { job, application } = await createApplication(companyA, hrA);
      const step = await HiringStep.create({ job_id: job.id, name: "HR Review", type: "review", position: 0 });
      await Application.updateOne({ _id: application.id }, { $set: { status: "in_process", current_step_id: step._id } });
      await HiringStep.updateOne({ _id: step._id }, { $set: { name: "Initial HR Review" } });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      const row = res.body.applications.find((a: { id: string }) => a.id === application.id);
      expect(row.current_step.name).toBe("Initial HR Review");
    });

    // 4-6. rejected/offered/hired -> Application.status stays the terminal
    // lifecycle value; current_step is whatever it happened to be (the
    // frontend prefers status over current_step for these three).
    it.each(["rejected", "offered", "hired"] as const)(
      "keeps status %s intact regardless of current_step in the list response",
      async (status) => {
        const { job, application } = await createApplication(companyA, hrA);
        const step = await HiringStep.create({ job_id: job.id, name: "Final Interview", type: "interview", position: 0 });
        await Application.updateOne({ _id: application.id }, { $set: { status, current_step_id: step._id } });

        const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

        const row = res.body.applications.find((a: { id: string }) => a.id === application.id);
        expect(row.status).toBe(status);
        expect(row.current_step).toEqual({ id: step.id, name: "Final Interview", type: "interview" });
      }
    );

    // 7. No N+1 stage requests — one batched HiringStep query for the
    // whole page, regardless of how many rows have a current_step.
    it("does not issue one HiringStep query per row (no N+1)", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Engineer", status: "active" });
      const stepA = await HiringStep.create({ job_id: job.id, name: "Application Review", type: "review", position: 0 });
      const stepB = await HiringStep.create({ job_id: job.id, name: "Technical Interview", type: "interview", position: 1 });

      for (const step of [stepA, stepB, stepA]) {
        const candidate = await Candidate.create({
          full_name: "Taylor Example",
          email: `candidate-${new Types.ObjectId().toString()}@test.local`,
        });
        const application = await Application.create({
          job_id: job.id,
          candidate_id: candidate.id,
          cv_file: CV_FILE,
          status: "in_process",
          current_step_id: step._id,
        });
        void application;
      }

      const findSpy = jest.spyOn(HiringStep, "find");
      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledTimes(1);
      findSpy.mockRestore();
    });

    it("does not query HiringStep at all when no row on the page has a current_step", async () => {
      await createApplication(companyA, hrA, { status: "applied" });

      const findSpy = jest.spyOn(HiringStep, "find");
      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(findSpy).not.toHaveBeenCalled();
      findSpy.mockRestore();
    });

    // 8. Existing AI Screening column/data is unaffected by this change.
    it("still returns the screening summary unaffected, alongside current_step", async () => {
      const { job, application } = await createApplication(companyA, hrA);
      const step = await HiringStep.create({ job_id: job.id, name: "Technical Interview", type: "interview", position: 0 });
      await Application.updateOne({ _id: application.id }, { $set: { status: "in_process", current_step_id: step._id } });
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 82 } });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      const row = res.body.applications.find((a: { id: string }) => a.id === application.id);
      expect(row.screening).toEqual({
        status: "completed",
        has_screening: true,
        latest_score: 82,
        latest_screened_at: expect.any(String),
      });
      expect(row.current_step).toEqual({ id: step.id, name: "Technical Interview", type: "interview" });
    });
  });

  // ===== DETAIL =====
  describe("GET /api/v1/applications/:applicationId", () => {
    it("returns candidate context", async () => {
      const { application, candidate } = await createApplication(companyA, hrA, {
        candidateOverrides: { full_name: "Jordan Lee", phone: "+1-555-000-1234", location: "Remote" },
      });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.candidate).toEqual({
        id: candidate.id,
        full_name: "Jordan Lee",
        email: candidate.email,
        phone: "+1-555-000-1234",
        location: "Remote",
      });
    });

    it("returns job context", async () => {
      const { application, job } = await createApplication(companyA, hrA, {
        jobOverrides: { department: "Engineering", required_skills: ["Node.js", "TypeScript"] },
      });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.job.id).toBe(job.id);
      expect(res.body.application.job.title).toBe("Backend Engineer");
      expect(res.body.application.job.department).toBe("Engineering");
      expect(res.body.application.job.required_skills).toEqual(["Node.js", "TypeScript"]);
      expect(res.body.application.job.status).toBe("active");
    });

    it("returns safe CV metadata", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.cv).toEqual({
        original_name: CV_FILE.original_name,
        mime_type: CV_FILE.mime_type,
        size_bytes: CV_FILE.size_bytes,
      });
    });

    it("returns null current_step when the application has no current stage", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.current_step).toBeNull();
    });

    it("returns the live current_step name/type, resolved from the current HiringStep", async () => {
      const { job, application } = await createApplication(companyA, hrA);
      const { HiringStep } = await import("../src/models/HiringStep.model");
      const step = await HiringStep.create({ job_id: job.id, name: "Technical Interview", type: "interview", position: 0 });
      await Application.updateOne({ _id: application.id }, { $set: { status: "in_process", current_step_id: step._id } });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.current_step).toEqual({ id: step.id, name: "Technical Interview", type: "interview" });
    });

    it("reflects a renamed HiringStep immediately (never a frozen snapshot)", async () => {
      const { job, application } = await createApplication(companyA, hrA);
      const { HiringStep } = await import("../src/models/HiringStep.model");
      const step = await HiringStep.create({ job_id: job.id, name: "Technical Interview", type: "interview", position: 0 });
      await Application.updateOne({ _id: application.id }, { $set: { status: "in_process", current_step_id: step._id } });
      await HiringStep.updateOne({ _id: step._id }, { $set: { name: "Engineering Interview" } });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.current_step.name).toBe("Engineering Interview");
    });

    it("never returns the CV storage_key", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(JSON.stringify(res.body)).not.toContain("storage_key");
      expect(JSON.stringify(res.body)).not.toContain("should-never-be-returned");
    });

    it("never returns company_id or created_by", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(JSON.stringify(res.body)).not.toContain("company_id");
      expect(JSON.stringify(res.body)).not.toContain("created_by");
    });
  });

  // ===== SCREENING SUMMARY =====
  describe("screening summary", () => {
    it("reports has_screening: false when no screening exists", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.screening).toEqual({ has_screening: false, status: "not_started" });
    });

    it("reports status: processing while the initial screening is running, in both list and detail", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await AIScreeningRun.create({ application_id: application.id, job_id: job.id, status: "processing", attempt_count: 1 });

      const listRes = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      const detailRes = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(listRes.body.applications[0].screening).toEqual({ status: "processing", has_screening: false });
      expect(detailRes.body.application.screening).toEqual({ status: "processing", has_screening: false });
    });

    // 3/10/11. stale processing becomes retryable; GET list/detail cause zero AI calls
    it("reports status: stale_processing for a processing run stuck past the configured timeout, in both list and detail", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: new Date(Date.now() - 20 * 60 * 1000),
        attempt_count: 1,
      });

      const listRes = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      const detailRes = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      // Both GETs succeed and report the derived status purely from
      // persisted data — if either had attempted a real AI call,
      // GROQ_API_KEY being unconfigured in this test environment would
      // have failed the request outright rather than returning 200 with
      // this exact derived status.
      expect(listRes.status).toBe(200);
      expect(detailRes.status).toBe(200);
      expect(listRes.body.applications[0].screening).toEqual({ status: "stale_processing", has_screening: false });
      expect(detailRes.body.application.screening).toEqual({ status: "stale_processing", has_screening: false });
    });

    // 8/9. stale run + existing successful AIScreening derives completed, in the list/detail read paths too
    it("reports status: completed (never stale_processing) when a completed AIScreening already exists for a stale run", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: new Date(Date.now() - 20 * 60 * 1000),
        attempt_count: 1,
      });
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 77 } });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.screening.status).toBe("completed");
      expect(res.body.application.screening.latest_score).toBe(77);
    });

    it("reports status: failed after the initial screening fails, in both list and detail", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "failed",
        failure_code: "ai_provider_failure",
        failure_message: "The AI provider is temporarily unavailable.",
        attempt_count: 1,
      });

      const listRes = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      const detailRes = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(listRes.body.applications[0].screening).toEqual({ status: "failed", has_screening: false });
      expect(detailRes.body.application.screening).toEqual({ status: "failed", has_screening: false });
      // Never leaks the internal failure_code/failure_message onto the
      // list/detail summary DTO — that lives only in the full screening
      // read path, and even there only ever a safe, mapped message.
      expect(JSON.stringify(listRes.body)).not.toContain("ai_provider_failure");
    });

    it("reports status: completed (derived) for a legacy Application with an existing screening but no run row", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 88 } });
      // Deliberately no AIScreeningRun row — simulates data that predates this feature.
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(0);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.screening.status).toBe("completed");
      expect(res.body.application.screening.latest_score).toBe(88);
    });

    it("returns the latest screening score in the list and detail views", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 63 } });

      const listRes = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      const detailRes = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(listRes.body.applications[0].screening.has_screening).toBe(true);
      expect(listRes.body.applications[0].screening.latest_score).toBe(63);
      expect(detailRes.body.application.screening.latest_score).toBe(63);
    });

    it("returns the latest screening timestamp", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      const screening = await insertScreening(application.id, job.id);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(new Date(res.body.application.screening.latest_screened_at).toISOString()).toBe(
        screening.created_at!.toISOString()
      );
    });

    it("returns the newest screening's score when multiple screenings exist", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 40 } });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 90 } });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.application.screening.latest_score).toBe(90);
    });

    // Listing/detail never triggers AI: GROQ_API_KEY is not configured in
    // the test environment (tests/env.setup.ts), and neither the list nor
    // detail service imports aiService, cvStorage, or
    // screeningHistory.service's createApplicationScreening at all. If
    // either endpoint attempted a real AI call, these requests would fail
    // outright rather than return the exact persisted score below.
    it("listing applications does not call AI (reads persisted data only)", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 63 } });

      const res = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.applications[0].screening.latest_score).toBe(63);
    });

    it("application detail does not call AI (reads persisted data only)", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 63 } });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.application.screening.latest_score).toBe(63);
    });

    it("does not recompute an old screening on repeated reads", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id, { match: { ...VALID_MATCH_SNAPSHOT, score: 63 } });

      const first = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      const second = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(first.body.application.screening.latest_score).toBe(63);
      expect(second.body.application.screening.latest_score).toBe(63);
    });
  });

  // ===== VALIDATION =====
  describe("request validation", () => {
    it("rejects a malformed applicationId with 400", async () => {
      const res = await request(app)
        .get("/api/v1/applications/not-an-object-id")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects a malformed jobId filter with 400", async () => {
      const res = await request(app)
        .get("/api/v1/applications?jobId=not-an-object-id")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects an invalid status filter with 400", async () => {
      const res = await request(app)
        .get("/api/v1/applications?status=not-a-status")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects invalid pagination values with 400", async () => {
      const zeroPage = await request(app)
        .get("/api/v1/applications?page=0")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      const negativeLimit = await request(app)
        .get("/api/v1/applications?limit=-1")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      const nonNumeric = await request(app)
        .get("/api/v1/applications?page=abc")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(zeroPage.status).toBe(400);
      expect(negativeLimit.status).toBe(400);
      expect(nonNumeric.status).toBe(400);
    });
  });

  // ===== SECURITY =====
  describe("security", () => {
    it("never exposes an R2 key or URL anywhere in list or detail responses", async () => {
      const { application } = await createApplication(companyA, hrA);

      const listRes = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      const detailRes = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      for (const body of [listRes.body, detailRes.body]) {
        const serialized = JSON.stringify(body);
        expect(serialized).not.toContain("storage_key");
        expect(serialized).not.toMatch(/r2\.cloudflarestorage\.com/);
        expect(serialized).not.toMatch(/X-Amz-Signature/i);
      }
    });

    it("never exposes raw CV text", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      // The detail DTO only ever includes cv metadata (name/type/size) —
      // confirm no extracted-text-shaped field exists at all.
      expect(res.body.application.cv).not.toHaveProperty("text");
      expect(res.body.application.cv).not.toHaveProperty("extractedText");
    });

    it("never exposes AI prompt or raw provider response content", async () => {
      const { application, job } = await createApplication(companyA, hrA);
      await insertScreening(application.id, job.id);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain("prompt");
      expect(serialized).not.toContain("systemPrompt");
      expect(serialized).not.toContain("choices");
      // The screening summary is score/timestamp only — no analysis payload.
      expect(res.body.application.screening).not.toHaveProperty("analysis");
      expect(res.body.application.screening).not.toHaveProperty("match");
    });

    it("never exposes authentication/token fields", async () => {
      const { application } = await createApplication(companyA, hrA);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const serialized = JSON.stringify(res.body).toLowerCase();
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("token");
      expect(serialized).not.toContain("__v");
    });
  });
});
