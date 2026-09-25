import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate, type CandidateDoc } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { Offer } from "../src/models/Offer.model";
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

function createUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/offer`;
}
function offerUrl(offerId: string) {
  return `/api/v1/offers/${offerId}`;
}
function sendUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/send`;
}
function acceptUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/accept`;
}
function declineUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/decline`;
}
function withdrawUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/withdraw`;
}
function hireUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/hire`;
}
function notificationsUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/notifications`;
}
function retryUrl(offerId: string, notificationId: string) {
  return `/api/v1/offers/${offerId}/notifications/${notificationId}/retry`;
}
function listUrl(query = "") {
  return `/api/v1/offers${query}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Backend Engineer",
    salary_amount: 90000,
    salary_currency: "USD",
    ...overrides,
  };
}

describe("Offer API", () => {
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

  // Returns both ids: `.id` (raw Mongo ObjectId) for internal DB assertions
  // (findById/relation-field queries), `.publicId` for building URLs — Phase 2
  // cutover means only the latter resolves against the API.
  async function createDraft(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post(createUrl(application.public_id!))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send(validBody(overrides));
    return { id: res.body.offer.id as string, publicId: res.body.offer.public_id as string };
  }

  async function createAndSend() {
    const offer = await createDraft();
    mockSend.mockResolvedValueOnce(undefined);
    await request(app).post(sendUrl(offer.publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
    return offer;
  }

  // ===== OFFER CREATION =====
  describe("creation eligibility", () => {
    // 9. create draft
    it("9. creates a draft offer for an active application", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(201);
      expect(res.body.offer.status).toBe("draft");
      expect(res.body.offer.title).toBe("Backend Engineer");
      expect(res.body.offer.salary_amount).toBe(90000);
      expect(res.body.offer.salary_currency).toBe("USD");
    });

    it("creating a draft never changes the application's status", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect((await Application.findById(application.id))!.status).toBe("in_process");
    });

    it.each(["rejected", "offered", "hired"] as const)("blocks creation for a(n) %s (terminal) application", async (status) => {
      await Application.updateOne({ _id: application.id }, { $set: { status } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
    });

    it("blocks creation when the Job is soft-deleted", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(404);
    });

    it("allows creation for an existing candidate when the Job is merely closed", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(201);
    });

    it("prevents a second live offer for the same application", async () => {
      await createDraft();
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
      expect(await Offer.countDocuments({ application_id: application.id })).toBe(1);
    });

    // 20. cross-company blocked
    it("20. returns 404 for a cross-company create attempt", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrB, companyB.id)).send(validBody());
      expect(res.status).toBe(404);
    });

    // 11. invalid salary rejected
    it.each([-100, 0, Infinity, 100.999])("11. rejects an invalid salary amount (%s)", async (salary_amount) => {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ salary_amount, salary_currency: "USD" }));
      expect(res.status).toBe(400);
    });

    // 12. invalid currency handled
    it("12. rejects an unrecognized currency code", async () => {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ salary_amount: 90000, salary_currency: "XYZ" }));
      expect(res.status).toBe(400);
    });

    it("rejects a salary amount without a currency", async () => {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Backend Engineer", salary_amount: 90000 });
      expect(res.status).toBe(400);
    });

    it("rejects a currency without a salary amount", async () => {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Backend Engineer", salary_currency: "USD" });
      expect(res.status).toBe(400);
    });

    it("allows creation with no salary at all", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ title: "Backend Engineer" });
      expect(res.status).toBe(201);
      expect(res.body.offer.salary_amount).toBeNull();
    });

    it("rejects unknown fields on the create request body", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ status: "sent" }));
      expect(res.status).toBe(400);
    });
  });

  describe("GET current offer", () => {
    it("returns null when no live offer exists", async () => {
      const res = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer).toBeNull();
    });

    it("returns the live offer once created", async () => {
      await createDraft();
      const res = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offer.status).toBe("draft");
    });

    it("returns null again after the offer is withdrawn", async () => {
      const { publicId } = await createDraft();
      await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const res = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offer).toBeNull();
    });
  });

  // ===== EDIT DRAFT =====
  describe("editing a draft", () => {
    // 10. edit draft
    it("10. allows editing title/salary/dates while still a draft", async () => {
      const { publicId } = await createDraft();
      const res = await request(app)
        .patch(offerUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Senior Backend Engineer", salary_amount: 100000, salary_currency: "EUR" });
      expect(res.status).toBe(200);
      expect(res.body.offer.title).toBe("Senior Backend Engineer");
      expect(res.body.offer.salary_currency).toBe("EUR");
    });

    it("allows editing just the salary amount when a currency is already stored", async () => {
      const { publicId } = await createDraft({ salary_amount: 90000, salary_currency: "USD" });
      const res = await request(app).patch(offerUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ salary_amount: 95000 });
      expect(res.status).toBe(200);
      expect(res.body.offer.salary_amount).toBe(95000);
      expect(res.body.offer.salary_currency).toBe("USD");
    });

    it("allows clearing salary entirely by setting both to null", async () => {
      const { publicId } = await createDraft({ salary_amount: 90000, salary_currency: "USD" });
      const res = await request(app)
        .patch(offerUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ salary_amount: null, salary_currency: null });
      expect(res.status).toBe(200);
      expect(res.body.offer.salary_amount).toBeNull();
    });

    // 15. sent offer locks core terms
    it("15. rejects editing once the offer has been sent", async () => {
      const { id, publicId } = await createAndSend();
      const res = await request(app).patch(offerUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ title: "Changed" });
      expect(res.status).toBe(409);
      expect((await Offer.findById(id))!.title).toBe("Backend Engineer");
    });

    it("rejects unknown fields on the edit request body", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).patch(offerUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "sent" });
      expect(res.status).toBe(400);
    });

    // 20. cross-company blocked
    it("20. returns 404 for a cross-company edit attempt", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).patch(offerUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({ title: "Hijacked" });
      expect(res.status).toBe(404);
    });
  });

  // ===== SEND OFFER =====
  describe("sending an offer", () => {
    // 13. send offer
    it("13. sends the offer and moves the application to offered", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockResolvedValueOnce(undefined);
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(201);
      expect(res.body.notification.status).toBe("sent");
      expect((await Offer.findById(id))!.status).toBe("sent");
      expect((await Application.findById(application.id))!.status).toBe("offered");
    });

    // 14. creation alone sends no email
    it("14. creating a draft alone never sends an email", async () => {
      await createDraft();
      expect(mockSend).not.toHaveBeenCalled();
      expect(await EmailNotification.countDocuments()).toBe(0);
    });

    // 18. candidate recipient trusted from DB
    it("18. sends to the candidate's own stored email, never a client-supplied address", async () => {
      const { publicId } = await createDraft();
      // The strict body schema rejects an unexpected field outright...
      const maliciousRes = await request(app)
        .post(sendUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ recipient_email: "attacker@evil.test" });
      expect(maliciousRes.status).toBe(400);

      // ...and a normal, valid request always uses the real candidate email.
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(mockSend.mock.calls[0][0].to).toBe(candidate.email);
    });

    // 19. internal notes excluded from email
    it("19. never includes internal_notes anywhere in the offer email", async () => {
      const { id, publicId } = await createDraft({ internal_notes: "Candidate negotiated hard, approve up to 110k" });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const [sendCall] = mockSend.mock.calls;
      expect(sendCall[0].text).not.toMatch(/negotiated hard/);
      expect(sendCall[0].html).not.toMatch(/negotiated hard/);

      const stored = await EmailNotification.findOne({ offer_id: id, category: "offer_sent" });
      const snapshotKeys = Object.keys(JSON.parse(JSON.stringify(stored!.offer_snapshot)));
      expect(snapshotKeys).not.toContain("internal_notes");
    });

    it("includes candidate name, company name, job title, offer title, salary, and candidate message in the email", async () => {
      const { publicId } = await createDraft({ candidate_message: "We're excited to have you!", start_date: "2026-10-01T00:00:00.000Z" });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const [sendCall] = mockSend.mock.calls;
      expect(sendCall[0].text).toMatch(/Ahmad Khalil/);
      expect(sendCall[0].text).toMatch(/Backend Developer/);
      expect(sendCall[0].text).toMatch(/Backend Engineer/);
      expect(sendCall[0].text).toMatch(/90,000 USD/);
      expect(sendCall[0].text).toMatch(/We're excited to have you!/);
    });

    // 16. SMTP failure recoverable
    it("16. keeps the offer sent even when SMTP delivery fails", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(201);
      expect(res.body.notification.status).toBe("failed");
      expect((await Offer.findById(id))!.status).toBe("sent");
      expect((await Application.findById(application.id))!.status).toBe("offered");
    });

    // 17. retry notification works
    it("17. retries a failed offer notification", async () => {
      const { publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      mockSend.mockResolvedValueOnce(undefined);
      const res = await request(app)
        .post(retryUrl(publicId, sendRes.body.notification.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.notification.status).toBe("sent");
    });

    it("rejects retrying a notification that has not failed", async () => {
      const { publicId } = await createDraft();
      mockSend.mockResolvedValueOnce(undefined);
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app)
        .post(retryUrl(publicId, sendRes.body.notification.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("blocks sending once the Job is soft-deleted", async () => {
      const { publicId } = await createDraft();
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("rejects sending an offer that isn't a draft", async () => {
      const { publicId } = await createAndSend();
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("lists notification history for an offer", async () => {
      const { publicId } = await createDraft();
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).get(notificationsUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
    });

    // 20. cross-company blocked
    it("20. returns 404 for a cross-company send attempt", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
      expect(mockSend).not.toHaveBeenCalled();
    });

    // 42. never a raw SMTP error
    it("42. never exposes a raw SMTP error anywhere in the response", async () => {
      const { publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:587 raw stack"));
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED/);
    });
  });

  // ===== TRANSITIONS =====
  describe("transitions", () => {
    // 21. draft -> sent (covered above in "13. sends the offer")

    // 22. sent -> accepted
    it("22. marks a sent offer accepted, without changing the application's status", async () => {
      const { publicId } = await createAndSend();
      const res = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("accepted");
      // 28-adjacent: Accepted does NOT automatically Hire.
      expect((await Application.findById(application.id))!.status).toBe("offered");
      expect((await Application.findById(application.id))!.final_decision).toBeNull();
    });

    // 23. sent -> declined
    it("23. marks a sent offer declined, recording final_decision without touching status", async () => {
      const { publicId } = await createAndSend();
      const res = await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("declined");

      const stored = await Application.findById(application.id);
      expect(stored!.status).toBe("offered");
      expect(stored!.final_decision).toBe("declined");
    });

    it("rejects accepting a draft offer", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("rejects declining a draft offer", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    // 24. draft -> withdrawn
    it("24. withdraws a draft offer without touching the application", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("withdrawn");
      expect((await Application.findById(application.id))!.status).toBe("in_process");
    });

    // 25. sent -> withdrawn
    it("25. withdraws a sent offer and reverts the application to in_process", async () => {
      const { publicId } = await createAndSend();
      const res = await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("withdrawn");
      expect((await Application.findById(application.id))!.status).toBe("in_process");
    });

    it("allows creating a brand-new offer after withdrawing the previous one (Part 16)", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ title: "Revised Offer" }));
      expect(res.status).toBe(201);
      expect(res.body.offer.title).toBe("Revised Offer");
    });

    // 26. accepted cannot withdraw
    it("26. rejects withdrawing an accepted offer", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const res = await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("rejects withdrawing a declined offer", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const res = await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("rejects withdrawing an already-withdrawn offer", async () => {
      const { publicId } = await createDraft();
      await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const res = await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    // 27. declined cannot accept
    it("27. rejects accepting a declined offer", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const res = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    it("rejects declining an accepted offer", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const res = await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    // 28. accepted -> hired explicit
    it("28. marks the application hired once the offer is accepted", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe("hired");
      expect(res.body.application.final_decision).toBe("hired");

      const stored = await Application.findById(application.id);
      expect(stored!.hired_at).not.toBeNull();
      expect(stored!.hired_by_user_id!.toString()).toBe(hrA.id);
    });

    // 29. sent cannot directly become hired
    it("29. rejects marking hired directly from sent (never through accepted)", async () => {
      const { publicId } = await createAndSend();
      const res = await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
      expect((await Application.findById(application.id))!.status).toBe("offered");
    });

    it("rejects marking hired from a draft offer", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    // 30. hired Application terminal
    it("30. blocks creating a new offer once the application is hired", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
    });

    // 31. no automatic pipeline movement before explicit hired/rejected
    it("31. never changes current_step_id at any point in the offer lifecycle", async () => {
      const step = new Types.ObjectId();
      await Application.updateOne({ _id: application.id }, { $set: { current_step_id: step } });

      const { publicId } = await createAndSend();
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect((await Application.findById(application.id))!.current_step_id!.toString()).toBe(step.toString());
    });

    // 32. race accepted vs declined safe
    it("32. only one of a concurrent accept/decline race wins, never both", async () => {
      const { id, publicId } = await createAndSend();

      const [acceptRes, declineRes] = await Promise.all([
        request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)),
        request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)),
      ]);

      const statuses = [acceptRes.status, declineRes.status].sort();
      expect(statuses).toEqual([200, 409]);

      const stored = await Offer.findById(id);
      expect(["accepted", "declined"]).toContain(stored!.status);
    });

    // 33. duplicate hired safe/conflict
    it("33. a duplicate Mark as Hired attempt safely conflicts", async () => {
      const { publicId } = await createAndSend();
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const hireSpy = jest.spyOn(Application, "findOneAndUpdate").mockResolvedValueOnce(null);
      const res = await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
      hireSpy.mockRestore();
    });

    // 20. cross-company blocked for every transition
    it("20. returns 404 for cross-company accept/decline/withdraw/hire attempts", async () => {
      const { publicId } = await createAndSend();
      const acceptRes = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(acceptRes.status).toBe(404);
      const declineRes = await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(declineRes.status).toBe(404);
      const withdrawRes = await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(withdrawRes.status).toBe(404);
      const hireRes = await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(hireRes.status).toBe(404);
    });
  });

  // ===== LIFECYCLE =====
  describe("lifecycle", () => {
    // 34. closed Job existing applicant behavior — accept/decline/hire still work post-close
    it("34. still allows accept/decline/hire actions after the Job is closed (not deleted)", async () => {
      const { publicId } = await createAndSend();
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });

      const acceptRes = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(acceptRes.status).toBe(200);
      const hireRes = await request(app).post(hireUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(hireRes.status).toBe(200);
    });

    // 36. historical Offer readable afterward
    it("36. keeps a withdrawn/historical Offer readable via the list and its own record", async () => {
      const { id, publicId } = await createDraft();
      await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const stored = await Offer.findById(id);
      expect(stored!.status).toBe("withdrawn");

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offers.map((o: { id: string }) => o.id)).toContain(id);
    });
  });

  // ===== LIST =====
  describe("GET /api/v1/offers (company-wide list)", () => {
    // 37. company scoped
    it("37. is company-scoped", async () => {
      await createDraft();
      const otherJob = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Job B", status: "active" });
      const otherCandidate = await Candidate.create({ full_name: "Other Candidate", email: "other-offer@candidate.test" });
      const otherApplication = await Application.create({
        job_id: otherJob.id,
        candidate_id: otherCandidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
      });
      await Offer.create({
        company_id: companyB.id,
        application_id: otherApplication.id,
        candidate_id: otherCandidate._id,
        job_id: otherJob.id,
        title: "Other Offer",
        created_by_user_id: hrB.id,
        updated_by_user_id: hrB.id,
      });

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offers).toHaveLength(1);
      expect(res.body.offers[0].title).toBe("Backend Engineer");
    });

    // 38. filters
    it("38. filters by jobId and status", async () => {
      const offer = await createAndSend();

      // A second application (same Job) for the second, still-draft offer —
      // only one LIVE offer is ever allowed per application.
      const secondCandidate = await Candidate.create({ full_name: "Second Candidate", email: "second-offer@candidate.test" });
      const secondApplication = await Application.create({
        job_id: jobA.id,
        candidate_id: secondCandidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
      });
      await request(app)
        .post(`/api/v1/applications/${secondApplication.public_id}/offer`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ title: "Another Draft" }));

      const byStatus = await request(app).get(listUrl("?status=sent")).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(byStatus.body.offers.map((o: { id: string }) => o.id)).toEqual([offer.id]);

      const byJob = await request(app).get(listUrl(`?jobId=${jobA.public_id}`)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(byJob.body.offers).toHaveLength(2);
    });

    // Phase 1 dual-accept migration: the jobId filter is a "special
    // attention" case — resolved to Job's real internal id before being
    // used against Offer.job_id.
    it("filters by jobId given as the Job's public_id", async () => {
      await createAndSend();

      const res = await request(app)
        .get(listUrl(`?jobId=${jobA.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offers).toHaveLength(1);
    });

    // 39. search
    it("39. searches by candidate name", async () => {
      await createDraft();
      const res = await request(app).get(listUrl("?search=Ahmad")).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offers).toHaveLength(1);
    });

    it("search matches by offer title", async () => {
      await createDraft({ title: "Staff Engineer Offer" });
      const res = await request(app).get(listUrl("?search=Staff Engineer")).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offers).toHaveLength(1);
    });

    // 40. no N+1
    it("40. does not issue one Candidate/Job query per row (no N+1)", async () => {
      for (let i = 0; i < 5; i++) {
        const otherCandidate = await Candidate.create({ full_name: `Candidate ${i}`, email: `candidate-${i}@test.test` });
        const otherApplication = await Application.create({
          job_id: jobA.id,
          candidate_id: otherCandidate._id,
          cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
          status: "in_process",
        });
        await Offer.create({
          company_id: companyA.id,
          application_id: otherApplication.id,
          candidate_id: otherCandidate._id,
          job_id: jobA.id,
          title: `Offer ${i}`,
          created_by_user_id: hrA.id,
          updated_by_user_id: hrA.id,
        });
      }

      const candidateFindSpy = jest.spyOn(Candidate, "find");
      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offers).toHaveLength(5);
      expect(candidateFindSpy).toHaveBeenCalledTimes(1);
      candidateFindSpy.mockRestore();
    });

    it("returns 404 for an unauthenticated request", async () => {
      const res = await request(app).get(listUrl());
      expect(res.status).toBe(401);
    });

    it("never exposes internal_notes/candidate_message in the list row", async () => {
      await createDraft({ internal_notes: "secret", candidate_message: "hello" });
      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offers[0].internal_notes).toBeUndefined();
      expect(res.body.offers[0].candidate_message).toBeUndefined();
    });
  });

  // ===== EMAIL =====
  describe("email architecture", () => {
    // 41. immutable snapshot
    it("41. retry renders from the immutable snapshot, not the offer's current data", async () => {
      const { publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      // Offer terms are locked once sent, so there's nothing to "edit" here
      // — this asserts the snapshot itself, which is what a retry always renders from.
      const stored = await EmailNotification.findById(sendRes.body.notification.id);
      expect(stored!.offer_snapshot!.offer_title).toBe("Backend Engineer");

      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(publicId, sendRes.body.notification.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(mockSend.mock.calls[1][0].text).toMatch(/Backend Engineer/);
    });
  });

  // ===== Bug fix: Send Offer must never leave Offer.status === "sent" with
  // zero persisted notification history — see offerEmail.service.ts's
  // sendOffer doc comment for the full root-cause explanation. =====
  describe("send offer notification durability (bug fix)", () => {
    // 1. draft offer + no notification -> Not sent (a normal, valid state)
    it("1. a draft offer has no notification history at all", async () => {
      const { publicId } = await createDraft();
      const res = await request(app).get(notificationsUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toEqual([]);
    });

    // 2. Send Offer success -> notification persisted
    it("2. persists exactly one EmailNotification row the moment Send Offer succeeds", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(await EmailNotification.countDocuments({ offer_id: id, category: "offer_sent" })).toBe(1);
    });

    // 3 & 4 & 5 already covered by tests 13/16/17 above; this asserts the
    // INVARIANT directly rather than just the individual outcomes: a
    // notification row exists in BOTH the success and the failure case.
    it("keeps exactly one notification row whether SMTP succeeds or fails", async () => {
      const { id: successOfferId, publicId: successOfferPublicId } = await createDraft({ title: "Success Offer" });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(successOfferPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(await EmailNotification.countDocuments({ offer_id: successOfferId })).toBe(1);

      // A second, independent Application — only one LIVE offer is ever
      // allowed per application.
      const secondCandidate = await Candidate.create({ full_name: "Second Candidate", email: "second-durability@candidate.test" });
      const secondApplication = await Application.create({
        job_id: jobA.id,
        candidate_id: secondCandidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
      });
      const createRes = await request(app)
        .post(`/api/v1/applications/${secondApplication.public_id}/offer`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ title: "Failure Offer" }));
      expect(createRes.status).toBe(201);
      const failureOfferId = createRes.body.offer.id as string;
      const failureOfferPublicId = createRes.body.offer.public_id as string;

      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const sendRes = await request(app).post(sendUrl(failureOfferPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(sendRes.status).toBe(201);
      expect(await EmailNotification.countDocuments({ offer_id: failureOfferId })).toBe(1);
      expect((await Offer.findById(failureOfferId))!.status).toBe("sent");
    });

    // THE core invariant this bug fix guarantees: if notification creation
    // itself fails for any reason, the ENTIRE send transaction rolls back —
    // never a "sent" Offer with zero notification history.
    it("rolls back the Offer/Application transition entirely if EmailNotification creation fails", async () => {
      const { id, publicId } = await createDraft();
      const createSpy = jest.spyOn(EmailNotification, "create").mockRejectedValueOnce(new Error("unexpected write failure"));

      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      createSpy.mockRestore();

      expect(res.status).toBe(500);
      expect((await Offer.findById(id))!.status).toBe("draft");
      expect((await Application.findById(application.id))!.status).toBe("in_process");
      expect(await EmailNotification.countDocuments({ offer_id: id })).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();

      // HR can simply retry — the Offer is still a clean draft.
      mockSend.mockResolvedValueOnce(undefined);
      const retryRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(retryRes.status).toBe(201);
      expect((await Offer.findById(id))!.status).toBe("sent");
      expect(await EmailNotification.countDocuments({ offer_id: id })).toBe(1);
    });

    // 9. rapid double Send -> one business transition / safe notification behavior
    it("9. a rapid concurrent double Send Offer results in exactly one business transition and one notification", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockResolvedValue(undefined);

      const [resA, resB] = await Promise.all([
        request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)),
        request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);
      expect((await Offer.findById(id))!.status).toBe("sent");
      expect(await EmailNotification.countDocuments({ offer_id: id, category: "offer_sent" })).toBe(1);
    });

    // 10. Offer.status sent + notification failed -> Mark Accepted etc may
    // remain, but Candidate Email clearly says Failed (asserted via the
    // notification's own persisted status).
    it("10. still allows Mark Accepted after a failed send — the failure is only reflected on the notification", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const acceptRes = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.offer.status).toBe("accepted");

      const notification = await EmailNotification.findOne({ offer_id: id });
      expect(notification!.status).toBe("failed");
    });

    // 11. legacy sent Offer with no notification handled explicitly/safely
    it("11. safely returns an empty notification history for a legacy sent Offer with no EmailNotification row", async () => {
      // Simulates data that predates this fix (or any other genuinely
      // corrupt state) — never producible through the normal API anymore,
      // written directly to the collection here.
      const legacyOffer = await Offer.create({
        company_id: companyA.id,
        application_id: application.id,
        candidate_id: candidate.id,
        job_id: jobA.id,
        status: "sent",
        title: "Legacy Offer",
        sent_at: new Date(),
        created_by_user_id: hrA.id,
        updated_by_user_id: hrA.id,
      });

      const notificationsRes = await request(app).get(notificationsUrl(legacyOffer.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(notificationsRes.status).toBe(200);
      expect(notificationsRes.body.notifications).toEqual([]);

      const offerRes = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(offerRes.status).toBe(200);
      expect(offerRes.body.offer.status).toBe("sent");
    });
  });

  // ===== Phase 1 opaque public ID migration =====
  describe("public_id", () => {
    it("is assigned automatically on creation with the offer_ prefix and 24-char hex suffix", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.body.offer.public_id).toMatch(/^offer_[a-f0-9]{24}$/);
    });

    it("updates a draft offer looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app)
        .patch(offerUrl(createRes.body.offer.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Renamed Offer" });

      expect(res.status).toBe(200);
      expect(res.body.offer.title).toBe("Renamed Offer");
    });

    it("returns 404 for another company's offer looked up by public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app)
        .patch(offerUrl(createRes.body.offer.public_id))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({ title: "Hijacked" });

      expect(res.status).toBe(404);
    });

    it("sends an offer looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      mockSend.mockResolvedValueOnce(undefined);

      const res = await request(app).post(sendUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(201);
    });

    it("marks an offer accepted looked up by its public_id (HR manual fallback)", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(acceptUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("accepted");
    });

    it("withdraws an offer looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app).post(withdrawUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("withdrawn");
    });

    it("marks an application hired from an offer looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      await request(app).post(acceptUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(hireUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe("hired");
    });

    it("lists notifications for an offer looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(createRes.body.offer.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app)
        .get(notificationsUrl(createRes.body.offer.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
    });

    it("exposes the owning application's public_id on the company-wide list row", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.offers[0].application_public_id).toBe(application.public_id);
    });
  });
});
