import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Scheduling now attempts a real candidate notification email (see
// interviewNotification.service.ts) — mocked here at the same boundary
// interview.api.test.ts/publicApplication.api.test.ts already use, so
// this suite never depends on (or accidentally exercises) real SMTP.
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

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

function listUrl(query = "") {
  return `/api/v1/interviews${query}`;
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

describe("Company-wide Interview list API (GET /api/v1/interviews)", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let interviewerA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let jobA2: JobDoc;
  let interviewStage: HiringStepDoc;
  let interviewStage2: HiringStepDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    interviewerA = await createUser({ companyId: companyA.id, email: "interviewer@a.test", role: "HR", name: "Alex Interviewer" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    jobA2 = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Frontend Developer", status: "active" });
    interviewStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 0 });
    interviewStage2 = await HiringStep.create({ job_id: jobA2.id, name: "Technical Interview", type: "interview", position: 0 });
  });

  async function createApplicationInInterviewStage(job: JobDoc, step: HiringStepDoc, candidateOverrides: Record<string, unknown> = {}) {
    const candidate = await Candidate.create({
      full_name: "Sarah Ahmed",
      email: `sarah-${new Types.ObjectId().toString()}@candidate.test`,
      ...candidateOverrides,
    });
    return Application.create({
      job_id: job.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
      current_step_id: step._id,
    });
  }

  async function scheduleOne(job: JobDoc, step: HiringStepDoc, overrides: Record<string, unknown> = {}) {
    const application = await createApplicationInInterviewStage(job, step);
    const res = await request(app)
      .post(scheduleUrl(application.id))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send(validBody({ interviewer_user_ids: [interviewerA.id], ...overrides }));
    return { application, interview: res.body.interview };
  }

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get(listUrl());
    expect(res.status).toBe(401);
  });

  it("returns [] when the company has no interviews", async () => {
    const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    expect(res.body.interviews).toEqual([]);
    expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it("returns interviews scoped to the caller's own company only", async () => {
    await scheduleOne(jobA, interviewStage);

    const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "B Job", status: "active" });
    const interviewStageB = await HiringStep.create({ job_id: jobB.id, name: "Technical Interview", type: "interview", position: 0 });
    const candidateB = await Candidate.create({ full_name: "Bob", email: "bob@candidate.test" });
    const applicationB = await Application.create({
      job_id: jobB.id,
      candidate_id: candidateB._id,
      cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 1 },
      status: "in_process",
      current_step_id: interviewStageB._id,
    });
    await request(app)
      .post(scheduleUrl(applicationB.id))
      .set("Authorization", authHeaderFor(hrB, companyB.id))
      .send(validBody({ interviewer_user_ids: [hrB.id] }));

    const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    expect(res.body.interviews).toHaveLength(1);

    const resB = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrB, companyB.id));
    expect(resB.body.interviews).toHaveLength(1);
    expect(resB.body.interviews[0].job.id).toBe(jobB.id);
  });

  it("includes candidate, job, stage, interviewers, and calendar in each row", async () => {
    const { application } = await scheduleOne(jobA, interviewStage);
    const candidate = await Candidate.findById(application.candidate_id);

    const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    const row = res.body.interviews[0];
    expect(row.candidate).toEqual({ id: candidate!.id, name: candidate!.full_name, email: candidate!.email });
    expect(row.job).toEqual({ id: jobA.id, title: jobA.title });
    expect(row.stage).toEqual({ id: interviewStage.id, name: "Technical Interview", type: "interview" });
    expect(row.interviewers).toHaveLength(1);
    expect(row.interviewers[0].email).toBe("interviewer@a.test");
    expect(row.calendar).toBeNull();
    expect(row).not.toHaveProperty("company_id");
    expect(row).not.toHaveProperty("calendar_owner_user_id");
  });

  it("filters by status", async () => {
    const first = await scheduleOne(jobA, interviewStage);
    await request(app).patch(`/api/v1/interviews/${first.interview.id}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

    const scheduledRes = await request(app).get(listUrl("?status=scheduled")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(scheduledRes.body.interviews).toEqual([]);

    const cancelledRes = await request(app).get(listUrl("?status=cancelled")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(cancelledRes.body.interviews).toHaveLength(1);
  });

  it("filters by jobId, verified to belong to the caller's company", async () => {
    await scheduleOne(jobA, interviewStage);
    await scheduleOne(jobA2, interviewStage2);

    const res = await request(app).get(listUrl(`?jobId=${jobA.id}`)).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.interviews).toHaveLength(1);
    expect(res.body.interviews[0].job.id).toBe(jobA.id);
  });

  it("returns 404 for a jobId filter belonging to another company", async () => {
    const res = await request(app).get(listUrl(`?jobId=${jobA.id}`)).set("Authorization", authHeaderFor(hrB, companyB.id));
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed jobId filter", async () => {
    const res = await request(app).get(listUrl("?jobId=not-an-id")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(400);
  });

  it("filters upcoming vs past interviews", async () => {
    const application = await createApplicationInInterviewStage(jobA, interviewStage);
    const { Interview } = await import("../src/models/Interview.model");
    await Interview.create({
      application_id: application.id,
      job_id: jobA.id,
      hiring_step_id: interviewStage.id,
      stage_snapshot: { name: interviewStage.name, type: "interview" },
      title: "Past interview",
      starts_at: new Date(Date.now() - 48 * 60 * 60 * 1000),
      ends_at: new Date(Date.now() - 47 * 60 * 60 * 1000),
      timezone: "Asia/Beirut",
      interviewer_user_ids: [interviewerA._id],
      scheduled_by: hrA._id,
      status: "completed",
    });
    await scheduleOne(jobA2, interviewStage2);

    const upcoming = await request(app).get(listUrl("?when=upcoming")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(upcoming.body.interviews).toHaveLength(1);
    expect(upcoming.body.interviews[0].title).not.toBe("Past interview");

    const past = await request(app).get(listUrl("?when=past")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(past.body.interviews).toHaveLength(1);
    expect(past.body.interviews[0].title).toBe("Past interview");
  });

  it("paginates results", async () => {
    for (let i = 0; i < 3; i++) {
      const application = await createApplicationInInterviewStage(jobA, interviewStage);
      await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], starts_at: hoursFromNow(10 + i), ends_at: hoursFromNow(11 + i) }));
    }

    const res = await request(app).get(listUrl("?page=1&limit=2")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.interviews).toHaveLength(2);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const page2 = await request(app).get(listUrl("?page=2&limit=2")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(page2.body.interviews).toHaveLength(1);
  });

  it("rejects a limit above the safe maximum", async () => {
    const res = await request(app).get(listUrl("?limit=1000")).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(400);
  });

  it("batches User/Candidate/Job lookups instead of one query per Interview", async () => {
    await scheduleOne(jobA, interviewStage);
    await scheduleOne(jobA2, interviewStage2);

    const { User } = await import("../src/models/User.model");
    const { Candidate: CandidateModel } = await import("../src/models/Candidate.model");
    const userFindSpy = jest.spyOn(User, "find");
    const candidateFindSpy = jest.spyOn(CandidateModel, "find");

    await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));

    expect(userFindSpy).toHaveBeenCalledTimes(1);
    expect(candidateFindSpy).toHaveBeenCalledTimes(1);
    userFindSpy.mockRestore();
    candidateFindSpy.mockRestore();
  });
});
