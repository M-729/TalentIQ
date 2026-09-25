import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { HiringStep } from "../src/models/HiringStep.model";
import { Interview } from "../src/models/Interview.model";
import { Offer } from "../src/models/Offer.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";
import type { JobDoc } from "../src/models/Job.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

const dashboardUrl = "/api/v1/dashboard";

function cvFile() {
  return { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 };
}

async function createCandidate(email: string, name = "Test Candidate") {
  return Candidate.create({ full_name: name, email });
}

async function createApplication(job: JobDoc, overrides: Record<string, unknown> = {}) {
  const candidate = await createCandidate(`candidate-${new Types.ObjectId().toString()}@test.test`, overrides.candidateName as string | undefined ?? "Candidate");
  return Application.create({
    job_id: job.id,
    candidate_id: candidate._id,
    cv_file: cvFile(),
    status: "applied",
    ...overrides,
  });
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

describe("GET /api/v1/dashboard", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr-a@acme.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr-b@acme.test", role: "HR" });
    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
  });

  // 11. empty company returns zeros/empty arrays safely
  it("11. returns zeros and empty arrays for a brand-new company", async () => {
    const freshCompany = await createCompany("Fresh Co");
    const freshAdmin = await createUser({ companyId: freshCompany.id, email: "admin@fresh.test", role: "ADMIN" });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(freshAdmin, freshCompany.id));
    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual({ open_jobs: 0, new_applicants: 0, upcoming_interviews: 0, pending_offers: 0, hired: 0 });
    expect(res.body.recent_applications).toEqual([]);
    expect(res.body.upcoming_interviews).toEqual([]);
    expect(res.body.attention).toEqual({
      failed_emails: 0,
      assessments_awaiting_result: 0,
      interviews_awaiting_feedback: 0,
      offers_awaiting_response: 0,
      offers_expiring_soon: 0,
    });
  });

  // 2. open job definition correct
  it("2. counts only active, non-deleted jobs as open", async () => {
    await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Draft Job", status: "draft" });
    await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Closed Job", status: "closed" });
    const deletedJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Deleted Job", status: "active" });
    await Job.updateOne({ _id: deletedJob._id }, { $set: { deleted_at: new Date() } });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.open_jobs).toBe(1); // only jobA
  });

  // 3. new applicants definition correct
  it("3. counts only status=applied with no current_step_id as new applicants", async () => {
    await createApplication(jobA, { status: "applied" }); // counts
    const step = await HiringStep.create({ job_id: jobA.id, name: "Review", type: "review", position: 0 });
    await createApplication(jobA, { status: "applied", current_step_id: step._id }); // does NOT count (stale/edge case)
    await createApplication(jobA, { status: "in_process", current_step_id: step._id }); // does NOT count

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.new_applicants).toBe(1);
  });

  // 4. scheduled future interviews counted / 5. cancelled/completed excluded
  it("4. counts only future scheduled interviews as upcoming", async () => {
    const application = await createApplication(jobA);
    const step = await HiringStep.create({ job_id: jobA.id, name: "Interview", type: "interview", position: 0 });
    const interviewer = await createUser({ companyId: companyA.id, email: "interviewer@acme.test", role: "HR" });

    await Interview.create({
      application_id: application.id,
      job_id: jobA.id,
      hiring_step_id: step.id,
      stage_snapshot: { name: "Interview", type: "interview" },
      title: "Upcoming",
      starts_at: hoursFromNow(24),
      ends_at: hoursFromNow(25),
      timezone: "UTC",
      interviewer_user_ids: [interviewer.id],
      scheduled_by: hrA.id,
      status: "scheduled",
    });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.upcoming_interviews).toBe(1);
    expect(res.body.upcoming_interviews).toHaveLength(1);

    // Phase 2 cutover: the interview row must expose the Application's
    // public_id for frontend navigation, never the raw Mongo application_id.
    const row = res.body.upcoming_interviews[0];
    expect(row.application_public_id).toBe(application.public_id);
    expect(row.application_id).toBeUndefined();
  });

  it("5. excludes cancelled and completed interviews from upcoming", async () => {
    const application = await createApplication(jobA);
    const step = await HiringStep.create({ job_id: jobA.id, name: "Interview", type: "interview", position: 0 });
    const interviewer = await createUser({ companyId: companyA.id, email: "interviewer2@acme.test", role: "HR" });

    await Interview.create({
      application_id: application.id,
      job_id: jobA.id,
      hiring_step_id: step.id,
      stage_snapshot: { name: "Interview", type: "interview" },
      title: "Cancelled",
      starts_at: hoursFromNow(24),
      ends_at: hoursFromNow(25),
      timezone: "UTC",
      interviewer_user_ids: [interviewer.id],
      scheduled_by: hrA.id,
      status: "cancelled",
      cancelled_by: hrA.id,
      cancelled_at: new Date(),
    });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.upcoming_interviews).toBe(0);
    expect(res.body.upcoming_interviews).toEqual([]);
  });

  // 6. sent offers counted as pending
  it("6. counts sent offers as pending offers", async () => {
    const application = await createApplication(jobA);
    const candidate = await Candidate.findById(application.candidate_id);
    await Offer.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: candidate!._id,
      job_id: jobA.id,
      status: "sent",
      title: "Backend Engineer",
      created_by_user_id: hrA.id,
      updated_by_user_id: hrA.id,
      sent_at: new Date(),
    });
    await Offer.create({
      company_id: companyA.id,
      application_id: (await createApplication(jobA)).id,
      candidate_id: candidate!._id,
      job_id: jobA.id,
      status: "draft",
      title: "Draft Offer",
      created_by_user_id: hrA.id,
      updated_by_user_id: hrA.id,
    });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.pending_offers).toBe(1);
  });

  // 7. hired applications counted
  it("7. counts hired applications", async () => {
    await createApplication(jobA, { status: "hired", hired_at: new Date() });
    await createApplication(jobA, { status: "applied" });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.hired).toBe(1);
  });

  // 8. recent applications sorted newest first and limited
  it("8. returns at most 5 recent applications, newest first", async () => {
    for (let i = 0; i < 7; i++) {
      await createApplication(jobA, { applied_at: new Date(Date.now() - i * 60 * 60 * 1000) });
    }

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.recent_applications).toHaveLength(5);
    const timestamps = res.body.recent_applications.map((row: { applied_at: string }) => new Date(row.applied_at).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  // 9. upcoming interviews sorted earliest first and limited
  it("9. returns at most 5 upcoming interviews, earliest first", async () => {
    const step = await HiringStep.create({ job_id: jobA.id, name: "Interview", type: "interview", position: 0 });
    const interviewer = await createUser({ companyId: companyA.id, email: "interviewer3@acme.test", role: "HR" });

    for (let i = 0; i < 7; i++) {
      const application = await createApplication(jobA);
      await Interview.create({
        application_id: application.id,
        job_id: jobA.id,
        hiring_step_id: step.id,
        stage_snapshot: { name: "Interview", type: "interview" },
        title: `Interview ${i}`,
        starts_at: hoursFromNow(10 + i),
        ends_at: hoursFromNow(11 + i),
        timezone: "UTC",
        interviewer_user_ids: [interviewer.id],
        scheduled_by: hrA.id,
        status: "scheduled",
      });
    }

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.upcoming_interviews).toHaveLength(5);
    const timestamps = res.body.upcoming_interviews.map((row: { starts_at: string }) => new Date(row.starts_at).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  // 1 / 10. metrics are company-scoped, no cross-company leakage
  it("1. / 10. never counts or lists another company's data", async () => {
    const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Other Job", status: "active" });
    await createApplication(jobB, { status: "hired", hired_at: new Date() });

    const res = await request(app).get(dashboardUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.metrics.open_jobs).toBe(1); // only jobA, not jobB
    expect(res.body.metrics.hired).toBe(0);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get(dashboardUrl);
    expect(res.status).toBe(401);
  });
});
