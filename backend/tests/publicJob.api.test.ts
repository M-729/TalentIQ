import request from "supertest";
import { createApp } from "../src/app";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

describe("Public Job API", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany("Acme Recruiting Co");
    hr = await createUser({ companyId: company.id, email: "hr@public-job.test", role: "HR" });
  });

  it("returns an active job without an Authorization header", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Public Backend Role",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);

    expect(res.status).toBe(200);
    expect(res.body.job.title).toBe("Public Backend Role");
  });

  it("includes the company's public display name", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "With Company Name",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);

    expect(res.status).toBe(200);
    expect(res.body.job.company_name).toBe("Acme Recruiting Co");
  });

  it("does not expose created_by, company_id, or __v", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "No Internal Fields",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);

    expect(res.status).toBe(200);
    expect(res.body.job.created_by).toBeUndefined();
    expect(res.body.job.company_id).toBeUndefined();
    expect(res.body.job.__v).toBeUndefined();
  });

  it("returns 404 for a draft job", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Still A Draft",
      status: "draft",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a closed job", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "No Longer Open",
      status: "closed",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent job, indistinguishable from draft/closed", async () => {
    const res = await request(app).get(`/api/v1/public/jobs/job_${"a".repeat(24)}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Job not found");
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app).get("/api/v1/public/jobs/not-an-object-id");
    expect(res.status).toBe(400);
  });

  it("returns an active job looked up by its public_id", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Public Id Lookup",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);

    expect(res.status).toBe(200);
    expect(res.body.job.title).toBe("Public Id Lookup");
    expect(res.body.job.public_id).toBe(job.public_id);
  });

  // Phase 2 cutover: legacy dual-accept lookup is gone — a raw Mongo
  // ObjectId is now just an invalid id format, not an alternate valid id,
  // and must never resolve to the job even though it is active/published.
  it("rejects a job looked up by its legacy Mongo ObjectId", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Legacy ObjectId Lookup",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for a draft job looked up by its public_id (publication rule still enforced)", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Draft By Public Id",
      status: "draft",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`);
    expect(res.status).toBe(404);
  });

  it("does not require authentication even when no token is present at all", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Truly Public",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.public_id}`).unset("Authorization");
    expect(res.status).toBe(200);
  });

  // ===== PUBLIC LIST =====
  describe("GET /api/v1/public/jobs (list)", () => {
    // 1. public list returns active/published Jobs
    it("returns active jobs", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });

      const res = await request(app).get("/api/v1/public/jobs");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].title).toBe("Backend Engineer");
    });

    // 2. draft/unpublished excluded
    it("excludes draft jobs", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Still Drafting", status: "draft" });

      const res = await request(app).get("/api/v1/public/jobs");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(0);
    });

    // 3. closed excluded
    it("excludes closed jobs", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "No Longer Hiring", status: "closed" });

      const res = await request(app).get("/api/v1/public/jobs");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(0);
    });

    // 4. soft-deleted excluded
    it("excludes soft-deleted jobs even when status is still active", async () => {
      await Job.create({
        company_id: company.id,
        created_by: hr.id,
        title: "Deleted But Active",
        status: "active",
        deleted_at: new Date(),
      });

      const res = await request(app).get("/api/v1/public/jobs");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(0);
    });

    // 5. jobs from appropriate companies can appear publicly without leaking tenancy data
    it("shows active jobs from multiple companies together, never leaking company_id", async () => {
      const companyB = await createCompany("Beta Talent Inc");
      const hrB = await createUser({ companyId: companyB.id, email: "hr@public-job-b.test", role: "HR" });

      await Job.create({ company_id: company.id, created_by: hr.id, title: "Frontend Engineer", status: "active" });
      await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Data Analyst", status: "active" });

      const res = await request(app).get("/api/v1/public/jobs");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(2);
      const companyNames = res.body.jobs.map((job: { company_name: string }) => job.company_name).sort();
      expect(companyNames).toEqual(["Acme Recruiting Co", "Beta Talent Inc"]);
      expect(JSON.stringify(res.body)).not.toMatch(/company_id/i);
    });

    // 6. search works
    it("filters by title search, case-insensitively", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Senior Backend Engineer", status: "active" });
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Product Designer", status: "active" });

      const res = await request(app).get("/api/v1/public/jobs?search=backend");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].title).toBe("Senior Backend Engineer");
    });

    it("filters by location", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Remote Role", status: "active", location: "Remote" });
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Onsite Role", status: "active", location: "Beirut" });

      const res = await request(app).get("/api/v1/public/jobs?location=beirut");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].title).toBe("Onsite Role");
    });

    it("returns an empty list, not an error, when search matches nothing", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });

      const res = await request(app).get("/api/v1/public/jobs?search=zzz-nonexistent-zzz");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(0);
    });

    // 7. public DTO contains only expected fields
    it("returns only the allowlisted public fields per job", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Allowlist Check", status: "active" });

      const res = await request(app).get("/api/v1/public/jobs");

      expect(res.status).toBe(200);
      expect(Object.keys(res.body.jobs[0]).sort()).toEqual(
  ["public_id", "title", "required_skills", "company_name"].sort()
);

expect(res.body.jobs[0]).not.toHaveProperty("_id");

expect(JSON.stringify(res.body)).not.toMatch(/created_by|__v/i);
    });

    // 8. no auth required
    it("does not require authentication", async () => {
      await Job.create({ company_id: company.id, created_by: hr.id, title: "Open Role", status: "active" });

      const res = await request(app).get("/api/v1/public/jobs").unset("Authorization");
      expect(res.status).toBe(200);
    });

    it("paginates results", async () => {
      for (let i = 0; i < 3; i++) {
        await Job.create({ company_id: company.id, created_by: hr.id, title: `Role ${i}`, status: "active" });
      }

      const res = await request(app).get("/api/v1/public/jobs?page=1&limit=2");

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(2);
      expect(res.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("returns 400 for a limit above the safe maximum", async () => {
      const res = await request(app).get("/api/v1/public/jobs?limit=1000");
      expect(res.status).toBe(400);
    });
  });
});
