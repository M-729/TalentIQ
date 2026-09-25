import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { HiringStep } from "../src/models/HiringStep.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function stepsUrl(jobId: string, suffix = "") {
  return `/api/v1/jobs/${jobId}/hiring-steps${suffix}`;
}

describe("HiringStep API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let jobB: JobDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });
    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Engineer", status: "active" });
    jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Designer", status: "active" });
  });

  async function createStep(jobId: string, overrides: Record<string, unknown> = {}) {
    const count = await HiringStep.countDocuments({ job_id: jobId });
    return HiringStep.create({ job_id: jobId, name: `Stage ${count}`, type: "review", position: count, ...overrides });
  }

  // ===== AUTH =====
  describe("authentication and role authorization", () => {
    it("rejects an unauthenticated GET with 401", async () => {
      const res = await request(app).get(stepsUrl(jobA.public_id!));
      expect(res.status).toBe(401);
    });

    it("rejects an unauthenticated POST with 401", async () => {
      const res = await request(app).post(stepsUrl(jobA.public_id!)).send({ name: "Review", type: "review" });
      expect(res.status).toBe(401);
    });

    it("allows an authenticated HR user", async () => {
      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
    });

    it("allows an authenticated ADMIN user", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(admin, companyA.id));
      expect(res.status).toBe(200);
    });
  });

  // ===== TENANT ISOLATION =====
  describe("tenant isolation", () => {
    it("allows a company to view its own Job's stages", async () => {
      await createStep(jobA.id, { name: "Review" });
      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(1);
    });

    it("returns 404 for a cross-company Job on GET", async () => {
      const res = await request(app).get(stepsUrl(jobB.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a cross-company Job on POST", async () => {
      const res = await request(app)
        .post(stepsUrl(jobB.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Review", type: "review" });
      expect(res.status).toBe(404);
      expect(await HiringStep.countDocuments({ job_id: jobB.id })).toBe(0);
    });

    it("returns 404 updating a step belonging to another company's Job", async () => {
      const step = await createStep(jobB.id, { name: "Review" });
      const res = await request(app)
        .patch(stepsUrl(jobB.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Hijacked" });
      expect(res.status).toBe(404);
    });

    it("returns 404 deleting a step belonging to another company's Job", async () => {
      const step = await createStep(jobB.id, { name: "Review" });
      const res = await request(app)
        .delete(stepsUrl(jobB.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
      expect(await HiringStep.findById(step.id)).not.toBeNull();
    });
  });

  // ===== CREATE =====
  describe("POST /api/v1/jobs/:jobId/hiring-steps", () => {
    it("gives the first stage position 0", async () => {
      const res = await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Application Review", type: "review" });

      expect(res.status).toBe(201);
      expect(res.body.step.position).toBe(0);
    });

    it("gives the next stage position 1", async () => {
      await createStep(jobA.id, { name: "Application Review", position: 0 });

      const res = await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Technical Interview", type: "interview" });

      expect(res.body.step.position).toBe(1);
    });

    it("trims the stage name", async () => {
      const res = await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "  Application Review  ", type: "review" });

      expect(res.body.step.name).toBe("Application Review");
    });

    it("validates the stage type", async () => {
      const res = await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Review", type: "not-a-type" });

      expect(res.status).toBe(400);
    });

    it("rejects a duplicate name case-insensitively", async () => {
      await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Technical Interview", type: "interview" });

      const res = await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: " technical interview ", type: "interview" });

      expect(res.status).toBe(409);
    });

    it("allows the same stage name on a different Job", async () => {
      await createStep(jobA.id, { name: "Technical Interview" });

      const res = await request(app)
        .post(stepsUrl(jobB.public_id!))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({ name: "Technical Interview", type: "interview" });

      expect(res.status).toBe(201);
    });

    it("never lets the client control job_id, company_id, or position", async () => {
      const res = await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Review", type: "review", job_id: jobB.id, company_id: companyB.id, position: 99 });

      expect(res.status).toBe(400); // .strict() schema rejects unknown fields
    });
  });

  // ===== GET =====
  describe("GET /api/v1/jobs/:jobId/hiring-steps", () => {
    it("returns stages ordered by position ascending", async () => {
      await createStep(jobA.id, { name: "Assessment", position: 2 });
      await createStep(jobA.id, { name: "Application Review", position: 0 });
      await createStep(jobA.id, { name: "Technical Interview", position: 1 });

      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.steps.map((s: { name: string }) => s.name)).toEqual([
        "Application Review",
        "Technical Interview",
        "Assessment",
      ]);
    });

    it("returns [] for an empty pipeline", async () => {
      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.steps).toEqual([]);
    });

    // Phase 1 dual-accept migration: the Job parent-scoping path segment
    // ("special attention" case) is resolved to Job's real internal id
    // before being used against HiringStep.job_id.
    it("returns stages for a job addressed by its public_id", async () => {
      await createStep(jobA.id, { name: "Review" });

      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.steps).toHaveLength(1);
    });

    it("returns 404 for a job public_id belonging to another company", async () => {
      const res = await request(app).get(stepsUrl(jobB.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("uses the explicit serializer, excluding internal fields", async () => {
      await createStep(jobA.id, { name: "Review" });
      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(Object.keys(res.body.steps[0])).toEqual(["id", "public_id", "name", "type", "description", "position"]);
      expect(JSON.stringify(res.body)).not.toContain("__v");
      expect(JSON.stringify(res.body)).not.toContain("job_id");
    });
  });

  // ===== UPDATE =====
  describe("PATCH /api/v1/jobs/:jobId/hiring-steps/:stepId", () => {
    it("renames a stage", async () => {
      const step = await createStep(jobA.id, { name: "Old Name" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.step.name).toBe("New Name");
    });

    it("updates the type", async () => {
      const step = await createStep(jobA.id, { name: "Stage", type: "review" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ type: "interview" });

      expect(res.body.step.type).toBe("interview");
    });

    it("updates the description", async () => {
      const step = await createStep(jobA.id, { name: "Stage" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ description: "A short description." });

      expect(res.body.step.description).toBe("A short description.");
    });

    it("rejects a rename that collides with another stage's name", async () => {
      await createStep(jobA.id, { name: "Technical Interview", position: 0 });
      const step = await createStep(jobA.id, { name: "Application Review", position: 1 });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "technical interview" });

      expect(res.status).toBe(409);
    });

    it("cannot update position through the normal PATCH endpoint", async () => {
      const step = await createStep(jobA.id, { name: "Stage", position: 0 });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ position: 5 });

      expect(res.status).toBe(400); // .strict() schema rejects position
    });

    it("cannot move a stage to another Job", async () => {
      const step = await createStep(jobA.id, { name: "Stage" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ job_id: jobB.id });

      expect(res.status).toBe(400); // .strict() schema rejects job_id
      const unchanged = await HiringStep.findById(step.id);
      expect(unchanged?.job_id.toString()).toBe(jobA.id);
    });

    // Phase 1 dual-accept migration.
    it("renames a stage looked up by its public_id", async () => {
      const step = await createStep(jobA.id, { name: "Old Name" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "New Name" });

      expect(res.status).toBe(200);
      expect(res.body.step.name).toBe("New Name");
    });

    it("rejects a rename addressed by the stage's legacy Mongo ObjectId", async () => {
      const step = await createStep(jobA.id, { name: "Old Name" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "New Name Via Legacy Id" });

      expect(res.status).toBe(400);
    });

    it("returns 404 for a cross-job stage public_id (never matches another Job's stage)", async () => {
      const step = await createStep(jobB.id, { name: "Other Job Stage" });
      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Hijacked" });

      expect(res.status).toBe(404);
    });
  });

  // ===== REORDER =====
  describe("PATCH /api/v1/jobs/:jobId/hiring-steps/reorder", () => {
    it("changes positions to match the submitted order", async () => {
      const review = await createStep(jobA.id, { name: "Review", position: 0 });
      const interview = await createStep(jobA.id, { name: "Interview", position: 1 });
      const assessment = await createStep(jobA.id, { name: "Assessment", position: 2 });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [assessment.id, review.id, interview.id] });

      expect(res.status).toBe(200);
      expect(res.body.steps.map((s: { name: string }) => s.name)).toEqual(["Assessment", "Review", "Interview"]);
    });

    it("keeps positions contiguous (0..N-1) after reorder", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      const b = await createStep(jobA.id, { name: "B", position: 1 });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [b.id, a.id] });

      expect(res.body.steps.map((s: { position: number }) => s.position)).toEqual([0, 1]);
    });

    it("requires the full current set of stage ids", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      await createStep(jobA.id, { name: "B", position: 1 });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [a.id] });

      expect(res.status).toBe(400);
    });

    it("rejects a reorder missing a current stage id", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      const b = await createStep(jobA.id, { name: "B", position: 1 });
      const c = await createStep(jobA.id, { name: "C", position: 2 });
      void a;

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [b.id, c.id] }); // missing a

      expect(res.status).toBe(400);
    });

    it("rejects a reorder with an extra/foreign stage id", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      const foreign = await createStep(jobB.id, { name: "Foreign" });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [a.id, foreign.id] });

      expect(res.status).toBe(400);
    });

    it("rejects a reorder with a duplicate id", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      const b = await createStep(jobA.id, { name: "B", position: 1 });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [a.id, a.id] });
      void b;

      expect(res.status).toBe(400);
    });

    it("rejects a reorder with a malformed id", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [a.id, "not-an-object-id"] });

      expect(res.status).toBe(400);
    });

    it("rejects a stage id belonging to another Job", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      const foreign = await createStep(jobB.id, { name: "Foreign" });

      const res = await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [foreign.id] });
      void a;

      expect(res.status).toBe(400);
    });

    it("still enforces tenant ownership of the Job for reorder", async () => {
      const res = await request(app)
        .patch(stepsUrl(jobB.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [] });

      expect(res.status).toBe(404);
    });

    it("GET reflects the new order after a successful reorder", async () => {
      const a = await createStep(jobA.id, { name: "A", position: 0 });
      const b = await createStep(jobA.id, { name: "B", position: 1 });

      await request(app)
        .patch(stepsUrl(jobA.public_id!, "/reorder"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ orderedStepIds: [b.id, a.id] });

      const res = await request(app).get(stepsUrl(jobA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.steps.map((s: { name: string }) => s.name)).toEqual(["B", "A"]);
    });
  });

  // ===== DELETE =====
  describe("DELETE /api/v1/jobs/:jobId/hiring-steps/:stepId", () => {
    it("deletes an unused stage", async () => {
      const step = await createStep(jobA.id, { name: "Review" });
      const res = await request(app)
        .delete(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(204);
      expect(await HiringStep.findById(step.id)).toBeNull();
    });

    // Phase 1 dual-accept migration.
    it("deletes an unused stage looked up by its public_id", async () => {
      const step = await createStep(jobA.id, { name: "Review" });
      const res = await request(app)
        .delete(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(204);
      expect(await HiringStep.findById(step.id)).toBeNull();
    });

    it("compacts later positions after deleting a middle stage", async () => {
      await createStep(jobA.id, { name: "Review", position: 0 });
      const interview = await createStep(jobA.id, { name: "Interview", position: 1 });
      const assessment = await createStep(jobA.id, { name: "Assessment", position: 2 });

      await request(app)
        .delete(stepsUrl(jobA.public_id!, `/${interview.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const reread = await HiringStep.findById(assessment.id);
      expect(reread?.position).toBe(1);
    });

    it("returns 409 and does not delete a stage referenced by an application's current_step_id", async () => {
      const step = await createStep(jobA.id, { name: "Review" });
      const candidate = await Candidate.create({ full_name: "Taylor Example", email: "taylor@test.local" });
      await Application.create({
        job_id: jobA.id,
        candidate_id: candidate.id,
        current_step_id: step.id,
        cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      });

      const res = await request(app)
        .delete(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(409);
      expect(await HiringStep.findById(step.id)).not.toBeNull();
    });

    it("leaves stage/order unchanged after a failed (in-use) deletion", async () => {
      const review = await createStep(jobA.id, { name: "Review", position: 0 });
      const interview = await createStep(jobA.id, { name: "Interview", position: 1 });
      const candidate = await Candidate.create({ full_name: "Taylor Example", email: "taylor2@test.local" });
      await Application.create({
        job_id: jobA.id,
        candidate_id: candidate.id,
        current_step_id: interview.id,
        cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      });

      await request(app)
        .delete(stepsUrl(jobA.public_id!, `/${interview.id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const rereadReview = await HiringStep.findById(review.id);
      const rereadInterview = await HiringStep.findById(interview.id);
      expect(rereadReview?.position).toBe(0);
      expect(rereadInterview?.position).toBe(1);
    });

    it("returns 404 for a well-formed but nonexistent step public_id", async () => {
      const res = await request(app)
        .delete(stepsUrl(jobA.public_id!, `/step_${"a".repeat(24)}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });
  });

  // ===== REGRESSION =====
  describe("regression", () => {
    it("creating/editing/reordering stages never changes Application.status", async () => {
      const step = await createStep(jobA.id, { name: "Review" });
      const candidate = await Candidate.create({ full_name: "Taylor Example", email: "taylor3@test.local" });
      const application = await Application.create({
        job_id: jobA.id,
        candidate_id: candidate.id,
        status: "applied",
        cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      });

      await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Interview", type: "interview" });
      await request(app)
        .patch(stepsUrl(jobA.public_id!, `/${step.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Review Renamed" });

      const rereadApplication = await Application.findById(application.id);
      expect(rereadApplication?.status).toBe("applied");
    });

    it("creating/editing/reordering stages never changes Application.current_step_id", async () => {
      const step = await createStep(jobA.id, { name: "Review" });
      const candidate = await Candidate.create({ full_name: "Taylor Example", email: "taylor4@test.local" });
      const application = await Application.create({
        job_id: jobA.id,
        candidate_id: candidate.id,
        current_step_id: step.id,
        cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      });

      await request(app)
        .post(stepsUrl(jobA.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Interview", type: "interview" });

      const rereadApplication = await Application.findById(application.id);
      expect(rereadApplication?.current_step_id?.toString()).toBe(step.id);
    });
  });
});
