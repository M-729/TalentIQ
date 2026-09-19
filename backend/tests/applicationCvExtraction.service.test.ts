import fs from "node:fs";
import path from "node:path";
import { Types } from "mongoose";
import { Application } from "../src/models/Application.model";
import { Candidate } from "../src/models/Candidate.model";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// This service must never touch real Cloudflare R2 — the whole storage
// module is mocked, matching the same boundary application.service.ts's
// own tests mock at.
jest.mock("../src/services/storage/cvStorage.service", () => ({
  cvStorage: { upload: jest.fn(), delete: jest.fn(), getSignedDownloadUrl: jest.fn(), download: jest.fn() },
}));

// pdf-parse's real worker setup uses a dynamic import() that Jest's
// default CJS runtime rejects (see tests/pdfCvParser.test.ts for the full
// explanation — same category of limitation as the ESM-only `file-type`
// package elsewhere in this codebase). The DOCX path has no such
// limitation, so DOCX fixtures still flow through the real mammoth
// parser below; only the PDF path is mocked at this exact boundary.
const mockGetText = jest.fn();
const mockDestroy = jest.fn();
class FakeInvalidPDFException extends Error {}
jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({ getText: mockGetText, destroy: mockDestroy })),
  InvalidPDFException: FakeInvalidPDFException,
}));

import { cvStorage } from "../src/services/storage/cvStorage.service";
import { extractApplicationCvText } from "../src/modules/applications/applicationCvExtraction.service";

const mockDownload = cvStorage.download as jest.Mock;

const FIXTURES = path.join(__dirname, "fixtures");
const SAMPLE_DOCX_BYTES = fs.readFileSync(path.join(FIXTURES, "sample.docx"));

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("extractApplicationCvText", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    mockDownload.mockReset();
    mockGetText.mockReset();
    mockDestroy.mockReset();
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@cv-extraction.test", role: "HR" });
  });

  async function createApplicationWithCv(cvFile: {
    storage_key: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }) {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });
    const candidate = await Candidate.create({ full_name: "Taylor Example", email: `cv-extraction-${Date.now()}@test.local` });
    return Application.create({ job_id: job.id, candidate_id: candidate.id, cv_file: cvFile });
  }

  it("extracts the correct text for an application with a PDF CV", async () => {
    mockGetText.mockResolvedValueOnce({ text: "Taylor Example\nBackend Developer\n5 years of experience." });
    mockDownload.mockResolvedValueOnce(Buffer.from("fake pdf bytes"));
    const application = await createApplicationWithCv({
      storage_key: "talentiq/cvs/pdf-key",
      original_name: "resume.pdf",
      mime_type: PDF_MIME,
      size_bytes: 12345,
    });

    const result = await extractApplicationCvText(application.id);

    expect(mockDownload).toHaveBeenCalledWith("talentiq/cvs/pdf-key");
    expect(result.text).toContain("Taylor Example");
    expect(result.text).toContain("Backend Developer");
  });

  it("extracts the correct text for an application with a DOCX CV (real mammoth, real fixture)", async () => {
    mockDownload.mockResolvedValueOnce(SAMPLE_DOCX_BYTES);
    const application = await createApplicationWithCv({
      storage_key: "talentiq/cvs/docx-key",
      original_name: "resume.docx",
      mime_type: DOCX_MIME,
      size_bytes: SAMPLE_DOCX_BYTES.length,
    });

    const result = await extractApplicationCvText(application.id);

    expect(mockDownload).toHaveBeenCalledWith("talentiq/cvs/docx-key");
    expect(result.text).toContain("Taylor Example");
    expect(result.text).toContain("Backend Developer");
  });

  it("fails safely with application_not_found for a nonexistent application", async () => {
    const missingId = new Types.ObjectId().toString();

    await expect(extractApplicationCvText(missingId)).rejects.toMatchObject({
      name: "ApplicationCvExtractionError",
      code: "application_not_found",
    });
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("fails safely with no_cv_on_application when the application has no cv_file", async () => {
    const application = await createApplicationWithCv({
      storage_key: "talentiq/cvs/to-be-removed",
      original_name: "resume.pdf",
      mime_type: PDF_MIME,
      size_bytes: 100,
    });
    // The schema requires cv_file — this bypasses schema validation
    // (raw $unset, no document validators) purely to exercise the
    // service's own defensive check for data that shouldn't exist but is
    // still handled safely if it somehow does.
    await Application.collection.updateOne({ _id: application._id }, { $unset: { cv_file: "" } });

    await expect(extractApplicationCvText(application.id)).rejects.toMatchObject({
      name: "ApplicationCvExtractionError",
      code: "no_cv_on_application",
    });
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("propagates a safe error when the storage download fails", async () => {
    class FakeCvStorageError extends Error {
      code = "not_found";
      constructor() {
        super("CV object was not found in storage.");
        this.name = "CvStorageError";
      }
    }
    mockDownload.mockRejectedValueOnce(new FakeCvStorageError());
    const application = await createApplicationWithCv({
      storage_key: "talentiq/cvs/gone",
      original_name: "resume.pdf",
      mime_type: PDF_MIME,
      size_bytes: 100,
    });

    await expect(extractApplicationCvText(application.id)).rejects.toMatchObject({
      name: "CvStorageError",
      code: "not_found",
    });
  });

  it("fails safely with unsupported_format for an unsupported stored mime_type", async () => {
    mockDownload.mockResolvedValueOnce(Buffer.from("irrelevant bytes"));
    const application = await createApplicationWithCv({
      storage_key: "talentiq/cvs/weird-mime",
      original_name: "resume.png",
      mime_type: "image/png",
      size_bytes: 100,
    });

    await expect(extractApplicationCvText(application.id)).rejects.toMatchObject({
      name: "CvParseError",
      code: "unsupported_format",
    });
    expect(mockGetText).not.toHaveBeenCalled();
  });

  it("fails safely when the parser itself fails on a corrupted CV", async () => {
    mockGetText.mockRejectedValueOnce(new FakeInvalidPDFException("Invalid PDF structure."));
    mockDownload.mockResolvedValueOnce(Buffer.from("fake corrupted pdf bytes"));
    const application = await createApplicationWithCv({
      storage_key: "talentiq/cvs/corrupted",
      original_name: "resume.pdf",
      mime_type: PDF_MIME,
      size_bytes: 100,
    });

    await expect(extractApplicationCvText(application.id)).rejects.toMatchObject({
      name: "CvParseError",
      code: "malformed",
    });
  });

  it("never logs the extracted CV text, on success or on failure", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockGetText.mockResolvedValueOnce({ text: "Taylor Example\nBackend Developer" });
    mockDownload.mockResolvedValueOnce(Buffer.from("fake pdf bytes"));
    const okApplication = await createApplicationWithCv({
      storage_key: "talentiq/cvs/privacy-ok",
      original_name: "resume.pdf",
      mime_type: PDF_MIME,
      size_bytes: 100,
    });
    await extractApplicationCvText(okApplication.id);

    mockGetText.mockRejectedValueOnce(new FakeInvalidPDFException("Invalid PDF structure."));
    mockDownload.mockResolvedValueOnce(Buffer.from("fake corrupted pdf bytes"));
    const failingApplication = await createApplicationWithCv({
      storage_key: "talentiq/cvs/privacy-fail",
      original_name: "resume.pdf",
      mime_type: PDF_MIME,
      size_bytes: 100,
    });
    await extractApplicationCvText(failingApplication.id).catch(() => {});

    const allLoggedText = JSON.stringify([...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]);
    expect(allLoggedText).not.toContain("Taylor Example");
    expect(allLoggedText).not.toContain("Backend Developer");

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
