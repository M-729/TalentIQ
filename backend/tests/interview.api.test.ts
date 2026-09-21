import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { Interview } from "../src/models/Interview.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Interview scheduling must never touch AI or email — mocked at the same
// boundaries stageTransition.api.test.ts already mocks, so PRODUCT RULES
// tests below can assert they were never called.
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

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function scheduleUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/interviews`;
}
function interviewUrl(interviewId: string) {
  return `/api/v1/interviews/${interviewId}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Backend Technical Interview",
    starts_at: hoursFromNow(24),
    ends_at: hoursFromNow(25),
    timezone: "Asia/Beirut",
    interviewer_user_ids: [],
    ...overrides,
  };
}

describe("Interview scheduling API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let interviewerA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let interviewerB: UserDoc;
  let jobA: JobDoc;
  let review: HiringStepDoc;
  let interviewStage: HiringStepDoc;
  let assessment: HiringStepDoc;
  let other: HiringStepDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    interviewerA = await createUser({ companyId: companyA.id, email: "interviewer@a.test", role: "HR", name: "Alex Interviewer" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });
    interviewerB = await createUser({ companyId: companyB.id, email: "interviewer@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    review = await HiringStep.create({ job_id: jobA.id, name: "Application Review", type: "review", position: 0 });
    interviewStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 1 });
    assessment = await HiringStep.create({ job_id: jobA.id, name: "Technical Exam", type: "assessment", position: 2 });
    other = await HiringStep.create({ job_id: jobA.id, name: "Reference Check", type: "other", position: 3 });

    mockCreateScreening.mockReset();
    mockLatestScreening.mockReset();
    mockScreeningHistory.mockReset();
    emailService.send.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createApplicationIn(overrides: Record<string, unknown> = {}): Promise<ApplicationDoc> {
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

  async function createApplicationInInterviewStage(overrides: Record<string, unknown> = {}) {
    return createApplicationIn({ status: "in_process", current_step_id: interviewStage._id, ...overrides });
  }

  // ===== SCHEDULE AUTH/TENANCY =====
  describe("schedule: auth and tenancy", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app).post(scheduleUrl(application.id)).send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(401);
    });

    // No "wrong role → 403" test exists here deliberately: USER_ROLES is
    // exactly ["HR", "ADMIN"] (enforced at the Mongoose schema level, so
    // no User with any other role can even exist), requireAuth resolves
    // req.auth.role from the DATABASE record on every request (not from
    // the JWT payload, so a forged token role claim wouldn't be trusted
    // either — see auth.middleware.ts), and these routes allow both HR
    // and ADMIN. requireRole's 403 behavior itself is already
    // exhaustively tested generically in authorization.test.ts; there is
    // no route-specific behavior here left to duplicate.

    it("allows an authenticated HR user in the same company", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
    });

    it("allows an authenticated Admin user in the same company", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(admin, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
    });

    it("returns 404 for a cross-company Application", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send(validBody({ interviewer_user_ids: [interviewerB.id] }));
      expect(res.status).toBe(404);
    });

    it("returns 404 for a nonexistent Application", async () => {
      const res = await request(app)
        .post(scheduleUrl(new Types.ObjectId().toString()))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed Application id", async () => {
      const res = await request(app)
        .post(scheduleUrl("not-an-object-id"))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(400);
    });
  });

  // ===== STAGE TYPE =====
  describe("schedule: current stage type requirement", () => {
    it("works when the current stage type is interview", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
    });

    it("returns 409 when the current stage type is review", async () => {
      const application = await createApplicationIn({ status: "in_process", current_step_id: review._id });
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("This application is not currently in an interview stage.");
    });

    it("returns 409 when the current stage type is assessment", async () => {
      const application = await createApplicationIn({ status: "in_process", current_step_id: assessment._id });
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(409);
    });

    it("returns 409 when the current stage type is other", async () => {
      const application = await createApplicationIn({ status: "in_process", current_step_id: other._id });
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(409);
    });

    it("returns 409 when current_step_id is null", async () => {
      const application = await createApplicationIn({ status: "applied", current_step_id: null });
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(409);
    });

    it("fails safely when current_step_id points to a stage from another Job", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Other Job", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: otherJob.id, name: "Foreign Interview", type: "interview", position: 0 });
      const application = await createApplicationIn({ status: "in_process", current_step_id: foreignStep._id });

      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      expect(res.status).toBe(409);
      expect(await Interview.countDocuments({ application_id: application.id })).toBe(0);
    });
  });

  // ===== STATUS =====
  describe("schedule: Application status requirement", () => {
    it("works for in_process", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
    });

    it.each(["rejected", "offered", "hired"] as const)("blocks scheduling for a(n) %s application", async (status) => {
      const application = await createApplicationIn({ status, current_step_id: interviewStage._id });
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(409);
    });

    it("blocks scheduling for an applied application with no current step", async () => {
      const application = await createApplicationIn();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(409);
    });
  });

  // ===== TIME =====
  describe("schedule: time validation", () => {
    it("works for a valid future range", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], starts_at: hoursFromNow(2), ends_at: hoursFromNow(3) }));
      expect(res.status).toBe(201);
    });

    it("rejects a past starts_at", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], starts_at: hoursFromNow(-1), ends_at: hoursFromNow(1) }));
      expect(res.status).toBe(400);
    });

    it("rejects ends_at before starts_at", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], starts_at: hoursFromNow(3), ends_at: hoursFromNow(2) }));
      expect(res.status).toBe(400);
    });

    it("rejects equal starts_at/ends_at", async () => {
      const application = await createApplicationInInterviewStage();
      const same = hoursFromNow(3);
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], starts_at: same, ends_at: same }));
      expect(res.status).toBe(400);
    });

    it("rejects an excessive duration (> 8 hours)", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], starts_at: hoursFromNow(2), ends_at: hoursFromNow(11) }));
      expect(res.status).toBe(400);
    });

    it("rejects an invalid timezone", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], timezone: "Not/A_Timezone" }));
      expect(res.status).toBe(400);
    });

    it("accepts Asia/Beirut", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], timezone: "Asia/Beirut" }));
      expect(res.status).toBe(201);
      expect(res.body.interview.timezone).toBe("Asia/Beirut");
    });

    it("accepts Europe/Berlin", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], timezone: "Europe/Berlin" }));
      expect(res.status).toBe(201);
      expect(res.body.interview.timezone).toBe("Europe/Berlin");
    });
  });

  // ===== INTERVIEWERS =====
  describe("schedule: interviewer validation", () => {
    it("requires at least one interviewer", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [] }));
      expect(res.status).toBe(400);
    });

    it("accepts a same-company User as an interviewer", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
      expect(res.body.interview.interviewers).toHaveLength(1);
      expect(res.body.interview.interviewers[0].email).toBe("interviewer@a.test");
    });

    it("accepts multiple interviewers", async () => {
      const secondInterviewer = await createUser({ companyId: companyA.id, email: "second@a.test", role: "HR" });
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id, secondInterviewer.id] }));
      expect(res.status).toBe(201);
      expect(res.body.interview.interviewers).toHaveLength(2);
    });

    it("rejects a cross-company interviewer safely", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerB.id] }));
      expect(res.status).toBe(400);
      expect(res.body.error.message).not.toMatch(/company|tenant/i);
    });

    it("rejects a nonexistent interviewer", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [new Types.ObjectId().toString()] }));
      expect(res.status).toBe(400);
    });

    it("normalizes duplicate interviewer ids", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id, interviewerA.id] }));
      expect(res.status).toBe(201);
      expect(res.body.interview.interviewers).toHaveLength(1);
    });

    it("cannot inject arbitrary interviewer data beyond an id", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [{ id: interviewerA.id, name: "Injected Name" }] }));
      // Zod rejects a non-string array element outright.
      expect(res.status).toBe(400);
    });
  });

  // ===== DUPLICATE =====
  describe("schedule: duplicate active Interview protection", () => {
    it("returns 409 when a second scheduled Interview is attempted for the same Application+stage", async () => {
      const application = await createApplicationInInterviewStage();
      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      expect(res.status).toBe(409);
      expect(await Interview.countDocuments({ application_id: application.id })).toBe(1);
    });

    it("allows a new Interview after the previous one for the same stage was cancelled", async () => {
      const application = await createApplicationInInterviewStage();
      const first = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      await request(app)
        .patch(`${interviewUrl(first.body.interview.id)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      const second = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      expect(second.status).toBe(201);
    });

    it("produces exactly one scheduled Interview under concurrent duplicate scheduling", async () => {
      const application = await createApplicationInInterviewStage();

      const [resA, resB] = await Promise.all([
        request(app)
          .post(scheduleUrl(application.id))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send(validBody({ interviewer_user_ids: [interviewerA.id] })),
        request(app)
          .post(scheduleUrl(application.id))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send(validBody({ interviewer_user_ids: [interviewerA.id] })),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect(await Interview.countDocuments({ application_id: application.id, status: "scheduled" })).toBe(1);
    });
  });

  // ===== LIST / DETAIL =====
  describe("list and detail", () => {
    it("returns [] for an Application with no Interviews", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app).get(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.interviews).toEqual([]);
    });

    it("returns Interviews for an Application", async () => {
      const application = await createApplicationInInterviewStage();
      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const res = await request(app).get(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.interviews).toHaveLength(1);
    });

    it("orders Interviews deterministically (starts_at DESC)", async () => {
      const application = await createApplicationInInterviewStage();
      await Interview.create({
        application_id: application.id,
        job_id: jobA.id,
        hiring_step_id: interviewStage.id,
        stage_snapshot: { name: interviewStage.name, type: "interview" },
        title: "First scheduled",
        starts_at: new Date(hoursFromNow(2)),
        ends_at: new Date(hoursFromNow(3)),
        timezone: "Asia/Beirut",
        interviewer_user_ids: [interviewerA._id],
        scheduled_by: hrA._id,
        status: "cancelled",
        cancelled_at: new Date(),
      });
      await Interview.create({
        application_id: application.id,
        job_id: jobA.id,
        hiring_step_id: interviewStage.id,
        stage_snapshot: { name: interviewStage.name, type: "interview" },
        title: "Later scheduled",
        starts_at: new Date(hoursFromNow(20)),
        ends_at: new Date(hoursFromNow(21)),
        timezone: "Asia/Beirut",
        interviewer_user_ids: [interviewerA._id],
        scheduled_by: hrA._id,
        status: "scheduled",
      });

      const res = await request(app).get(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.interviews.map((i: { title: string }) => i.title)).toEqual(["Later scheduled", "First scheduled"]);
    });

    it("returns Interview detail", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const res = await request(app)
        .get(interviewUrl(scheduleRes.body.interview.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.interview.id).toBe(scheduleRes.body.interview.id);
    });

    it("returns 404 for cross-company Interview detail", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const res = await request(app)
        .get(interviewUrl(scheduleRes.body.interview.id))
        .set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    it("uses an explicit serializer excluding internal/unsafe fields", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      expect(JSON.stringify(scheduleRes.body)).not.toMatch(/__v|password|company_id|job_id|application_id/i);
      expect(Object.keys(scheduleRes.body.interview).sort()).toEqual(
        ["id", "title", "stage", "starts_at", "ends_at", "timezone", "status", "interviewers", "scheduled_by", "cancellation", "created_at", "updated_at"].sort()
      );
    });

    it("batches User lookups instead of one query per Interview", async () => {
      const application = await createApplicationInInterviewStage();
      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      const secondApplication = await createApplicationInInterviewStage();
      await request(app)
        .post(scheduleUrl(secondApplication.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const { User } = await import("../src/models/User.model");
      const findSpy = jest.spyOn(User, "find");

      await request(app).get(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(findSpy).toHaveBeenCalledTimes(1);
      findSpy.mockRestore();
    });
  });

  // ===== RESCHEDULE =====
  describe("reschedule", () => {
    async function scheduleOne() {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      return { application, interviewId: res.body.interview.id as string };
    }

    it("reschedules a scheduled Interview", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Europe/Berlin" });
      expect(res.status).toBe(200);
    });

    it("persists the new time", async () => {
      const { interviewId } = await scheduleOne();
      const newStart = hoursFromNow(48);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: hoursFromNow(49), timezone: "Europe/Berlin" });
      expect(new Date(res.body.interview.starts_at).getTime()).toBe(new Date(newStart).getTime());
    });

    it("persists the new timezone", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Europe/Berlin" });
      expect(res.body.interview.timezone).toBe("Europe/Berlin");
    });

    it("validates interviewer changes", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut", interviewer_user_ids: [interviewerB.id] });
      expect(res.status).toBe(400);
    });

    it("leaves the stage_snapshot unchanged", async () => {
      const { interviewId } = await scheduleOne();
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Europe/Berlin" });

      const reread = await Interview.findById(interviewId);
      expect(reread?.stage_snapshot.name).toBe("Technical Interview");
      expect(reread?.stage_snapshot.type).toBe("interview");
    });

    it("returns 409 for a cancelled Interview", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });
      expect(res.status).toBe(409);
    });

    it("returns 409 for a completed Interview", async () => {
      const { interviewId } = await scheduleOne();
      await Interview.updateOne({ _id: interviewId }, { $set: { status: "completed" } });

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });
      expect(res.status).toBe(409);
    });

    it("returns 404 for a cross-company reschedule attempt", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });
      expect(res.status).toBe(404);
    });

    it("only allows one of a concurrent cancel + reschedule to succeed", async () => {
      const { interviewId } = await scheduleOne();

      const [cancelRes, rescheduleRes] = await Promise.all([
        request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({}),
        request(app)
          .patch(`${interviewUrl(interviewId)}/reschedule`)
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" }),
      ]);

      // Both requests are guarded on { status: "scheduled" } at write
      // time — regardless of which wins the race, exactly one succeeds.
      const statuses = [cancelRes.status, rescheduleRes.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });

  // ===== CANCEL =====
  describe("cancel", () => {
    async function scheduleOne() {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      return { application, interviewId: res.body.interview.id as string };
    }

    it("cancels a scheduled Interview", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ reason: "Candidate requested another date" });
      expect(res.status).toBe(200);
    });

    it("sets status to cancelled", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const reread = await Interview.findById(interviewId);
      expect(reread?.status).toBe("cancelled");
    });

    it("sets cancelled_at", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const reread = await Interview.findById(interviewId);
      expect(reread?.cancelled_at).toBeInstanceOf(Date);
    });

    it("sets cancelled_by to the authenticated actor", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const reread = await Interview.findById(interviewId);
      expect(reread?.cancelled_by?.toString()).toBe(hrA.id);
    });

    it("stores the optional reason", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ reason: "Candidate requested another date" });
      expect(res.body.interview.cancellation.reason).toBe("Candidate requested another date");
    });

    it("returns 409 on a second cancel", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const res = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
    });

    it("returns 409 for a completed Interview", async () => {
      const { interviewId } = await scheduleOne();
      await Interview.updateOne({ _id: interviewId }, { $set: { status: "completed" } });
      const res = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
    });

    it("never physically deletes the Interview document", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(await Interview.findById(interviewId)).not.toBeNull();
    });
  });

  // ===== JOB LIFECYCLE =====
  describe("Job lifecycle rules", () => {
    it("allows scheduling for an active Job", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
    });

    it("allows scheduling for a closed (not deleted) Job", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(201);
    });

    it("allows rescheduling for a closed Job", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });

      const res = await request(app)
        .patch(`${interviewUrl(scheduleRes.body.interview.id)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });
      expect(res.status).toBe(200);
    });

    it("allows cancelling for a closed Job", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });

      const res = await request(app)
        .patch(`${interviewUrl(scheduleRes.body.interview.id)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});
      expect(res.status).toBe(200);
    });

    it("blocks NEW scheduling for a soft-deleted Job", async () => {
      const application = await createApplicationInInterviewStage();
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(res.status).toBe(404);
    });

    it("blocks reschedule for a soft-deleted Job", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .patch(`${interviewUrl(scheduleRes.body.interview.id)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });
      expect(res.status).toBe(404);
    });

    it("keeps historical Interview reads working after Job soft-delete", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const listRes = await request(app).get(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(listRes.status).toBe(200);
      expect(listRes.body.interviews).toHaveLength(1);

      const detailRes = await request(app)
        .get(interviewUrl(scheduleRes.body.interview.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detailRes.status).toBe(200);
    });

    it("still allows cancelling an already-scheduled Interview after Job soft-delete", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app)
        .patch(`${interviewUrl(scheduleRes.body.interview.id)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ reason: "Job closed administratively" });
      expect(res.status).toBe(200);
      expect(res.body.interview.status).toBe("cancelled");
    });

    it("never deletes Interview records when the Job is soft-deleted", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      expect(await Interview.findById(scheduleRes.body.interview.id)).not.toBeNull();
    });
  });

  // ===== PRODUCT RULES =====
  describe("product rules", () => {
    it("moving an Application into an interview stage does NOT auto-create an Interview", async () => {
      const application = await createApplicationIn();

      await request(app)
        .patch(`/api/v1/applications/${application.id}/hiring-step`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ step_id: interviewStage.id });

      expect(await Interview.countDocuments({ application_id: application.id })).toBe(0);
    });

    it("scheduling an Interview does NOT move the Application", async () => {
      const application = await createApplicationInInterviewStage();
      const before = await Application.findById(application.id);

      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const after = await Application.findById(application.id);
      expect(after?.status).toBe(before?.status);
      expect(after?.current_step_id?.toString()).toBe(before?.current_step_id?.toString());
    });

    it("scheduling an Interview does NOT run AI", async () => {
      const application = await createApplicationInInterviewStage();
      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      expect(mockCreateScreening).not.toHaveBeenCalled();
      expect(mockLatestScreening).not.toHaveBeenCalled();
      expect(mockScreeningHistory).not.toHaveBeenCalled();
    });

    it("scheduling an Interview does NOT send email", async () => {
      const application = await createApplicationInInterviewStage();
      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      expect(emailService.send).not.toHaveBeenCalled();
    });

    it("scheduling an Interview does NOT populate calendar/meeting fields (no Google call)", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      const stored = await Interview.findById(res.body.interview.id);
      expect(stored?.get("calendar_event_id")).toBeNull();
      expect(stored?.get("meeting_url")).toBeNull();
    });

    it("determines interview eligibility by stage TYPE, not stage NAME", async () => {
      const namedInterviewButWrongType = await HiringStep.create({
        job_id: jobA.id,
        name: "Technical Interview Prep",
        type: "review",
        position: 4,
      });
      const namedUnrelatedButInterviewType = await HiringStep.create({
        job_id: jobA.id,
        name: "CTO Meeting",
        type: "interview",
        position: 5,
      });

      const rejected = await createApplicationIn({ status: "in_process", current_step_id: namedInterviewButWrongType._id });
      const resRejected = await request(app)
        .post(scheduleUrl(rejected.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(resRejected.status).toBe(409);

      const accepted = await createApplicationIn({ status: "in_process", current_step_id: namedUnrelatedButInterviewType._id });
      const resAccepted = await request(app)
        .post(scheduleUrl(accepted.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));
      expect(resAccepted.status).toBe(201);
    });
  });

  // ===== TITLE DEFAULT =====
  describe("title behavior", () => {
    it("defaults the title to the current HiringStep's name when omitted", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], title: undefined }));
      expect(res.body.interview.title).toBe("Technical Interview");
    });

    it("uses the provided title when given", async () => {
      const application = await createApplicationInInterviewStage();
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], title: "Custom Title" }));
      expect(res.body.interview.title).toBe("Custom Title");
    });
  });

  // ===== STAGE SNAPSHOT =====
  describe("stage snapshot behavior", () => {
    it("preserves the historical stage name after the live HiringStep is renamed", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id] }));

      await request(app)
        .patch(`/api/v1/jobs/${jobA.id}/hiring-steps/${interviewStage.id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Engineering Interview" });

      const res = await request(app)
        .get(interviewUrl(scheduleRes.body.interview.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.interview.stage.name).toBe("Technical Interview");

      const liveStep = await HiringStep.findById(interviewStage.id);
      expect(liveStep?.name).toBe("Engineering Interview");
    });
  });
});
