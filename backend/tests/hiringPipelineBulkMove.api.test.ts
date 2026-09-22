import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { ApplicationStageTransition } from "../src/models/ApplicationStageTransition.model";
import { Interview } from "../src/models/Interview.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Bulk movement must never touch AI, email, or the calendar/interview
// integration — mocked at the same boundaries stageTransition.api.test.ts
// already mocks, so the REGRESSION/side-effect tests below can assert they
// were never called.
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
  getLatestApplicationScreening: jest.fn(),
  getApplicationScreeningHistory: jest.fn(),
}));
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

import { createApplicationScreening } from "../src/services/ai/screeningHistory.service";

const mockCreateScreening = createApplicationScreening as jest.Mock;
const { emailService } = jest.requireMock("../src/services/email/email.service") as { emailService: { send: jest.Mock } };

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function bulkMoveReq(jobId: string, body: Record<string, unknown>, auth: string) {
  return request(app).patch(`/api/v1/jobs/${jobId}/hiring-pipeline/bulk-move`).set("Authorization", auth).send(body);
}

describe("Bulk hiring pipeline movement", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let review: HiringStepDoc;
  let interview: HiringStepDoc;
  let finalInterview: HiringStepDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    review = await HiringStep.create({ job_id: jobA.id, name: "Application Review", type: "review", position: 0 });
    interview = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 1 });
    finalInterview = await HiringStep.create({ job_id: jobA.id, name: "Final Interview", type: "interview", position: 2 });

    mockCreateScreening.mockReset();
    emailService.send.mockReset();
  });

  async function createApplicationIn(job: JobDoc, overrides: Record<string, unknown> = {}): Promise<ApplicationDoc> {
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

  // ===== SUCCESS =====
  describe("bulk success", () => {
    it("moves two applications from the same source stage to a target stage", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const b = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(200);
      expect(res.body.moved_count).toBe(2);
    });

    it("moves applications from different source stages to the same target", async () => {
      const fromReview = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const fromNew = await createApplicationIn(jobA);

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [fromReview.id, fromNew.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(200);
      expect(res.body.moved_count).toBe(2);
      const reread1 = await Application.findById(fromReview.id);
      const reread2 = await Application.findById(fromNew.id);
      expect(reread1?.current_step_id?.toString()).toBe(interview.id);
      expect(reread2?.current_step_id?.toString()).toBe(interview.id);
    });

    it("sets the correct current_step_id and status for every moved application", async () => {
      const a = await createApplicationIn(jobA); // applied -> in_process
      const b = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id }); // stays in_process

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      const cardA = res.body.applications.find((app: { id: string }) => app.id === a.id);
      const cardB = res.body.applications.find((app: { id: string }) => app.id === b.id);
      expect(cardA).toEqual({ id: a.id, status: "in_process", current_step_id: interview.id });
      expect(cardB).toEqual({ id: b.id, status: "in_process", current_step_id: interview.id });

      const rereadA = await Application.findById(a.id);
      const rereadB = await Application.findById(b.id);
      expect(rereadA?.status).toBe("in_process");
      expect(rereadA?.current_step_id?.toString()).toBe(interview.id);
      expect(rereadB?.status).toBe("in_process");
      expect(rereadB?.current_step_id?.toString()).toBe(interview.id);
    });

    it("returns the target step summary", async () => {
      const a = await createApplicationIn(jobA);
      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.body.target_step).toEqual({ id: interview.id, name: "Technical Interview", type: "interview" });
    });

    it("supports backward movement in bulk, same as single-candidate movement", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: finalInterview._id });
      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id], target_hiring_step_id: review.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(200);
      const reread = await Application.findById(a.id);
      expect(reread?.current_step_id?.toString()).toBe(review.id);
    });
  });

  // ===== TRANSITION HISTORY =====
  describe("transition history", () => {
    it("creates one append-only transition record per moved candidate, never a single batch record", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const b = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      const countA = await ApplicationStageTransition.countDocuments({ application_id: a.id });
      const countB = await ApplicationStageTransition.countDocuments({ application_id: b.id });
      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    it("records the correct per-candidate from/to snapshots", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const b = await createApplicationIn(jobA); // no current step yet

      await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      const transitionA = await ApplicationStageTransition.findOne({ application_id: a.id });
      const transitionB = await ApplicationStageTransition.findOne({ application_id: b.id });

      expect(transitionA?.from_step_snapshot?.name).toBe("Application Review");
      expect(transitionA?.to_step_snapshot.name).toBe("Technical Interview");

      expect(transitionB?.from_step_id).toBeNull();
      expect(transitionB?.from_step_snapshot).toBeNull();
      expect(transitionB?.to_step_snapshot.name).toBe("Technical Interview");
    });

    it("records moved_by as the authenticated user for every transition", async () => {
      const a = await createApplicationIn(jobA);
      const b = await createApplicationIn(jobA);

      await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      const transitionA = await ApplicationStageTransition.findOne({ application_id: a.id });
      const transitionB = await ApplicationStageTransition.findOne({ application_id: b.id });
      expect(transitionA?.moved_by.toString()).toBe(hrA.id);
      expect(transitionB?.moved_by.toString()).toBe(hrA.id);
    });

    it("leaves single-candidate movement fully working alongside bulk movement", async () => {
      const application = await createApplicationIn(jobA);
      const res = await request(app)
        .patch(`/api/v1/applications/${application.id}/hiring-step`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ step_id: review.id });

      expect(res.status).toBe(200);
      expect(res.body.application.current_step_id).toBe(review.id);
    });
  });

  // ===== ATOMICITY =====
  describe("atomicity (all-or-nothing)", () => {
    it("moves NO application when one of the selected ids doesn't exist", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, new Types.ObjectId().toString()], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(404);
      const reread = await Application.findById(a.id);
      expect(reread?.current_step_id?.toString()).toBe(review.id);
      expect(await ApplicationStageTransition.countDocuments({ application_id: a.id })).toBe(0);
    });

    it("moves NO application when one selected candidate is in a terminal status", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const rejected = await createApplicationIn(jobA, { status: "rejected", current_step_id: review._id });

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, rejected.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(409);
      const reread = await Application.findById(a.id);
      expect(reread?.current_step_id?.toString()).toBe(review.id);
      expect(await ApplicationStageTransition.countDocuments()).toBe(0);
    });

    it("moves NO application when the target hiring step is invalid", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const b = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: new Types.ObjectId().toString() },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(404);
      expect(await ApplicationStageTransition.countDocuments()).toBe(0);
    });

    it("moves NO application when one candidate belongs to a different Job", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Designer", status: "active" });
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const wrongJobApplication = await createApplicationIn(otherJob);

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, wrongJobApplication.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(404);
      const reread = await Application.findById(a.id);
      expect(reread?.current_step_id?.toString()).toBe(review.id);
      expect(await ApplicationStageTransition.countDocuments()).toBe(0);
    });

    it("rolls back the ENTIRE batch (not just the contested candidate) when the guarded write detects a conflict", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const b = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      // Deterministically simulates b's guard failing to match (its state
      // changed between the pre-check read and the transactional write)
      // without depending on real two-request race timing — same
      // failure-injection approach stageTransition.api.test.ts's own
      // "transactional consistency" tests use for forcing a mid-transaction
      // conflict.
      const bulkWriteSpy = jest
        .spyOn(Application.collection, "bulkWrite")
        .mockResolvedValueOnce({ modifiedCount: 1 } as never);

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(409);
      const rereadA = await Application.findById(a.id);
      const rereadB = await Application.findById(b.id);
      expect(rereadA?.current_step_id?.toString()).toBe(review.id);
      expect(rereadB?.current_step_id?.toString()).toBe(review.id);
      expect(await ApplicationStageTransition.countDocuments()).toBe(0);

      bulkWriteSpy.mockRestore();
    });
  });

  // ===== VALIDATION =====
  describe("validation", () => {
    it("rejects an empty application_ids array", async () => {
      const res = await bulkMoveReq(jobA.id, { application_ids: [], target_hiring_step_id: interview.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects a batch larger than the maximum size", async () => {
      const ids = Array.from({ length: 101 }, () => new Types.ObjectId().toString());
      const res = await bulkMoveReq(jobA.id, { application_ids: ids, target_hiring_step_id: interview.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects a malformed application id", async () => {
      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: ["not-an-object-id"], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );
      expect(res.status).toBe(400);
    });

    it("rejects a malformed target_hiring_step_id", async () => {
      const a = await createApplicationIn(jobA);
      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id], target_hiring_step_id: "not-an-object-id" },
        authHeaderFor(hrA, companyA.id)
      );
      expect(res.status).toBe(400);
    });

    it("rejects duplicate application ids in the same request", async () => {
      const a = await createApplicationIn(jobA);
      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, a.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );
      expect(res.status).toBe(400);
    });

    it("rejects company_id, status, or interviewer/assessment fields on the request body", async () => {
      const a = await createApplicationIn(jobA);
      const res = await bulkMoveReq(
        jobA.id,
        {
          application_ids: [a.id],
          target_hiring_step_id: interview.id,
          company_id: companyB.id,
          status: "hired",
          interviewer_user_ids: [hrA.id],
        },
        authHeaderFor(hrA, companyA.id)
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 (not a partial success) when a selected candidate is already in the destination stage", async () => {
      const already = await createApplicationIn(jobA, { status: "in_process", current_step_id: interview._id });
      const other = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [already.id, other.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(409);
      const rereadOther = await Application.findById(other.id);
      expect(rereadOther?.current_step_id?.toString()).toBe(review.id);
      expect(await ApplicationStageTransition.countDocuments()).toBe(0);
    });
  });

  // ===== LIFECYCLE =====
  describe("job lifecycle", () => {
    it("allows bulk movement for a closed (not deleted) Job, matching single-move behavior", async () => {
      const a = await createApplicationIn(jobA);
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });

      const res = await bulkMoveReq(jobA.id, { application_ids: [a.id], target_hiring_step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
    });

    it("blocks bulk movement for a soft-deleted Job", async () => {
      const a = await createApplicationIn(jobA);
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await bulkMoveReq(jobA.id, { application_ids: [a.id], target_hiring_step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
      const reread = await Application.findById(a.id);
      expect(reread?.current_step_id).toBeNull();
    });
  });

  // ===== TENANCY =====
  describe("tenant isolation", () => {
    it("returns 404 for a bulk move request against another company's Job", async () => {
      const a = await createApplicationIn(jobA);
      const res = await bulkMoveReq(jobA.id, { application_ids: [a.id], target_hiring_step_id: review.id }, authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 (never leaking the id belongs to another company) for a cross-company candidate id", async () => {
      const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Designer", status: "active" });
      const foreignApplication = await createApplicationIn(jobB);
      const ownApplication = await createApplicationIn(jobA);

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [ownApplication.id, foreignApplication.id], target_hiring_step_id: review.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(/Company B|hr@b\.test/i);
    });

    it("returns 404 for a target hiring step belonging to another company", async () => {
      const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Designer", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: jobB.id, name: "Portfolio Review", type: "review", position: 0 });
      const a = await createApplicationIn(jobA);

      const res = await bulkMoveReq(jobA.id, { application_ids: [a.id], target_hiring_step_id: foreignStep.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("rejects an unauthenticated bulk move request", async () => {
      const a = await createApplicationIn(jobA);
      const res = await request(app)
        .patch(`/api/v1/jobs/${jobA.id}/hiring-pipeline/bulk-move`)
        .send({ application_ids: [a.id], target_hiring_step_id: review.id });
      expect(res.status).toBe(401);
    });
  });

  // ===== SIDE EFFECTS =====
  describe("zero side effects", () => {
    it("creates no Interview when moving candidates into an interview-type stage", async () => {
      const a = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const b = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });

      const res = await bulkMoveReq(
        jobA.id,
        { application_ids: [a.id, b.id], target_hiring_step_id: interview.id },
        authHeaderFor(hrA, companyA.id)
      );

      expect(res.status).toBe(200);
      expect(await Interview.countDocuments()).toBe(0);
    });

    it("does not trigger AI screening", async () => {
      const a = await createApplicationIn(jobA);
      await bulkMoveReq(jobA.id, { application_ids: [a.id], target_hiring_step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(mockCreateScreening).not.toHaveBeenCalled();
    });

    it("does not send email", async () => {
      const a = await createApplicationIn(jobA);
      await bulkMoveReq(jobA.id, { application_ids: [a.id], target_hiring_step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });
});
