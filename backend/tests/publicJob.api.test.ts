import request from "supertest";
import { Types } from "mongoose";
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

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`);

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

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`);

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

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`);

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

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a closed job", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "No Longer Open",
      status: "closed",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent job, indistinguishable from draft/closed", async () => {
    const res = await request(app).get(`/api/v1/public/jobs/${new Types.ObjectId().toString()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Job not found");
  });

  it("returns 400 for a malformed id", async () => {
    const res = await request(app).get("/api/v1/public/jobs/not-an-object-id");
    expect(res.status).toBe(400);
  });

  it("does not require authentication even when no token is present at all", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Truly Public",
      status: "active",
    });

    const res = await request(app).get(`/api/v1/public/jobs/${job.id}`).unset("Authorization");
    expect(res.status).toBe(200);
  });
});
