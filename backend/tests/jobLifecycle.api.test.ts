import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { HiringStep } from "../src/models/HiringStep.model";
import { AIScreening } from "../src/models/AIScreening.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Same boundary screening.api.test.ts mocks at — this file must never
// trigger a real Groq call or persist a real screening through the AI
// pipeline itself; only its HTTP-layer/tenant/lifecycle wiring is tested.
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
  getLatestApplicationScreening: jest.fn(),
  getApplicationScreeningHistory: jest.fn(),
}));

// Same boundary publicApplication.api.test.ts mocks at — never touch real
// storage, file-signature detection (ESM-only, unresolvable under Jest —
// see that file's comment), or email.
jest.mock("../src/services/storage/cvStorage.service", () => ({
  cvStorage: {
    upload: jest.fn(),
    delete: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  },
}));
jest.mock("../src/modules/applications/cvFileSignature", () => ({
  detectCvFileType: jest.fn(async (buffer: Buffer) => {
    if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    return null;
  }),
}));
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

import { createApplicationScreening } from "../src/services/ai/screeningHistory.service";

const mockCreateScreening = createApplicationScreening as jest.Mock;
const { cvStorage } = jest.requireMock("../src/services/storage/cvStorage.service") as {
  cvStorage: { upload: jest.Mock; delete: jest.Mock; getSignedDownloadUrl: jest.Mock };
};
const { emailService } = jest.requireMock("../src/services/email/email.service") as {
  emailService: { send: jest.Mock };
};

const app = createApp();
const PDF_BUFFER = Buffer.from("%PDF-1.4 fake pdf content", "latin1");

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function screeningFixtureFor(applicationId: string, jobId: string) {
  return {
    application_id: applicationId,
    job_id: jobId,
    analysis: {
      summary: "Backend developer with Node.js experience.",
      skills: [{ name: "Node.js", evidence: "Listed under Skills." }],
      experience: { yearsMentioned: 5, summary: "5 years as a backend developer." },
      education: ["B.Sc. Computer Science"],
      strengths: ["Strong TypeScript background"],
      gaps: [],
      requiredSkillEvidence: [],
    },
    match: {
      score: 100,
      scorable: true,
      totalRequiredSkills: 1,
      foundSkills: 1,
      unclearSkills: 0,
      missingSkills: 0,
      matchedSkills: ["Node.js"],
      unclearRequiredSkills: [],
      missingRequiredSkills: [],
      breakdown: [],
    },
    ai_metadata: { provider: "groq", model: "openai/gpt-oss-120b" },
    score_formula_version: "required_skill_coverage_v1",
  };
}

describe("Job Lifecycle (soft delete)", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    cvStorage.upload.mockReset();
    cvStorage.upload.mockImplementation(
      async ({ buffer, originalName, mimeType }: { buffer: Buffer; originalName: string; mimeType: string }) => ({
        storage_key: `talentiq/cvs/mock-${Math.random().toString(36).slice(2)}`,
        original_name: originalName,
        mime_type: mimeType,
        size_bytes: buffer.length,
      })
    );
    emailService.send.mockReset();
    emailService.send.mockResolvedValue(undefined);
    mockCreateScreening.mockReset();
  });

  async function createApplicationFor(job: JobDoc, overrides: Record<string, unknown> = {}) {
    const candidate = await Candidate.create({
      full_name: "Sarah Ahmed",
      email: `sarah-${new Types.ObjectId().toString()}@candidate.test`,
    });
    return Application.create({
      job_id: job.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      ...overrides,
    });
  }

  // ===== DELETE =====
  describe("DELETE /api/v1/jobs/:id", () => {
    it("does not delete Applications belonging to the deleted Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Role" });
      const application = await createApplicationFor(job);

      await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(await Application.findById(application.id)).not.toBeNull();
    });

    it("does not delete HiringSteps belonging to the deleted Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Role" });
      const step = await HiringStep.create({ job_id: job.id, name: "Application Review", type: "review", position: 0 });

      await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(await HiringStep.findById(step.id)).not.toBeNull();
    });

    it("returns 404 deleting a well-formed but nonexistent Job public_id", async () => {
      const res = await request(app)
        .delete(`/api/v1/jobs/job_${"a".repeat(24)}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("returns 404 on a second DELETE of an already-deleted Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Delete Twice" });

      const first = await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(first.status).toBe(204);

      const second = await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(second.status).toBe(404);
    });

    it("never lets the client directly set deleted_at through create or update", async () => {
      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Sneaky Create", deleted_at: new Date().toISOString() });

      expect(createRes.status).toBe(201);
      const created = await Job.findById(createRes.body.job._id).select("+deleted_at");
      expect(created?.deleted_at).toBeNull();

      const patchRes = await request(app)
        .patch(`/api/v1/jobs/${created!.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Still Not Deleted", deleted_at: new Date().toISOString() });

      expect(patchRes.status).toBe(200);
      const patched = await Job.findById(created!.id).select("+deleted_at");
      expect(patched?.deleted_at).toBeNull();
    });
  });

  // ===== NORMAL JOB READS =====
  describe("normal Job reads", () => {
    it("excludes deleted Jobs from the list", async () => {
      const active = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Active Job", status: "active" });
      const deleted = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted Job" });
      await Job.updateOne({ _id: deleted.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app).get("/api/v1/jobs").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.jobs.map((j: { _id: string }) => j._id)).toEqual([active.id]);
    });

    it("returns 404 for a deleted Job's detail", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted Detail" });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("excludes deleted Jobs even when filtering by status", async () => {
      const closedActive = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Closed", status: "closed" });
      const closedDeleted = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Closed Deleted", status: "closed" });
      await Job.updateOne({ _id: closedDeleted.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .get("/api/v1/jobs?status=closed")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.jobs.map((j: { _id: string }) => j._id)).toEqual([closedActive.id]);
    });

    it("composes company scoping with deleted-Job filtering correctly", async () => {
      await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "A Active", status: "active" });
      const aDeleted = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "A Deleted" });
      await Job.updateOne({ _id: aDeleted.id }, { $set: { deleted_at: new Date() } });
      await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "B Active", status: "active" });

      const res = await request(app).get("/api/v1/jobs").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].title).toBe("A Active");
    });
  });

  // ===== UPDATE =====
  describe("PATCH /api/v1/jobs/:id on a deleted Job", () => {
    it("returns 404 patching a deleted Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted" });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Trying To Undelete" });

      expect(res.status).toBe(404);
    });

    it("cannot restore a deleted Job by sending deleted_at: null in the PATCH body", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted" });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      // deleted_at is paired with a real field (title) so the request
      // passes body validation (an object with only an unlisted key like
      // deleted_at strips down to {}, which is itself rejected as an
      // empty update before ever reaching the service layer — already
      // covered by job.api.test.ts's "rejects an empty update body").
      // This test specifically exercises the deleted-Job 404 path.
      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Attempted Undelete", deleted_at: null });

      expect(res.status).toBe(404);
      const stillDeleted = await Job.findById(job.id).select("+deleted_at");
      expect(stillDeleted?.deleted_at).toBeInstanceOf(Date);
    });
  });

  // ===== PUBLIC =====
  describe("public Job/application routes", () => {
    it("returns 404 for a public GET of a deleted Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted Public", status: "active" });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);
      expect(res.status).toBe(404);
    });

    it("rejects a candidate application to a deleted Job, even though status is still active", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted But Active", status: "active" });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .post(`/api/v1/public/jobs/${job.public_id}/applications`)
        .field("full_name", "Sarah Ahmed")
        .field("email", "sarah-deleted-job@candidate.test")
        .attach("cv", PDF_BUFFER, { filename: "resume.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(404);
      expect(cvStorage.upload).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });

  // ===== PIPELINE =====
  describe("hiring-step routes for a deleted Job", () => {
    it("returns 404 on GET when the Job is deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Pipeline Job" });
      await HiringStep.create({ job_id: job.id, name: "Review", type: "review", position: 0 });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}/hiring-steps`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("returns 404 on POST/PATCH/reorder/DELETE when the Job is deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Pipeline Job" });
      const step = await HiringStep.create({ job_id: job.id, name: "Review", type: "review", position: 0 });
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const auth = authHeaderFor(hrA, companyA.id);
      const postRes = await request(app)
        .post(`/api/v1/jobs/${job.public_id}/hiring-steps`)
        .set("Authorization", auth)
        .send({ name: "Interview", type: "interview" });
      const patchRes = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}/hiring-steps/${step.public_id}`)
        .set("Authorization", auth)
        .send({ name: "Renamed" });
      const reorderRes = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}/hiring-steps/reorder`)
        .set("Authorization", auth)
        .send({ orderedStepIds: [step.id] });
      const deleteRes = await request(app)
        .delete(`/api/v1/jobs/${job.public_id}/hiring-steps/${step.public_id}`)
        .set("Authorization", auth);

      expect(postRes.status).toBe(404);
      expect(patchRes.status).toBe(404);
      expect(reorderRes.status).toBe(404);
      expect(deleteRes.status).toBe(404);
    });

    it("leaves HiringStep documents stored after soft-deleting their Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Pipeline Job" });
      const step = await HiringStep.create({ job_id: job.id, name: "Review", type: "review", position: 0 });

      await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(await HiringStep.findById(step.id)).not.toBeNull();
    });
  });

  // ===== APPLICATION HISTORY =====
  describe("Application history after Job soft-delete", () => {
    it("keeps the Application stored after its Job is soft-deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);

      await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(await Application.findById(application.id)).not.toBeNull();
    });

    it("keeps the Application's job_id intact after the Job is soft-deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);

      await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));

      const reread = await Application.findById(application.id);
      expect(reread?.job_id.toString()).toBe(job.id);
    });

    it("preserves Job context in HR Application list/detail after the Job is soft-deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const listRes = await request(app).get("/api/v1/applications").set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(listRes.status).toBe(200);
      const row = listRes.body.applications.find((a: { id: string }) => a.id === application.id);
      expect(row).toBeDefined();
      expect(row.job.title).toBe("Backend Developer");

      const detailRes = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.application.job.title).toBe("Backend Developer");
    });

    it("keeps tenant isolation intact for a historical Application after its Job is soft-deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}`)
        .set("Authorization", authHeaderFor(hrB, companyB.id));

      expect(res.status).toBe(404);
    });
  });

  // ===== SCREENINGS =====
  describe("AI screenings after Job soft-delete", () => {
    it("keeps existing AIScreening documents stored after the Job is soft-deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);
      const screening = await AIScreening.create(screeningFixtureFor(application.id, job.id));

      await request(app).delete(`/api/v1/jobs/${job.public_id}`).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(await AIScreening.findById(screening.id)).not.toBeNull();
    });

    it("keeps screening history readable after the Job is soft-deleted", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);
      const screening = await AIScreening.create(screeningFixtureFor(application.id, job.id));
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const { getApplicationScreeningHistory } = jest.requireMock("../src/services/ai/screeningHistory.service") as {
        getApplicationScreeningHistory: jest.Mock;
      };
      getApplicationScreeningHistory.mockResolvedValueOnce([screening]);

      const res = await request(app)
        .get(`/api/v1/applications/${application.public_id}/screenings`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.screenings).toHaveLength(1);
    });

    it("does not trigger AI when reading screening history/latest for a soft-deleted Job's Application", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const { getApplicationScreeningHistory, getLatestApplicationScreening } = jest.requireMock(
        "../src/services/ai/screeningHistory.service"
      ) as { getApplicationScreeningHistory: jest.Mock; getLatestApplicationScreening: jest.Mock };
      getApplicationScreeningHistory.mockResolvedValueOnce([]);
      getLatestApplicationScreening.mockResolvedValueOnce(null);

      await request(app)
        .get(`/api/v1/applications/${application.public_id}/screenings`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      await request(app)
        .get(`/api/v1/applications/${application.public_id}/screenings/latest`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(mockCreateScreening).not.toHaveBeenCalled();
    });

    it("blocks creating a new screening for a soft-deleted Job's Application with 409, before any Groq/R2 work", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer" });
      const application = await createApplicationFor(job);
      await Job.updateOne({ _id: job.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .post(`/api/v1/applications/${application.public_id}/screenings`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      expect(res.status).toBe(409);
      expect(mockCreateScreening).not.toHaveBeenCalled();
    });
  });

  // ===== REGRESSION =====
  describe("regression", () => {
    it("active Job CRUD still works end-to-end", async () => {
      const createRes = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Regression Job" });
      expect(createRes.status).toBe(201);
      const jobId = createRes.body.job.public_id;

      const getRes = await request(app).get(`/api/v1/jobs/${jobId}`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(getRes.status).toBe(200);

      const patchRes = await request(app)
        .patch(`/api/v1/jobs/${jobId}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "active" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.job.status).toBe("active");

      const deleteRes = await request(app).delete(`/api/v1/jobs/${jobId}`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(deleteRes.status).toBe(204);
    });

    it("keeps closed Jobs behaving independently from deleted Jobs", async () => {
      const closed = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Closed Job", status: "closed" });

      const listRes = await request(app).get("/api/v1/jobs").set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(listRes.body.jobs.map((j: { _id: string }) => j._id)).toContain(closed.id);

      const detailRes = await request(app)
        .get(`/api/v1/jobs/${closed.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.job.status).toBe("closed");
    });

    it("still allows a candidate to apply to an active, non-deleted Job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Open Role", status: "active" });

      const res = await request(app)
        .post(`/api/v1/public/jobs/${job.public_id}/applications`)
        .field("full_name", "Sarah Ahmed")
        .field("email", "sarah-still-open@candidate.test")
        .attach("cv", PDF_BUFFER, { filename: "resume.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(201);
      expect(cvStorage.upload).toHaveBeenCalledTimes(1);
    });
  });
});
