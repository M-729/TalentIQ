import { Job, JOB_STATUSES } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

describe("Job model", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@job.test", role: "HR" });
  });

  it("creates a valid job with only the required fields", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
    });

    expect(job.title).toBe("Backend Engineer");
    expect(job.status).toBe("draft");
    expect(job.required_skills).toEqual([]);
    expect(job.company_id.toString()).toBe(company.id);
    expect(job.created_by.toString()).toBe(hr.id);
  });

  it("requires company_id", async () => {
    await expect(Job.create({ created_by: hr.id, title: "No Company" })).rejects.toThrow();
  });

  it("requires created_by", async () => {
    await expect(Job.create({ company_id: company.id, title: "No Creator" })).rejects.toThrow();
  });

  it("requires title", async () => {
    await expect(Job.create({ company_id: company.id, created_by: hr.id })).rejects.toThrow();
  });

  it("rejects an invalid status value", async () => {
    await expect(
      Job.create({ company_id: company.id, created_by: hr.id, title: "Bad Status", status: "not-a-status" })
    ).rejects.toThrow();
  });

  it("accepts every ERD-documented status value", async () => {
    for (const status of JOB_STATUSES) {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: `Job ${status}`, status });
      expect(job.status).toBe(status);
    }
  });

  it("rejects a malformed company_id", async () => {
    await expect(
      Job.create({ company_id: "not-an-object-id", created_by: hr.id, title: "Bad Ref" })
    ).rejects.toThrow();
  });

  it("rejects a negative salary_min", async () => {
    await expect(
      Job.create({ company_id: company.id, created_by: hr.id, title: "Negative Salary", salary_min: -1000 })
    ).rejects.toThrow();
  });

  it("trims required_skills entries", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Skills Job",
      required_skills: ["  Node.js  ", "TypeScript"],
    });
    expect(job.required_skills).toEqual(["Node.js", "TypeScript"]);
  });

  it("sets created_at/updated_at timestamps automatically", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Timestamps Job" });
    expect(job.created_at).toBeInstanceOf(Date);
    expect(job.updated_at).toBeInstanceOf(Date);
  });
});
