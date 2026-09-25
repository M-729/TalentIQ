import { Application } from "../src/models/Application.model";
import { Candidate } from "../src/models/Candidate.model";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const SAMPLE_CV_FILE = {
  storage_key: "talentiq/cvs/00000000-0000-0000-0000-000000000000",
  original_name: "resume.pdf",
  mime_type: "application/pdf",
  size_bytes: 12345,
};

describe("Application model", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@application-model.test", role: "HR" });
  });

  it("creates a valid application referencing a real job and candidate, defaulting status/applied_at", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Engineer", status: "active" });
    const candidate = await Candidate.create({ full_name: "Jane Doe", email: "jane@application-model.test" });

    const application = await Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE });

    expect(application.job_id.toString()).toBe(job.id);
    expect(application.candidate_id.toString()).toBe(candidate.id);
    expect(application.status).toBe("applied");
    expect(application.applied_at).toBeInstanceOf(Date);
    expect(application.current_step_id).toBeNull();
    expect(application.updated_at).toBeInstanceOf(Date);
  });

  it("requires job_id", async () => {
    const candidate = await Candidate.create({ full_name: "No Job", email: "no-job@application-model.test" });
    await expect(Application.create({ candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE })).rejects.toThrow();
  });

  it("requires candidate_id", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "No Candidate", status: "active" });
    await expect(Application.create({ job_id: job.id, cv_file: SAMPLE_CV_FILE })).rejects.toThrow();
  });

  it("requires cv_file", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "No CV", status: "active" });
    const candidate = await Candidate.create({ full_name: "No CV", email: "no-cv@application-model.test" });

    await expect(Application.create({ job_id: job.id, candidate_id: candidate.id })).rejects.toThrow();
  });

  it("requires each cv_file sub-field", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Partial CV", status: "active" });
    const candidate = await Candidate.create({ full_name: "Partial CV", email: "partial-cv@application-model.test" });

    await expect(
      Application.create({
        job_id: job.id,
        candidate_id: candidate.id,
        cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf" },
      })
    ).rejects.toThrow();
  });

  it("stores the exact cv_file metadata provided, belonging to this application", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "CV Metadata", status: "active" });
    const candidate = await Candidate.create({ full_name: "CV Metadata", email: "cv-metadata@application-model.test" });

    const application = await Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE });

    expect(application.cv_file.storage_key).toBe(SAMPLE_CV_FILE.storage_key);
    expect(application.cv_file.original_name).toBe(SAMPLE_CV_FILE.original_name);
    expect(application.cv_file.mime_type).toBe(SAMPLE_CV_FILE.mime_type);
    expect(application.cv_file.size_bytes).toBe(SAMPLE_CV_FILE.size_bytes);
  });

  it("rejects an invalid status value", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Bad Status", status: "active" });
    const candidate = await Candidate.create({ full_name: "Bad Status", email: "bad-status@application-model.test" });

    await expect(
      Application.create({ job_id: job.id, candidate_id: candidate.id, status: "not-a-status", cv_file: SAMPLE_CV_FILE })
    ).rejects.toThrow();
  });

  it("enforces at most one application per candidate per job", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "One Per Job", status: "active" });
    const candidate = await Candidate.create({ full_name: "Repeat", email: "repeat@application-model.test" });

    await Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE });
    await expect(
      Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE })
    ).rejects.toThrow();
  });

  it("allows the same candidate to apply to two different jobs", async () => {
    const jobA = await Job.create({ company_id: company.id, created_by: hr.id, title: "Job A", status: "active" });
    const jobB = await Job.create({ company_id: company.id, created_by: hr.id, title: "Job B", status: "active" });
    const candidate = await Candidate.create({ full_name: "Multi Apply", email: "multi@application-model.test" });

    await Application.create({ job_id: jobA.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE });
    await expect(
      Application.create({ job_id: jobB.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE })
    ).resolves.toBeTruthy();
  });

  describe("public_id", () => {
    it("is assigned automatically on creation with the app_ prefix and 24-char hex suffix", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Public Id Job", status: "active" });
      const candidate = await Candidate.create({ full_name: "Public Id", email: "public-id@application-model.test" });

      const application = await Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE });

      expect(application.public_id).toMatch(/^app_[a-f0-9]{24}$/);
    });

    it("assigns a different public_id to every new application", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Unique Ids Job", status: "active" });
      const candidates = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          Candidate.create({ full_name: `Cand ${i}`, email: `unique-${i}@application-model.test` })
        )
      );

      const applications = await Promise.all(
        candidates.map((candidate) =>
          Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE })
        )
      );

      expect(new Set(applications.map((a) => a.public_id)).size).toBe(3);
    });

    it("has a unique, sparse index on public_id (tolerates legacy documents without one)", () => {
      const indexes = Application.schema.indexes();
      const publicIdIndex = indexes.find(([spec]) => spec.public_id === 1);
      expect(publicIdIndex).toBeDefined();
      expect(publicIdIndex?.[1]).toMatchObject({ unique: true, sparse: true });
    });

    it("leaves public_id untouched when an existing application is re-saved", async () => {
      const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Resave Job", status: "active" });
      const candidate = await Candidate.create({ full_name: "Resave", email: "resave@application-model.test" });
      const application = await Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: SAMPLE_CV_FILE });
      const originalPublicId = application.public_id;

      application.status = "in_process";
      await application.save();

      expect(application.public_id).toBe(originalPublicId);
    });
  });
});
