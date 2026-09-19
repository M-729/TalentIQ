import request from "supertest";
import path from "node:path";
import { createApp } from "../src/app";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Regression guard for this ticket's explicit rule: submitting a public
// application must never trigger AI screening. Mocks match
// publicApplication.api.test.ts's own boundaries (storage, file
// signature, email) plus the screening persistence functions this ticket
// added, so this test can assert none of them were called.
jest.mock("../src/services/storage/cvStorage.service", () => ({
  cvStorage: { upload: jest.fn(), delete: jest.fn(), getSignedDownloadUrl: jest.fn(), download: jest.fn() },
}));
jest.mock("../src/modules/applications/cvFileSignature", () => ({
  detectCvFileType: jest.fn(async (buffer: Buffer) => {
    if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) return "docx";
    return null;
  }),
}));
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
  getLatestApplicationScreening: jest.fn(),
  getApplicationScreeningHistory: jest.fn(),
}));

import { cvStorage } from "../src/services/storage/cvStorage.service";
import { createApplicationScreening } from "../src/services/ai/screeningHistory.service";

const app = createApp();
const FIXTURES = path.join(__dirname, "fixtures");

describe("regression: public application submission never triggers AI screening", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    (cvStorage.upload as jest.Mock).mockReset().mockResolvedValue({
      storage_key: "talentiq/cvs/regression-test",
      original_name: "resume.pdf",
      mime_type: "application/pdf",
      size_bytes: 719,
    });
    (createApplicationScreening as jest.Mock).mockReset();
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@no-auto-screening.test", role: "HR" });
  });

  it("does not call createApplicationScreening when a candidate submits an application", async () => {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
      status: "active",
    });

    const res = await request(app)
      .post(`/api/v1/public/jobs/${job.id}/applications`)
      .field("full_name", "Jane Candidate")
      .field("email", "jane.candidate@example.test")
      .attach("cv", path.join(FIXTURES, "sample.pdf"));

    expect(res.status).toBe(201);
    expect(createApplicationScreening).not.toHaveBeenCalled();
  });
});
