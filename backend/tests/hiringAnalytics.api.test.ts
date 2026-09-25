import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { HiringStep } from "../src/models/HiringStep.model";
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

const analyticsUrl = "/api/v1/hiring-analytics";

function cvFile() {
  return { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 };
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function createApplicationFor(job: JobDoc, overrides: Record<string, unknown> = {}) {
  const candidate = await Candidate.create({ full_name: "Test Candidate", email: `c-${new Types.ObjectId().toString()}@test.test` });
  return Application.create({ job_id: job.id, candidate_id: candidate._id, cv_file: cvFile(), status: "applied", ...overrides });
}

describe("GET /api/v1/hiring-analytics", () => {
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

  // 38. total applications correct
  it("38. counts total applications within the period by applied_at", async () => {
    await createApplicationFor(jobA, { applied_at: daysAgo(5) });
    await createApplicationFor(jobA, { applied_at: daysAgo(5) });
    await createApplicationFor(jobA, { applied_at: daysAgo(60) }); // outside 30d

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.total_applications).toBe(2);
  });

  // 39. hired correct
  it("39. counts hired applications within the period by hired_at", async () => {
    await createApplicationFor(jobA, { status: "hired", applied_at: daysAgo(20), hired_at: daysAgo(3) });
    await createApplicationFor(jobA, { status: "hired", applied_at: daysAgo(60), hired_at: daysAgo(45) }); // outside period

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.hired).toBe(1);
  });

  async function makeOffer(overrides: Record<string, unknown> = {}) {
    const application = await createApplicationFor(jobA);
    const candidate = await Candidate.findById(application.candidate_id);
    return Offer.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: candidate!._id,
      job_id: jobA.id,
      status: "sent",
      title: "Backend Engineer",
      created_by_user_id: hrA.id,
      updated_by_user_id: hrA.id,
      ...overrides,
    });
  }

  // 40. accepted offers correct
  it("40. counts accepted offers within the period by accepted_at", async () => {
    await makeOffer({ status: "accepted", accepted_at: daysAgo(3) });
    await makeOffer({ status: "accepted", accepted_at: daysAgo(60) }); // outside period

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.offers_accepted).toBe(1);
  });

  // 41. declined offers correct
  it("41. counts declined offers within the period by declined_at", async () => {
    await makeOffer({ status: "declined", declined_at: daysAgo(3) });

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.offers_declined).toBe(1);
  });

  // 42. pending offers correct
  it("42. counts pending (sent) offers within the period by created_at", async () => {
    await makeOffer({ status: "sent", sent_at: new Date() });

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.offer_outcomes.pending).toBe(1);
  });

  // 43. acceptance rate calculation correct
  it("43. computes offer acceptance rate correctly", async () => {
    await makeOffer({ status: "accepted", accepted_at: new Date() });
    await makeOffer({ status: "accepted", accepted_at: new Date() });
    await makeOffer({ status: "accepted", accepted_at: new Date() });
    await makeOffer({ status: "declined", declined_at: new Date() });

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.offer_acceptance_rate).toBe(75);
  });

  // 44. zero denominator returns null
  it("44. returns null acceptance rate when there are no accepted or declined offers", async () => {
    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.offer_acceptance_rate).toBeNull();
  });

  // 45. average time-to-hire correct
  it("45. computes average time-to-hire in days correctly", async () => {
    await createApplicationFor(jobA, { status: "hired", applied_at: daysAgo(10), hired_at: daysAgo(5) }); // 5 days
    await createApplicationFor(jobA, { status: "hired", applied_at: daysAgo(13), hired_at: daysAgo(3) }); // 10 days

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.average_time_to_hire_days).toBe(7.5);
  });

  // 46. no hires returns null
  it("46. returns null average time-to-hire when there are no hires in the period", async () => {
    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.average_time_to_hire_days).toBeNull();
  });

  // 47. applications by job correct
  it("47. groups applications by job correctly, only for jobs with matching applications", async () => {
    const jobC = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Frontend Developer", status: "active" });
    await createApplicationFor(jobA, { applied_at: daysAgo(3) });
    await createApplicationFor(jobA, { applied_at: daysAgo(3) });
    await createApplicationFor(jobC, { applied_at: daysAgo(3) });
    const jobWithNoApplications = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "No Apps", status: "active" });
    void jobWithNoApplications;

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    const byJob = res.body.applications_by_job as { job_title: string; count: number }[];
    expect(byJob).toEqual(
      expect.arrayContaining([
        { job_id: jobA.id, job_title: "Backend Developer", count: 2 },
        { job_id: jobC.id, job_title: "Frontend Developer", count: 1 },
      ])
    );
    expect(byJob.find((row) => row.job_title === "No Apps")).toBeUndefined();
  });

  // 48. current pipeline distribution correct
  it("48. computes current pipeline distribution correctly across every bucket", async () => {
    const review = await HiringStep.create({ job_id: jobA.id, name: "Review", type: "review", position: 0 });
    const interview = await HiringStep.create({ job_id: jobA.id, name: "Interview", type: "interview", position: 1 });
    const assessment = await HiringStep.create({ job_id: jobA.id, name: "Assessment", type: "assessment", position: 2 });
    const other = await HiringStep.create({ job_id: jobA.id, name: "Final", type: "other", position: 3 });

    await createApplicationFor(jobA, { status: "applied" }); // new applicant
    await createApplicationFor(jobA, { status: "in_process", current_step_id: review._id });
    await createApplicationFor(jobA, { status: "in_process", current_step_id: interview._id });
    await createApplicationFor(jobA, { status: "in_process", current_step_id: assessment._id });
    await createApplicationFor(jobA, { status: "in_process", current_step_id: other._id });
    await createApplicationFor(jobA, { status: "offered" });
    await createApplicationFor(jobA, { status: "offered", final_decision: "declined" });
    await createApplicationFor(jobA, { status: "hired", hired_at: new Date() });
    await createApplicationFor(jobA, { status: "rejected", rejected_at: new Date() });

    const res = await request(app).get(`${analyticsUrl}?range=all`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.pipeline_distribution).toEqual({
      new_applicants: 1,
      review: 1,
      interview: 1,
      assessment: 1,
      other: 1,
      offered: 1,
      hired: 1,
      rejected: 1,
      offer_declined: 1,
    });
  });

  // 49. offer outcome distribution correct
  it("49. computes offer outcome distribution correctly, excluding drafts", async () => {
    await makeOffer({ status: "accepted", accepted_at: new Date() });
    await makeOffer({ status: "declined", declined_at: new Date() });
    await makeOffer({ status: "sent" });
    await makeOffer({ status: "withdrawn" });
    await makeOffer({ status: "draft" });

    const res = await request(app).get(`${analyticsUrl}?range=all`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.offer_outcomes).toMatchObject({ accepted: 1, declined: 1, pending: 1, withdrawn: 1 });
  });

  // 50. date-range filter correct
  it("50. respects the 'all' range (no lower bound)", async () => {
    await createApplicationFor(jobA, { applied_at: daysAgo(500) });

    const res30 = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    const resAll = await request(app).get(`${analyticsUrl}?range=all`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res30.body.kpis.total_applications).toBe(0);
    expect(resAll.body.kpis.total_applications).toBe(1);
  });

  // 51. job filter correct if implemented
  it("51. filters everything by jobId when provided", async () => {
    const jobC = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Frontend Developer", status: "active" });
    await createApplicationFor(jobA, { applied_at: daysAgo(3) });
    await createApplicationFor(jobC, { applied_at: daysAgo(3) });

    const res = await request(app)
      .get(`${analyticsUrl}?range=30d&jobId=${jobA.public_id}`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.total_applications).toBe(1);
    expect(res.body.job_id).toBe(jobA.id);
  });

  it("returns 404 for a jobId belonging to another company", async () => {
    const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Other Job", status: "active" });
    const res = await request(app)
      .get(`${analyticsUrl}?jobId=${jobB.public_id}`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(404);
  });

  // Phase 1 dual-accept migration: the jobId filter is a "special
  // attention" case — resolved to Job's real internal id (echoed back as
  // job_id in the response) before being used against Application.job_id/
  // Offer.job_id.
  it("filters by jobId given as the Job's public_id, echoing back the real internal id", async () => {
    await createApplicationFor(jobA, { applied_at: daysAgo(3) });

    const res = await request(app)
      .get(`${analyticsUrl}?range=30d&jobId=${jobA.public_id}`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    expect(res.body.kpis.total_applications).toBe(1);
    expect(res.body.job_id).toBe(jobA.id);
  });

  // 52. tenant isolation
  it("52. never counts or lists another company's data", async () => {
    const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Other Job", status: "active" });
    await createApplicationFor(jobB, { applied_at: daysAgo(3) });

    const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.kpis.total_applications).toBe(0);
    expect(res.body.applications_by_job).toEqual([]);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get(analyticsUrl);
    expect(res.status).toBe(401);
  });

  describe("applications_over_time", () => {
    // 1. applications_over_time real counts
    it("1. returns real counts grouped into buckets, summing to the period total", async () => {
      await createApplicationFor(jobA, { applied_at: daysAgo(2) });
      await createApplicationFor(jobA, { applied_at: daysAgo(2) });
      await createApplicationFor(jobA, { applied_at: daysAgo(2) });

      const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      const sum = points.reduce((total, point) => total + point.count, 0);
      expect(sum).toBe(3);
      expect(points.some((point) => point.count === 3)).toBe(true);
    });

    // 2. respects company isolation
    it("2. never counts another company's applications", async () => {
      const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Other Job", status: "active" });
      await createApplicationFor(jobB, { applied_at: daysAgo(2) });

      const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      expect(points.reduce((total, point) => total + point.count, 0)).toBe(0);
    });

    // 3. respects 30d range — daily buckets, ~31 points, excludes older data
    it("3. buckets daily for 30d and excludes applications outside the window", async () => {
      await createApplicationFor(jobA, { applied_at: daysAgo(5) }); // inside
      await createApplicationFor(jobA, { applied_at: daysAgo(40) }); // outside

      const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      expect(points.length).toBeGreaterThanOrEqual(28);
      expect(points.length).toBeLessThanOrEqual(32);
      expect(points.reduce((total, point) => total + point.count, 0)).toBe(1);
      expect(points.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.period))).toBe(true);
    });

    // 4. respects 90d range — weekly buckets, far fewer points than daily would produce
    it("4. buckets weekly for 90d, producing far fewer points than daily granularity would", async () => {
      await createApplicationFor(jobA, { applied_at: daysAgo(10) });
      await createApplicationFor(jobA, { applied_at: daysAgo(85) });

      const res = await request(app).get(`${analyticsUrl}?range=90d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      expect(points.length).toBeGreaterThanOrEqual(12);
      expect(points.length).toBeLessThanOrEqual(15);
      expect(points.reduce((total, point) => total + point.count, 0)).toBe(2);
    });

    // 5. respects all-time behavior — monthly buckets, bounded (never thousands)
    it("5. buckets monthly for all-time and stays bounded, never thousands of points", async () => {
      await createApplicationFor(jobA, { applied_at: daysAgo(500) });
      await createApplicationFor(jobA, { applied_at: daysAgo(10) });

      const res = await request(app).get(`${analyticsUrl}?range=all`).set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      expect(points.length).toBeGreaterThan(0);
      expect(points.length).toBeLessThan(100); // ~17 months of real span, comfortably bounded
      expect(points.reduce((total, point) => total + point.count, 0)).toBe(2);
    });

    // 6. respects job filter
    it("6. scopes to the filtered job only", async () => {
      const jobC = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Frontend Developer", status: "active" });
      await createApplicationFor(jobA, { applied_at: daysAgo(2) });
      await createApplicationFor(jobC, { applied_at: daysAgo(2) });

      const res = await request(app)
        .get(`${analyticsUrl}?range=30d&jobId=${jobA.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      expect(points.reduce((total, point) => total + point.count, 0)).toBe(1);
    });

    // 7. uses applied_at
    it("7. groups by applied_at, not by document creation order", async () => {
      const specificDate = new Date();
      specificDate.setUTCDate(specificDate.getUTCDate() - 3);
      specificDate.setUTCHours(12, 0, 0, 0);
      await createApplicationFor(jobA, { applied_at: specificDate });

      const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      const points = res.body.applications_over_time as { period: string; count: number }[];
      const expectedPeriod = specificDate.toISOString().slice(0, 10);
      const bucket = points.find((point) => point.period === expectedPeriod);
      expect(bucket?.count).toBe(1);
    });

    // 8. empty period safe
    it("8. returns an empty array, not a wall of zero buckets, when there is no data at all", async () => {
      const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.applications_over_time).toEqual([]);
    });

    // 9. existing analytics metrics unchanged
    it("9. leaves every existing analytics field intact alongside the new one", async () => {
      await createApplicationFor(jobA, { applied_at: daysAgo(2) });

      const res = await request(app).get(`${analyticsUrl}?range=30d`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body).toMatchObject({
        range: "30d",
        job_id: null,
        kpis: { total_applications: 1 },
      });
      expect(res.body.applications_by_job).toBeDefined();
      expect(res.body.pipeline_distribution).toBeDefined();
      expect(res.body.offer_outcomes).toBeDefined();
      expect(res.body.applications_over_time).toBeDefined();
    });
  });
});
