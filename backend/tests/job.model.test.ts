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

  it("defaults deleted_at to null on a new Job", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "New Job" });
    const reread = await Job.findById(job.id).select("+deleted_at");
    expect(reread?.deleted_at).toBeNull();
  });

  it("persists a Date value assigned to deleted_at", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Deletable Job" });
    const deletionTime = new Date();
    await Job.updateOne({ _id: job.id }, { $set: { deleted_at: deletionTime } });

    const reread = await Job.findById(job.id).select("+deleted_at");
    expect(reread?.deleted_at).toBeInstanceOf(Date);
    expect(reread?.deleted_at?.getTime()).toBe(deletionTime.getTime());
  });

  it("has a { company_id: 1, deleted_at: 1 } index for normal Job-management reads", () => {
    const indexes = Job.schema.indexes();
    const hasIndex = indexes.some(([spec]) => spec.company_id === 1 && spec.deleted_at === 1);
    expect(hasIndex).toBe(true);
  });

  describe("public_id", () => {
    it("is assigned automatically on creation", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Auto Public Id" });
      expect(job.public_id).toEqual(expect.any(String));
    });

    it("starts with the job_ prefix and a 24-char hex suffix", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Prefixed" });
      expect(job.public_id).toMatch(/^job_[a-f0-9]{24}$/);
    });

    it("is never derived from _id", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Not Derived" });
      expect(job.public_id).not.toContain(job.id);
    });

    it("assigns a different public_id to every new job", async () => {
      const jobs = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          Job.create({ company_id: company.id, created_by: hr.id, title: `Unique ${i}` })
        )
      );
      const publicIds = new Set(jobs.map((job) => job.public_id));
      expect(publicIds.size).toBe(5);
    });

    it("rejects a second job explicitly assigned an already-used public_id", async () => {
      const first = await Job.create({ company_id: company.id, created_by: hr.id, title: "First" });
      await expect(
        Job.create({
          company_id: company.id,
          created_by: hr.id,
          title: "Duplicate",
          public_id: first.public_id,
        })
      ).rejects.toThrow();
    });

    it("has a unique index on public_id", () => {
      const indexes = Job.schema.indexes();
      const publicIdIndex = indexes.find(([spec]) => spec.public_id === 1);
      expect(publicIdIndex).toBeDefined();
      expect(publicIdIndex?.[1]).toMatchObject({ unique: true, sparse: true });
    });

    it("does not require public_id on a legacy-style document missing one (sparse index tolerates it)", async () => {
      // Simulates a pre-migration document: bypasses the pre("validate")
      // hook's auto-assignment via an update-level insert, the same way
      // the backfill script finds documents that predate this field.
      await Job.collection.insertOne({
        company_id: company._id,
        created_by: hr._id,
        title: "Legacy No Public Id",
        required_skills: [],
        status: "draft",
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const found = await Job.findOne({ title: "Legacy No Public Id" });
      expect(found).not.toBeNull();
      expect(found?.public_id).toBeUndefined();

      // A second legacy-style document without public_id must not collide
      // on the sparse unique index either.
      await expect(
        Job.collection.insertOne({
          company_id: company._id,
          created_by: hr._id,
          title: "Second Legacy No Public Id",
          required_skills: [],
          status: "draft",
          deleted_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
      ).resolves.toBeDefined();
    });

    it("leaves public_id untouched when an existing job is re-saved", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Resave Me" });
      const originalPublicId = job.public_id;

      job.title = "Resave Me (edited)";
      await job.save();

      expect(job.public_id).toBe(originalPublicId);
      const reread = await Job.findById(job.id);
      expect(reread?.public_id).toBe(originalPublicId);
    });
  });
});
