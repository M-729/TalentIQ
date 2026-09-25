import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { ApplicationStageTransition } from "../src/models/ApplicationStageTransition.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Movement must never touch AI or email — mocked at the same boundaries
// screening.api.test.ts and publicApplication.api.test.ts already mock,
// so REGRESSION tests below can assert they were never called.
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
  getLatestApplicationScreening: jest.fn(),
  getApplicationScreeningHistory: jest.fn(),
}));
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

import {
  createApplicationScreening,
  getApplicationScreeningHistory,
  getLatestApplicationScreening,
} from "../src/services/ai/screeningHistory.service";

const mockCreateScreening = createApplicationScreening as jest.Mock;
const mockLatestScreening = getLatestApplicationScreening as jest.Mock;
const mockScreeningHistory = getApplicationScreeningHistory as jest.Mock;
const { emailService } = jest.requireMock("../src/services/email/email.service") as { emailService: { send: jest.Mock } };

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

describe("Application stage movement + history", () => {
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
    mockLatestScreening.mockReset();
    mockScreeningHistory.mockReset();
    emailService.send.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  function moveReq(applicationId: string, body: Record<string, unknown>, auth: string) {
    return request(app).patch(`/api/v1/applications/${applicationId}/hiring-step`).set("Authorization", auth).send(body);
  }

  function historyReq(applicationId: string, auth: string) {
    return request(app).get(`/api/v1/applications/${applicationId}/stage-history`).set("Authorization", auth);
  }

  // ===== INITIAL ASSIGNMENT =====
  describe("initial assignment", () => {
    it("moves a null current_step to a target stage", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.application.current_step_id).toBe(review.id);
    });

    it("sets status applied -> in_process on initial assignment", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      expect(res.body.application.status).toBe("in_process");
      const reread = await Application.findById(application.id);
      expect(reread?.status).toBe("in_process");
      expect(reread?.current_step_id?.toString()).toBe(review.id);
    });

    it("creates exactly one history event for the initial assignment", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      const count = await ApplicationStageTransition.countDocuments({ application_id: application.id });
      expect(count).toBe(1);
    });

    it("records a null from_step for the initial assignment", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      const transition = await ApplicationStageTransition.findOne({ application_id: application.id });
      expect(transition?.from_step_id).toBeNull();
      expect(transition?.from_step_snapshot).toBeNull();
    });

    it("records the correct to_step snapshot", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      const transition = await ApplicationStageTransition.findOne({ application_id: application.id });
      expect(transition?.to_step_snapshot.name).toBe("Application Review");
      expect(transition?.to_step_snapshot.type).toBe("review");
    });

    it("records moved_by as the authenticated user", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      const transition = await ApplicationStageTransition.findOne({ application_id: application.id });
      expect(transition?.moved_by.toString()).toBe(hrA.id);
    });
  });

  // ===== NORMAL MOVEMENT =====
  describe("normal movement", () => {
    it("moves from stage A to stage B", async () => {
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const res = await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.application.current_step_id).toBe(interview.id);
    });

    it("keeps status in_process across a normal movement", async () => {
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const res = await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      expect(res.body.application.status).toBe("in_process");
    });

    it("records correct from/to snapshots for a normal movement", async () => {
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const transition = await ApplicationStageTransition.findOne({ application_id: application.id }).sort({ created_at: -1 });
      expect(transition?.from_step_snapshot?.name).toBe("Application Review");
      expect(transition?.from_step_snapshot?.type).toBe("review");
      expect(transition?.to_step_snapshot.name).toBe("Technical Interview");
      expect(transition?.to_step_snapshot.type).toBe("interview");
    });

    it("leaves the previous history record unchanged after a second move", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      const firstTransition = await ApplicationStageTransition.findOne({ application_id: application.id });

      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const firstReread = await ApplicationStageTransition.findById(firstTransition!.id);
      expect(firstReread?.to_step_snapshot.name).toBe("Application Review");
      expect(firstReread?.to_step_snapshot.type).toBe("review");
      expect(firstReread?.created_at).toEqual(firstTransition!.created_at);
    });

    it("creates a second history event on the second move", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const count = await ApplicationStageTransition.countDocuments({ application_id: application.id });
      expect(count).toBe(2);
    });
  });

  // ===== BACKWARD MOVEMENT =====
  describe("backward movement", () => {
    it("allows moving from a later stage to an earlier stage", async () => {
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: finalInterview._id });
      const res = await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.application.current_step_id).toBe(interview.id);
    });

    it("creates a normal history event for backward movement", async () => {
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: finalInterview._id });
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const transition = await ApplicationStageTransition.findOne({ application_id: application.id });
      expect(transition?.from_step_snapshot?.name).toBe("Final Interview");
      expect(transition?.from_step_snapshot?.type).toBe("interview");
      expect(transition?.to_step_snapshot.name).toBe("Technical Interview");
      expect(transition?.to_step_snapshot.type).toBe("interview");
    });
  });

  // ===== VALIDATION =====
  describe("validation", () => {
    it("returns 400 for a malformed applicationId", async () => {
      const res = await moveReq("not-an-object-id", { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("returns 400 for a malformed step_id", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: "not-an-object-id" }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects a target stage belonging to another Job in the same company", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Designer", status: "active" });
      const portfolioReview = await HiringStep.create({ job_id: otherJob.id, name: "Portfolio Review", type: "review", position: 0 });
      const application = await createApplicationIn(jobA);

      const res = await moveReq(application.public_id!, { step_id: portfolioReview.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("rejects a target stage belonging to another company", async () => {
      const otherJob = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Designer", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: otherJob.id, name: "Portfolio Review", type: "review", position: 0 });
      const application = await createApplicationIn(jobA);

      const res = await moveReq(application.public_id!, { step_id: foreignStep.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("returns 409 when moving to the application's current stage", async () => {
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: review._id });
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("fails safely when current_step_id points to a stage that doesn't belong to this Job", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Other Job", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: otherJob.id, name: "Foreign Stage", type: "review", position: 0 });
      // Simulates corrupted/legacy data — never reachable through the normal API.
      const application = await createApplicationIn(jobA, { status: "in_process", current_step_id: foreignStep._id });

      const res = await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);

      const reread = await Application.findById(application.id);
      expect(reread?.current_step_id?.toString()).toBe(foreignStep.id);
      expect(await ApplicationStageTransition.countDocuments({ application_id: application.id })).toBe(0);
    });

    it("enforces the note max length", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(
        application.id,
        { step_id: review.id, note: "a".repeat(1001) },
        authHeaderFor(hrA, companyA.id)
      );
      expect(res.status).toBe(400);
    });

    it("cannot submit from_step, moved_by, status, job_id, or company_id", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(
        application.id,
        {
          step_id: review.id,
          from_step: interview.id,
          moved_by: hrB.id,
          status: "hired",
          job_id: new Types.ObjectId().toString(),
          company_id: companyB.id,
        },
        authHeaderFor(hrA, companyA.id)
      );
      expect(res.status).toBe(400);
    });
  });

  // ===== STATUS =====
  describe("terminal application statuses", () => {
    it.each(["rejected", "offered", "hired"] as const)("blocks movement for a(n) %s application", async (status) => {
      const application = await createApplicationIn(jobA, { status, current_step_id: review._id });
      const res = await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("leaves status/current_step unchanged after a blocked terminal-state move", async () => {
      const application = await createApplicationIn(jobA, { status: "hired", current_step_id: review._id });
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const reread = await Application.findById(application.id);
      expect(reread?.status).toBe("hired");
      expect(reread?.current_step_id?.toString()).toBe(review.id);
    });

    it("creates no history event for a blocked terminal-state move", async () => {
      const application = await createApplicationIn(jobA, { status: "rejected", current_step_id: review._id });
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      expect(await ApplicationStageTransition.countDocuments({ application_id: application.id })).toBe(0);
    });
  });

  // ===== TENANT =====
  describe("tenant isolation", () => {
    it("allows an HR user to move an Application in their own company", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
    });

    it("allows an Admin user to move an Application in their own company", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(admin, companyA.id));
      expect(res.status).toBe(200);
    });

    it("returns 404 for a cross-company movement attempt", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for cross-company history access", async () => {
      const application = await createApplicationIn(jobA);
      const res = await historyReq(application.public_id!, authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a well-formed but nonexistent application public_id", async () => {
      const res = await moveReq(`app_${"a".repeat(24)}`, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });
  });

  // ===== CLOSED JOB =====
  // Intentional product behavior (Hiring Pipeline Board UI ticket, closed-
  // Job clarification): closing a Job stops new candidate INTAKE only —
  // it must not freeze the existing recruitment workflow for applicants
  // who already applied. Closed != soft-deleted (see Job.model.ts).
  describe("closed (not deleted) Job", () => {
    it("allows movement for an Application whose Job is closed", async () => {
      const application = await createApplicationIn(jobA);
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });

      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      const reread = await Application.findById(application.id);
      expect(reread?.status).toBe("in_process");
      expect(reread?.current_step_id?.toString()).toBe(review.id);
    });
  });

  // ===== SOFT-DELETED JOB =====
  describe("soft-deleted Job", () => {
    it("blocks movement for an Application whose Job is soft-deleted", async () => {
      const application = await createApplicationIn(jobA);
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("makes no Application update when the Job is soft-deleted", async () => {
      const application = await createApplicationIn(jobA);
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      const reread = await Application.findById(application.id);
      expect(reread?.status).toBe("applied");
      expect(reread?.current_step_id).toBeNull();
    });

    it("creates no history event when the Job is soft-deleted", async () => {
      const application = await createApplicationIn(jobA);
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      expect(await ApplicationStageTransition.countDocuments({ application_id: application.id })).toBe(0);
    });

    it("keeps stage history readable after the Job is soft-deleted", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.transitions).toHaveLength(1);
    });
  });

  // ===== HISTORY API =====
  describe("GET stage-history", () => {
    it("returns [] for an Application with no movement yet", async () => {
      const application = await createApplicationIn(jobA);
      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.transitions).toEqual([]);
    });

    it("returns one record after one movement", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      expect(res.body.transitions).toHaveLength(1);
    });

    it("returns multiple records newest first", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));
      await moveReq(application.public_id!, { step_id: finalInterview.id }, authHeaderFor(hrA, companyA.id));

      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      expect(res.body.transitions.map((t: { to_step: { name: string } }) => t.to_step.name)).toEqual([
        "Final Interview",
        "Technical Interview",
        "Application Review",
      ]);
    });

    it("keeps the historical stage snapshot name after the stage is later renamed", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      await request(app)
        .patch(`/api/v1/jobs/${jobA.public_id}/hiring-steps/${review.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Initial Review" });

      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      expect(res.body.transitions[0].to_step.name).toBe("Application Review");

      const liveStep = await HiringStep.findById(review.id);
      expect(liveStep?.name).toBe("Initial Review");
    });

    it("keeps the historical stage snapshot after the stage is deleted", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      // Move away first — HiringStep deletion is blocked while a stage is
      // still referenced by current_step_id (existing rule, untouched by
      // this ticket).
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const deleteRes = await request(app)
        .delete(`/api/v1/jobs/${jobA.public_id}/hiring-steps/${review.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(deleteRes.status).toBe(204);

      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      const initialAssignment = res.body.transitions.find((t: { from_step: unknown }) => t.from_step === null);
      expect(initialAssignment.to_step.name).toBe("Application Review");
    });

    it("makes no AI or R2 call when reading history", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));

      expect(mockCreateScreening).not.toHaveBeenCalled();
      expect(mockLatestScreening).not.toHaveBeenCalled();
      expect(mockScreeningHistory).not.toHaveBeenCalled();
    });

    it("uses an explicit serializer that excludes internal fields", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id, note: "Looks strong." }, authHeaderFor(hrA, companyA.id));

      const res = await historyReq(application.public_id!, authHeaderFor(hrA, companyA.id));
      const transition = res.body.transitions[0];

      expect(Object.keys(transition).sort()).toEqual(
        ["id", "from_step", "to_step", "from_status", "to_status", "moved_by", "note", "created_at"].sort()
      );
      expect(Object.keys(transition.moved_by).sort()).toEqual(["id", "name"]);
      expect(JSON.stringify(res.body)).not.toMatch(/__v|password|company_id|job_id/i);
    });
  });

  // ===== TRANSACTION / FAILURE =====
  describe("transactional consistency", () => {
    it("rolls back the Application move when history-record creation fails", async () => {
      const application = await createApplicationIn(jobA);
      jest.spyOn(ApplicationStageTransition, "create").mockRejectedValueOnce(new Error("simulated failure") as never);

      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(500);

      const reread = await Application.findById(application.id);
      expect(reread?.status).toBe("applied");
      expect(reread?.current_step_id).toBeNull();
    });

    it("creates no history record when the Application update fails", async () => {
      const application = await createApplicationIn(jobA);
      jest.spyOn(Application, "findOneAndUpdate").mockRejectedValueOnce(new Error("simulated failure") as never);

      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(500);

      expect(await ApplicationStageTransition.countDocuments({ application_id: application.id })).toBe(0);
    });

    it("commits both the Application update and the history record together on success", async () => {
      const application = await createApplicationIn(jobA);
      const res = await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);

      const reread = await Application.findById(application.id);
      const transitionCount = await ApplicationStageTransition.countDocuments({ application_id: application.id });
      expect(reread?.current_step_id?.toString()).toBe(review.id);
      expect(transitionCount).toBe(1);
    });
  });

  // ===== CONCURRENCY =====
  describe("concurrency", () => {
    it("only allows one of two concurrent moves from the same starting state to succeed", async () => {
      const application = await createApplicationIn(jobA);

      const [resA, resB] = await Promise.all([
        moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id)),
        moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id)),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const transitionCount = await ApplicationStageTransition.countDocuments({ application_id: application.id });
      expect(transitionCount).toBe(1);

      const winner = resA.status === 200 ? resA : resB;
      const reread = await Application.findById(application.id);
      expect(reread?.current_step_id?.toString()).toBe(winner.body.application.current_step_id);
    });
  });

  // ===== REGRESSION =====
  describe("regression", () => {
    it("does not trigger AI screening", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      expect(mockCreateScreening).not.toHaveBeenCalled();
    });

    it("does not send email", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: review.id }, authHeaderFor(hrA, companyA.id));

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it("does not alter HiringStep ordering", async () => {
      const application = await createApplicationIn(jobA);
      await moveReq(application.public_id!, { step_id: interview.id }, authHeaderFor(hrA, companyA.id));

      const steps = await HiringStep.find({ job_id: jobA.id }).sort({ position: 1 });
      expect(steps.map((s) => s.name)).toEqual(["Application Review", "Technical Interview", "Final Interview"]);
      expect(steps.map((s) => s.position)).toEqual([0, 1, 2]);
    });
  });
});
