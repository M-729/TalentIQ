import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { AIScreening } from "../src/models/AIScreening.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function boardUrl(jobId: string) {
  return `/api/v1/jobs/${jobId}/hiring-pipeline`;
}

function screeningFixtureFor(applicationId: string, jobId: string, score: number) {
  return {
    application_id: applicationId,
    job_id: jobId,
    analysis: {
      summary: "Backend developer with Node.js experience.",
      experience: { yearsMentioned: 5, summary: "5 years." },
    },
    match: { score, scorable: true, totalRequiredSkills: 1, foundSkills: 1, unclearSkills: 0, missingSkills: 0 },
    ai_metadata: { provider: "groq" },
    score_formula_version: "required_skill_coverage_v1",
  };
}

describe("Hiring Pipeline Board API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let review: HiringStepDoc;
  let interview: HiringStepDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Software Engineer", status: "active" });
    review = await HiringStep.create({ job_id: jobA.id, name: "Application Review", type: "review", position: 0 });
    interview = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 1 });
  });

  async function createApplication(overrides: Record<string, unknown> = {}) {
    const candidate = await Candidate.create({
      full_name: "Sarah Ahmed",
      email: `sarah-${new Types.ObjectId().toString()}@candidate.test`,
    });
    return Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      ...overrides,
    });
  }

  // ===== AUTH / TENANCY =====
  describe("auth and tenancy", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const res = await request(app).get(boardUrl(jobA.id));
      expect(res.status).toBe(401);
    });

    it("allows an authenticated HR user in the same company", async () => {
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
    });

    it("allows an authenticated ADMIN user in the same company", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(admin, companyA.id));
      expect(res.status).toBe(200);
    });

    it("returns 404 for a cross-company Job", async () => {
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent Job", async () => {
      const res = await request(app)
        .get(boardUrl(new Types.ObjectId().toString()))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed jobId", async () => {
      const res = await request(app)
        .get(boardUrl("not-an-object-id"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("returns 404 for a soft-deleted Job", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });
  });

  // ===== JOB / STAGES =====
  describe("job summary and stages", () => {
    it("returns a safe Job summary", async () => {
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.job).toEqual({ id: jobA.id, title: "Software Engineer", status: "active" });
    });

    it("returns stages ordered by position ascending", async () => {
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.stages.map((s: { name: string }) => s.name)).toEqual(["Application Review", "Technical Interview"]);
    });

    it("stage DTO contains only safe fields", async () => {
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(Object.keys(res.body.stages[0]).sort()).toEqual(
        ["id", "name", "type", "description", "position", "count", "applications"].sort()
      );
    });

    it("returns an empty stages array for a Job with zero configured HiringSteps", async () => {
      const bareJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Bare Job", status: "active" });
      const res = await request(app).get(boardUrl(bareJob.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.stages).toEqual([]);
    });

    it("allows board retrieval for a closed (but not deleted) Job", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.job.status).toBe("closed");
    });
  });

  // ===== UNASSIGNED =====
  describe("unassigned (New Applicants)", () => {
    it("includes an applied application with a null current_step in unassigned", async () => {
      const application = await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.unassigned.applications.map((a: { id: string }) => a.id)).toContain(application.id);
    });

    it("reports the correct unassigned count", async () => {
      await createApplication();
      await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.unassigned.count).toBe(2);
      expect(res.body.unassigned.applications).toHaveLength(2);
    });

    it("returns multiple unassigned applications", async () => {
      const a = await createApplication();
      const b = await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const ids = res.body.unassigned.applications.map((x: { id: string }) => x.id);
      expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    });

    it("orders unassigned applications deterministically (applied_at ascending, oldest first)", async () => {
      const older = await createApplication({ applied_at: new Date("2024-01-01T00:00:00.000Z") });
      const newer = await createApplication({ applied_at: new Date("2024-02-01T00:00:00.000Z") });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.unassigned.applications.map((a: { id: string }) => a.id)).toEqual([older.id, newer.id]);
    });

    it("includes correct candidate context", async () => {
      const candidate = await Candidate.create({ full_name: "Priya Sharma", email: "priya@candidate.test" });
      await Application.create({
        job_id: jobA.id,
        candidate_id: candidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
      });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.unassigned.applications[0].candidate).toEqual({
        id: candidate.id,
        full_name: "Priya Sharma",
        email: "priya@candidate.test",
      });
    });
  });

  // ===== STAGE APPLICATIONS =====
  describe("stage columns", () => {
    it("places an in_process application only in its matching stage", async () => {
      const inReview = await createApplication({ status: "in_process", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const reviewStage = res.body.stages.find((s: { id: string }) => s.id === review.id);
      const interviewStage = res.body.stages.find((s: { id: string }) => s.id === interview.id);
      expect(reviewStage.applications.map((a: { id: string }) => a.id)).toEqual([inReview.id]);
      expect(interviewStage.applications).toEqual([]);
    });

    it("places an in_process application only in stage B when assigned to stage B", async () => {
      const inInterview = await createApplication({ status: "in_process", current_step_id: interview._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const interviewStage = res.body.stages.find((s: { id: string }) => s.id === interview.id);
      expect(interviewStage.applications.map((a: { id: string }) => a.id)).toEqual([inInterview.id]);
    });

    it("reports correct per-stage counts", async () => {
      await createApplication({ status: "in_process", current_step_id: review._id });
      await createApplication({ status: "in_process", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const reviewStage = res.body.stages.find((s: { id: string }) => s.id === review.id);
      expect(reviewStage.count).toBe(2);
    });

    it("never duplicates an application across columns", async () => {
      const application = await createApplication({ status: "in_process", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const allIds = [
        ...res.body.unassigned.applications.map((a: { id: string }) => a.id),
        ...res.body.stages.flatMap((s: { applications: { id: string }[] }) => s.applications.map((a) => a.id)),
        ...res.body.needs_attention.map((a: { id: string }) => a.id),
      ];
      expect(allIds.filter((id) => id === application.id)).toHaveLength(1);
    });

    it("does not silently accept a current_step from another Job's stage", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Other Job", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: otherJob.id, name: "Foreign Stage", type: "review", position: 0 });
      const application = await createApplication({ status: "in_process", current_step_id: foreignStep._id });

      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      for (const stage of res.body.stages) {
        expect(stage.applications.map((a: { id: string }) => a.id)).not.toContain(application.id);
      }
      expect(res.body.needs_attention.map((a: { id: string }) => a.id)).toContain(application.id);
    });

    it("orders applications within a stage deterministically (applied_at ascending)", async () => {
      const older = await createApplication({
        status: "in_process",
        current_step_id: review._id,
        applied_at: new Date("2024-01-01T00:00:00.000Z"),
      });
      const newer = await createApplication({
        status: "in_process",
        current_step_id: review._id,
        applied_at: new Date("2024-02-01T00:00:00.000Z"),
      });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const reviewStage = res.body.stages.find((s: { id: string }) => s.id === review.id);
      expect(reviewStage.applications.map((a: { id: string }) => a.id)).toEqual([older.id, newer.id]);
    });
  });

  // ===== TERMINAL =====
  describe("terminal/outcome statuses", () => {
    it("excludes rejected applications from the active board", async () => {
      const rejected = await createApplication({ status: "rejected", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const allIds = [
        ...res.body.unassigned.applications.map((a: { id: string }) => a.id),
        ...res.body.stages.flatMap((s: { applications: { id: string }[] }) => s.applications.map((a) => a.id)),
        ...res.body.needs_attention.map((a: { id: string }) => a.id),
      ];
      expect(allIds).not.toContain(rejected.id);
    });

    it("excludes offered applications from the active board", async () => {
      const offered = await createApplication({ status: "offered", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const allIds = [
        ...res.body.unassigned.applications.map((a: { id: string }) => a.id),
        ...res.body.stages.flatMap((s: { applications: { id: string }[] }) => s.applications.map((a) => a.id)),
      ];
      expect(allIds).not.toContain(offered.id);
    });

    it("excludes hired applications from the active board", async () => {
      const hired = await createApplication({ status: "hired", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const allIds = [
        ...res.body.unassigned.applications.map((a: { id: string }) => a.id),
        ...res.body.stages.flatMap((s: { applications: { id: string }[] }) => s.applications.map((a) => a.id)),
      ];
      expect(allIds).not.toContain(hired.id);
    });
  });

  // ===== SCREENING =====
  describe("screening summary", () => {
    it("shows has_screening=false and no fake score for an unscreened application", async () => {
      await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const card = res.body.unassigned.applications[0];
      expect(card.screening.has_screening).toBe(false);
      expect(card.screening.latest_score).toBeUndefined();
    });

    it("returns the latest screening summary for a screened application", async () => {
      const application = await createApplication();
      await AIScreening.create(screeningFixtureFor(application.id, jobA.id, 75));
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const card = res.body.unassigned.applications[0];
      expect(card.screening).toEqual({
        has_screening: true,
        latest_score: 75,
        latest_screened_at: expect.any(String),
      });
    });

    it("returns the newest screening when multiple exist", async () => {
      const application = await createApplication();
      await AIScreening.create({ ...screeningFixtureFor(application.id, jobA.id, 40), created_at: new Date("2024-01-01") });
      await AIScreening.create({ ...screeningFixtureFor(application.id, jobA.id, 90), created_at: new Date("2024-02-01") });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.unassigned.applications[0].screening.latest_score).toBe(90);
    });
  });

  // ===== SECURITY / DTO =====
  describe("security and safe serialization", () => {
    it("never exposes CV storage_key or raw CV data", async () => {
      await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(JSON.stringify(res.body)).not.toMatch(/storage_key|cv_file|original_name|mime_type/i);
    });

    it("never exposes company_id or other Mongo internals", async () => {
      await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(JSON.stringify(res.body)).not.toMatch(/company_id|created_by|__v/i);
    });

    it("never exposes AI prompt/provider raw response or analysis body", async () => {
      const application = await createApplication();
      await AIScreening.create(screeningFixtureFor(application.id, jobA.id, 60));
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(JSON.stringify(res.body)).not.toMatch(/analysis|ai_metadata|prompt|provider/i);
    });

    it("only exposes safe candidate fields", async () => {
      await createApplication();
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(Object.keys(res.body.unassigned.applications[0].candidate).sort()).toEqual(["id", "full_name", "email"].sort());
    });
  });

  // ===== EMPTY =====
  describe("empty board", () => {
    it("returns empty unassigned/stage lists when there are zero applications", async () => {
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.unassigned).toEqual({ count: 0, applications: [] });
      for (const stage of res.body.stages) {
        expect(stage.count).toBe(0);
        expect(stage.applications).toEqual([]);
      }
    });

    it("still returns unassigned applicants for a Job with zero configured stages", async () => {
      const bareJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Bare Job", status: "active" });
      const candidate = await Candidate.create({ full_name: "No Pipeline Yet", email: "nopipeline@candidate.test" });
      await Application.create({
        job_id: bareJob.id,
        candidate_id: candidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
      });

      const res = await request(app).get(boardUrl(bareJob.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.stages).toEqual([]);
      expect(res.body.unassigned.count).toBe(1);
    });
  });

  // ===== INCONSISTENCY =====
  describe("inconsistent/legacy data", () => {
    it("routes in_process + null current_step to needs_attention", async () => {
      const application = await createApplication({ status: "in_process", current_step_id: null });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.unassigned.applications.map((a: { id: string }) => a.id)).not.toContain(application.id);
      expect(res.body.needs_attention.map((a: { id: string }) => a.id)).toContain(application.id);
    });

    it("routes applied + non-null current_step to needs_attention", async () => {
      const application = await createApplication({ status: "applied", current_step_id: review._id });
      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const reviewStage = res.body.stages.find((s: { id: string }) => s.id === review.id);
      expect(reviewStage.applications.map((a: { id: string }) => a.id)).not.toContain(application.id);
      expect(res.body.needs_attention.map((a: { id: string }) => a.id)).toContain(application.id);
    });

    it("routes a wrong-Job current_step reference to needs_attention safely (covered above) and includes current_step_id in that entry", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Other Job", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: otherJob.id, name: "Foreign Stage", type: "review", position: 0 });
      const application = await createApplication({ status: "in_process", current_step_id: foreignStep._id });

      const res = await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const entry = res.body.needs_attention.find((a: { id: string }) => a.id === application.id);
      expect(entry.current_step_id).toBe(foreignStep.id);
    });
  });

  // ===== PERFORMANCE =====
  describe("performance / no N+1", () => {
    it("does not issue one Candidate query per application", async () => {
      await createApplication();
      await createApplication();
      await createApplication();

      const findSpy = jest.spyOn(Candidate, "find");
      await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(findSpy).toHaveBeenCalledTimes(1);
      findSpy.mockRestore();
    });

    it("does not issue one AIScreening query per application", async () => {
      const a = await createApplication();
      const b = await createApplication();
      await AIScreening.create(screeningFixtureFor(a.id, jobA.id, 50));
      await AIScreening.create(screeningFixtureFor(b.id, jobA.id, 70));

      const aggregateSpy = jest.spyOn(AIScreening, "aggregate");
      await request(app).get(boardUrl(jobA.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(aggregateSpy).toHaveBeenCalledTimes(1);
      aggregateSpy.mockRestore();
    });
  });

  // ===== CAPACITY GUARD (pure unit test, not a 2000-record fixture) =====
  describe("pathological-load guard", () => {
    it("throws a structured error when the active count exceeds the given limit", async () => {
      const { assertBoardWithinCapacity } = await import("../src/modules/hiringPipeline/hiringPipelineBoard.service");
      expect(() => assertBoardWithinCapacity(3, 2)).toThrow();
    });

    it("does not throw when the active count is within the given limit", async () => {
      const { assertBoardWithinCapacity } = await import("../src/modules/hiringPipeline/hiringPipelineBoard.service");
      expect(() => assertBoardWithinCapacity(2, 2)).not.toThrow();
    });
  });
});
