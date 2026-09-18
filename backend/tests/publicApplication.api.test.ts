import request from "supertest";
import path from "node:path";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Tests must never touch real storage (Cloudflare R2) — the whole storage
// module is mocked, and application.service.ts only ever depends on this
// module's exported `cvStorage`, never on a provider SDK directly.
jest.mock("../src/services/storage/cvStorage.service", () => ({
  cvStorage: {
    upload: jest.fn(),
    delete: jest.fn(),
    getSignedDownloadUrl: jest.fn(),
  },
}));

// cvFileSignature.ts dynamically imports the ESM-only `file-type` package.
// Jest's CJS-based module runtime cannot resolve that dynamic import even
// in complete isolation (confirmed independently) — a Jest/ESM limitation,
// not a bug in the real implementation, which was separately verified
// directly under Node (outside Jest) against these exact fixture files:
// sample.pdf -> pdf, sample.docx -> docx, spoofed.pdf -> undetected. This
// mock reimplements the same magic-byte check for the same reason the
// fallback design would have (see task report), purely so these fixture-
// driven tests stay meaningful without invoking the ESM package inside Jest.
jest.mock("../src/modules/applications/cvFileSignature", () => ({
  detectCvFileType: jest.fn(async (buffer: Buffer) => {
    if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";
    return null;
  }),
}));

const { cvStorage } = jest.requireMock("../src/services/storage/cvStorage.service") as {
  cvStorage: { upload: jest.Mock; delete: jest.Mock; getSignedDownloadUrl: jest.Mock };
};

const app = createApp();

const FIXTURES = path.join(__dirname, "fixtures");
const SAMPLE_PDF = path.join(FIXTURES, "sample.pdf");
const SAMPLE_DOCX = path.join(FIXTURES, "sample.docx");
const SPOOFED_PDF = path.join(FIXTURES, "spoofed.pdf");

function baseFields(overrides: Partial<Record<string, string>> = {}) {
  return { full_name: "Jane Doe", email: "jane@candidate.test", ...overrides };
}

function withFields(req: request.Test, fields: Record<string, string>): request.Test {
  return Object.entries(fields).reduce((r, [key, value]) => r.field(key, value), req);
}

describe("Public Application API (with CV upload)", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@public-application.test", role: "HR" });

    cvStorage.upload.mockReset();
    cvStorage.delete.mockReset();
    cvStorage.upload.mockImplementation(
      async ({ buffer, originalName, mimeType }: { buffer: Buffer; originalName: string; mimeType: string }) => ({
        storage_key: `talentiq/cvs/mock-${Math.random().toString(36).slice(2)}`,
        original_name: originalName,
        mime_type: mimeType,
        size_bytes: buffer.length,
      })
    );
    cvStorage.delete.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Restores any jest.spyOn (e.g. on Application.create) used by
    // individual tests below; does not affect the module-level
    // jest.mock() on cvStorage, which stays mocked for the whole file.
    jest.restoreAllMocks();
  });

  async function createActiveJob(title = "Open Role") {
    return Job.create({ company_id: company.id, created_by: hr.id, title, status: "active" });
  }

  it("accepts a valid PDF application", async () => {
    const job = await createActiveJob();

    const res = await withFields(request(app).post(`/api/v1/public/jobs/${job.id}/applications`), baseFields()).attach(
      "cv",
      SAMPLE_PDF
    );

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: "Application submitted successfully" });
    expect(cvStorage.upload).toHaveBeenCalledTimes(1);
  });

  it("accepts a valid DOCX application", async () => {
    const job = await createActiveJob();

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "docx@candidate.test" })
    ).attach("cv", SAMPLE_DOCX);

    expect(res.status).toBe(201);
  });

  it("rejects an application with no CV attached", async () => {
    const job = await createActiveJob();

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "no-cv@candidate.test" })
    );

    expect(res.status).toBe(400);
    expect(cvStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects a file over 5MB", async () => {
    const job = await createActiveJob();
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 1);

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "toobig@candidate.test" })
    ).attach("cv", bigBuffer, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(cvStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects an unsupported file type (png)", async () => {
    const job = await createActiveJob();

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "png@candidate.test" })
    ).attach("cv", Buffer.from([0x89, 0x50, 0x4e, 0x47]), { filename: "resume.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(cvStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects a spoofed file (named/labeled as pdf, isn't one) via signature inspection", async () => {
    const job = await createActiveJob();

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "spoofed@candidate.test" })
    ).attach("cv", SPOOFED_PDF, { filename: "resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(cvStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects an application to a draft job (CV never uploaded)", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Draft", status: "draft" });

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "draft@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(404);
    expect(cvStorage.upload).not.toHaveBeenCalled();
  });

  it("rejects an application to a closed job", async () => {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Closed", status: "closed" });

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "closed@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(404);
  });

  it("rejects an application to a nonexistent job", async () => {
    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${new Types.ObjectId().toString()}/applications`),
      baseFields({ email: "nowhere@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(404);
  });

  it("rejects a malformed job id with 400", async () => {
    const res = await withFields(
      request(app).post("/api/v1/public/jobs/not-an-object-id/applications"),
      baseFields({ email: "malformed@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(400);
  });

  it("rejects invalid candidate input (blank full_name)", async () => {
    const job = await createActiveJob();

    const res = await withFields(request(app).post(`/api/v1/public/jobs/${job.id}/applications`), {
      full_name: "",
      email: "blank-name@candidate.test",
    }).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(400);
  });

  it("cannot mass-assign status, current_step_id, final_decision, job_id, or company_id", async () => {
    const job = await createActiveJob("Target Job");
    const otherJob = await createActiveJob("Other Job");

    const res = await withFields(request(app).post(`/api/v1/public/jobs/${job.id}/applications`), {
      full_name: "Sneaky Candidate",
      email: "sneaky@candidate.test",
      status: "hired",
      current_step_id: new Types.ObjectId().toString(),
      final_decision: "accepted",
      job_id: otherJob.id,
      company_id: company.id,
    }).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(201);

    const candidate = await Candidate.findOne({ email: "sneaky@candidate.test" });
    const application = await Application.findOne({ candidate_id: candidate?._id });

    expect(application?.job_id.toString()).toBe(job.id);
    expect(application?.status).toBe("applied");
    expect(application?.current_step_id).toBeNull();
    expect(application?.final_decision).toBeUndefined();
  });

  it("creates a Candidate and Application with correct links and CV metadata attached to the right application", async () => {
    const job = await createActiveJob("Traceable Role");

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "trace@candidate.test", phone: "+1 555 0100" })
    ).attach("cv", SAMPLE_PDF, { filename: "my-resume.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(201);

    const candidate = await Candidate.findOne({ email: "trace@candidate.test" });
    expect(candidate?.full_name).toBe("Jane Doe");
    expect(candidate?.phone).toBe("+1 555 0100");

    const application = await Application.findOne({ candidate_id: candidate?._id });
    expect(application?.job_id.toString()).toBe(job.id);
    expect(application?.cv_file.original_name).toBe("my-resume.pdf");
    expect(application?.cv_file.mime_type).toBe("application/pdf");
    expect(application?.cv_file.storage_key).toEqual(expect.stringContaining("talentiq/cvs/"));
    expect(application?.cv_file.size_bytes).toBeGreaterThan(0);
  });

  it("returns a minimal response with no storage/internal fields or credentials", async () => {
    const job = await createActiveJob("Minimal Response Role");

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "minimal@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["message"]);
    expect(JSON.stringify(res.body)).not.toMatch(/cloudinary|r2_|access_key|secret_access_key|api_secret|api_key/i);
  });

  it("rejects a duplicate application (409) and does not upload a second file", async () => {
    const job = await createActiveJob("Once Only Role");
    const fields = baseFields({ email: "repeat@candidate.test" });

    const first = await withFields(request(app).post(`/api/v1/public/jobs/${job.id}/applications`), fields).attach(
      "cv",
      SAMPLE_PDF
    );
    expect(first.status).toBe(201);
    expect(cvStorage.upload).toHaveBeenCalledTimes(1);

    const second = await withFields(request(app).post(`/api/v1/public/jobs/${job.id}/applications`), fields).attach(
      "cv",
      SAMPLE_PDF
    );
    expect(second.status).toBe(409);
    // The pre-check (Application.exists) caught it before a second
    // external upload was ever attempted.
    expect(cvStorage.upload).toHaveBeenCalledTimes(1);

    const applications = await Application.find({});
    expect(applications).toHaveLength(1);
  });

  it("cleans up the uploaded CV if Application creation fails for a non-duplicate reason", async () => {
    const job = await createActiveJob("Cleanup Role");
    jest.spyOn(Application, "create").mockRejectedValueOnce(new Error("simulated DB failure") as never);

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "cleanup@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(500);
    expect(cvStorage.upload).toHaveBeenCalledTimes(1);
    expect(cvStorage.delete).toHaveBeenCalledTimes(1);
  });

  it("cleans up the uploaded CV when the database-level duplicate race is hit after upload", async () => {
    const job = await createActiveJob("Race Role");
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key error"), {
      code: 11000,
      keyValue: { job_id: job._id, candidate_id: "x" },
    });
    jest.spyOn(Application, "create").mockRejectedValueOnce(duplicateKeyError as never);

    const res = await withFields(
      request(app).post(`/api/v1/public/jobs/${job.id}/applications`),
      baseFields({ email: "race@candidate.test" })
    ).attach("cv", SAMPLE_PDF);

    expect(res.status).toBe(409);
    expect(cvStorage.upload).toHaveBeenCalledTimes(1);
    expect(cvStorage.delete).toHaveBeenCalledTimes(1);
  });
});
