import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate, type CandidateDoc } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { EmailNotification } from "../src/models/EmailNotification.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

import { emailService } from "../src/services/email/email.service";
const mockSend = emailService.send as jest.Mock;

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function rejectUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/reject`;
}
function retryUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/reject/retry`;
}

describe("Rejection API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let candidate: CandidateDoc;
  let application: ApplicationDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });

    candidate = await Candidate.create({
      full_name: "Ahmad Khalil",
      email: `ahmad-${new Types.ObjectId().toString()}@candidate.test`,
    });
    application = await Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
    });

    mockSend.mockReset();
  });

  // 1. active candidate can be rejected
  it("1. rejects an active (in_process) candidate", async () => {
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("rejected");
    expect(res.body.application.final_decision).toBe("rejected");
  });

  it("1b. rejects a still-applied candidate (never moved into the pipeline)", async () => {
    await Application.updateOne({ _id: application.id }, { $set: { status: "applied" } });
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("rejected");
  });

  // 2. terminal candidate cannot be rejected again
  it.each(["rejected", "offered", "hired"] as const)("2. blocks rejecting an already-%s (terminal) application", async (status) => {
    await Application.updateOne({ _id: application.id }, { $set: { status } });
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(409);
  });

  // 3. rejection stores audit metadata
  it("3. stores rejected_at/rejected_by/rejection_reason", async () => {
    const res = await request(app)
      .post(rejectUrl(application.public_id!))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send({ send_email: false, internal_reason: "Not enough backend experience" });
    expect(res.status).toBe(200);

    const stored = await Application.findById(application.id);
    expect(stored!.rejected_at).not.toBeNull();
    expect(stored!.rejected_by_user_id!.toString()).toBe(hrA.id);
    expect(stored!.rejection_reason).toBe("Not enough backend experience");
  });

  // 4. rejection does not expose internal reason to candidate email
  it("4. never includes the internal rejection_reason anywhere in the candidate email", async () => {
    mockSend.mockResolvedValueOnce(undefined);
    await request(app)
      .post(rejectUrl(application.public_id!))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send({ send_email: true, internal_reason: "Salary expectations too high" });

    const [sendCall] = mockSend.mock.calls;
    const emailPayload = sendCall[0];
    expect(emailPayload.text).not.toMatch(/Salary expectations too high/);
    expect(emailPayload.html).not.toMatch(/Salary expectations too high/);

    const stored = await EmailNotification.findOne({ application_id: application.id, category: "application_rejection" });
    // The snapshot schema itself has no field for it at all — structurally
    // impossible to leak, not just "happens to be empty".
    const snapshotKeys = Object.keys(JSON.parse(JSON.stringify(stored!.rejection_snapshot)));
    expect(snapshotKeys).toContain("candidate_name");
    expect(snapshotKeys).not.toContain("rejection_reason");
  });

  // 5. optional rejection email sends
  it("5. sends a rejection email when send_email is true", async () => {
    mockSend.mockResolvedValueOnce(undefined);
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });

    expect(res.status).toBe(200);
    expect(res.body.notification.status).toBe("sent");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe(candidate.email);
  });

  // ===== Transactional durability hardening (bug fix) =====
  describe("rejection + notification commit together (bug fix)", () => {
    // 2. rejection with email -> rejection + pending notification commit together
    it("2. persists both the rejected Application and the EmailNotification row together", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });
      expect(res.status).toBe(200);

      const storedApplication = await Application.findById(application.id);
      const storedNotification = await EmailNotification.findOne({ application_id: application.id, category: "application_rejection" });
      expect(storedApplication!.status).toBe("rejected");
      expect(storedNotification).not.toBeNull();
    });

    // 3. notification creation failure -> rejection transaction rolls back
    it("3. rolls back the Application rejection entirely if EmailNotification creation fails", async () => {
      const createSpy = jest.spyOn(EmailNotification, "create").mockRejectedValueOnce(new Error("unexpected write failure"));

      const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });
      createSpy.mockRestore();

      expect(res.status).toBe(500);
      const stored = await Application.findById(application.id);
      expect(stored!.status).toBe("in_process");
      expect(stored!.rejected_at).toBeNull();
      expect(await EmailNotification.countDocuments({ application_id: application.id })).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();

      // HR can simply retry — the application is still a clean, non-terminal state.
      mockSend.mockResolvedValueOnce(undefined);
      const retryRes = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });
      expect(retryRes.status).toBe(200);
      expect((await Application.findById(application.id))!.status).toBe("rejected");
      expect(await EmailNotification.countDocuments({ application_id: application.id })).toBe(1);
    });
  });

  it("5b. sends no email at all when send_email is false", async () => {
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(200);
    expect(res.body.notification).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
    expect(await EmailNotification.countDocuments({ application_id: application.id })).toBe(0);
  });

  // 6. email failure does not undo rejection
  it("6. keeps the application rejected even when the notification email fails", async () => {
    mockSend.mockRejectedValueOnce(new Error("smtp down"));
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe("rejected");
    expect(res.body.notification.status).toBe("failed");

    const stored = await Application.findById(application.id);
    expect(stored!.status).toBe("rejected");
  });

  // 7. retry works
  it("7. retries a failed rejection email", async () => {
    mockSend.mockRejectedValueOnce(new Error("smtp down"));
    await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });

    mockSend.mockResolvedValueOnce(undefined);
    const res = await request(app).post(retryUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

    expect(res.status).toBe(200);
    expect(res.body.notification.status).toBe("sent");
  });

  it("7b. rejects a retry attempt when there is nothing to retry", async () => {
    const res = await request(app).post(retryUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(404);
  });

  it("7c. rejects a retry attempt when the notification did not fail", async () => {
    mockSend.mockResolvedValueOnce(undefined);
    await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });

    const res = await request(app).post(retryUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(409);
  });

  // 8. cross-company blocked
  it("8. returns 404 for a cross-company reject attempt", async () => {
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({ send_email: false });
    expect(res.status).toBe(404);
    expect((await Application.findById(application.id))!.status).toBe("in_process");
  });

  it("8b. returns 404 for a cross-company retry attempt", async () => {
    const res = await request(app).post(retryUrl(application.public_id!)).set("Authorization", authHeaderFor(hrB, companyB.id));
    expect(res.status).toBe(404);
  });

  it("8c. returns 404 for a cross-company rejection-info read", async () => {
    const res = await request(app).get(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrB, companyB.id));
    expect(res.status).toBe(404);
  });

  // Lifecycle
  it("34. allows rejecting an existing applicant when the Job is merely closed", async () => {
    await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(200);
  });

  it("35. blocks rejecting a candidate once the Job is soft-deleted", async () => {
    await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(404);
  });

  // Rejection info endpoint (Part 17's "Rejected" state)
  it("returns rejection info for a rejected application, including email status", async () => {
    mockSend.mockResolvedValueOnce(undefined);
    await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true, internal_reason: "Culture fit concerns" });

    const res = await request(app).get(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    expect(res.body.rejection.rejected_by.name).toBeTruthy();
    expect(res.body.rejection.rejection_reason).toBe("Culture fit concerns");
    expect(res.body.rejection.email_status).toBe("sent");
  });

  // Part 42/43: never a raw SMTP error, and this whole suite never hits real SMTP (mocked above)
  it("42. never exposes a raw SMTP error anywhere in the response", async () => {
    mockSend.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:587 raw stack trace"));
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });

    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED/);
  });

  // 24. double Reject concurrency guard
  it("24. a concurrent second reject attempt safely conflicts instead of double-rejecting", async () => {
    const rejectSpy = jest.spyOn(Application, "findOneAndUpdate").mockResolvedValueOnce(null);
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false });
    expect(res.status).toBe(409);
    rejectSpy.mockRestore();
  });

  it("rejects unknown fields on the reject request body", async () => {
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: false, status: "rejected" });
    expect(res.status).toBe(400);
  });

  it("requires send_email to be present", async () => {
    const res = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
    expect(res.status).toBe(400);
  });

  // Same class of bug discovered and fixed alongside the Offer email-state
  // bug: every non-interview EmailNotification row must set its own
  // distinct mutation_version_at, or a second rejection email anywhere in
  // the system collides on the legacy {interview_id, category,
  // mutation_version_at} unique index (interview_id/mutation_version_at
  // both default to null). A single application can only ever be rejected
  // once, so this never surfaced within one Application's own test data —
  // it only shows up across two DIFFERENT applications, as reproduced here.
  it("sends a second, independent rejection email for a different application without colliding on a shared index", async () => {
    const secondCandidate = await Candidate.create({
      full_name: "Second Candidate",
      email: `second-reject-${new Types.ObjectId().toString()}@candidate.test`,
    });
    const secondApplication = await Application.create({
      job_id: jobA.id,
      candidate_id: secondCandidate._id,
      cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
      status: "in_process",
    });

    mockSend.mockResolvedValueOnce(undefined);
    const firstRes = await request(app).post(rejectUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ send_email: true });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.notification.status).toBe("sent");

    mockSend.mockResolvedValueOnce(undefined);
    const secondRes = await request(app)
      .post(rejectUrl(secondApplication.public_id!))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send({ send_email: true });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.notification.status).toBe("sent");

    expect(await EmailNotification.countDocuments({ category: "application_rejection" })).toBe(2);
  });
});
