import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { EmailNotification } from "../src/models/EmailNotification.model";
import { CompanyInvitation } from "../src/models/CompanyInvitation.model";
import { HiringStep } from "../src/models/HiringStep.model";
import { Offer } from "../src/models/Offer.model";
import { ApplicationAssessment } from "../src/models/ApplicationAssessment.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";
import type { JobDoc } from "../src/models/Job.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

const emailActivityUrl = "/api/v1/email-activity";

function cvFile() {
  return { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 };
}

async function createApplicationFor(job: JobDoc) {
  const candidate = await Candidate.create({ full_name: "Ahmad Khalil", email: `ahmad-${new Types.ObjectId().toString()}@test.test` });
  return Application.create({ job_id: job.id, candidate_id: candidate._id, cv_file: cvFile(), status: "applied" });
}

describe("GET /api/v1/email-activity", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr-a@acme.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr-b@acme.test", role: "HR" });
    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
  });

  async function createRejectionEmail(overrides: Record<string, unknown> = {}) {
    const application = await createApplicationFor(jobA);
    return EmailNotification.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      category: "application_rejection",
      recipient_email: "ahmad@test.test",
      subject: "Update on your application",
      rejection_snapshot: { candidate_name: "Ahmad Khalil", company_name: "Company A", job_title: "Backend Developer" },
      status: "sent",
      sent_at: new Date(),
      mutation_version_at: new Date(),
      ...overrides,
    });
  }

  async function createInvitationEmail(overrides: Record<string, unknown> = {}) {
    return CompanyInvitation.create({
      company_id: companyA.id,
      email: "invitee@test.test",
      role: "HR",
      status: "pending",
      invited_by_user_id: hrA.id,
      token_hash: `hash-${new Types.ObjectId().toString()}`,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      email_status: "sent",
      email_sent_at: new Date(),
      ...overrides,
    });
  }

  // 19. EmailNotification normalized correctly
  it("19. normalizes an EmailNotification row correctly", async () => {
    const application = await createApplicationFor(jobA);
    await EmailNotification.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      category: "offer_sent",
      recipient_email: "ahmad@test.test",
      subject: "Your offer",
      offer_snapshot: { candidate_name: "Ahmad Khalil", company_name: "Company A", job_title: "Backend Developer", offer_title: "Backend Engineer" },
      status: "sent",
      sent_at: new Date(),
      mutation_version_at: new Date(),
    });

    const res = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0]).toMatchObject({
      source: "email_notification",
      type: "offer_sent",
      type_label: "Offer",
      recipient_email: "ahmad@test.test",
      status: "sent",
      related_label: "Ahmad Khalil — Backend Developer",
    });
    expect(res.body.emails[0].related_application_id).toBe(application.id);
  });

  // Phase 2 cutover: every URL-facing identifier on a row — its own
  // identity (used by retry actions) and every related resource id used
  // by a retry action (offer, assessment) — must be exposed as public_id,
  // never only as a raw Mongo id.
  it("exposes public_id on the row itself and on every related resource used by a retry action", async () => {
    const application = await createApplicationFor(jobA);
    const assessmentStage = await HiringStep.create({
      job_id: jobA.id,
      name: "Technical Assessment",
      type: "assessment",
      position: 0,
    });
    const offer = await Offer.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      job_id: jobA.id,
      title: "Backend Engineer",
      status: "sent",
      created_by_user_id: hrA.id,
      updated_by_user_id: hrA.id,
    });
    const assessment = await ApplicationAssessment.create({
      company_id: companyA.id,
      application_id: application.id,
      job_id: jobA.id,
      hiring_step_id: assessmentStage.id,
      name: "Backend Technical Test",
      external_url: "https://external-platform.example/test/abc",
      status: "pending",
      stage_snapshot: { id: assessmentStage.id, name: "Technical Assessment", type: "assessment" },
      created_by_user_id: hrA.id,
      updated_by_user_id: hrA.id,
    });
    const offerNotification = await EmailNotification.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      offer_id: offer.id,
      category: "offer_sent",
      recipient_email: "ahmad@test.test",
      subject: "Your offer",
      offer_snapshot: { candidate_name: "Ahmad Khalil", company_name: "Company A", job_title: "Backend Developer", offer_title: "Backend Engineer" },
      status: "sent",
      sent_at: new Date(),
      mutation_version_at: new Date(),
    });
    const assessmentNotification = await EmailNotification.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      application_assessment_id: assessment.id,
      category: "assessment_invitation",
      recipient_email: "ahmad@test.test",
      subject: "Your assessment",
      assessment_snapshot: {
        candidate_name: "Ahmad Khalil",
        company_name: "Company A",
        job_title: "Backend Developer",
        assessment_name: "Backend Technical Test",
        external_url: "https://external-platform.example/test/abc",
      },
      status: "sent",
      sent_at: new Date(),
      mutation_version_at: new Date(),
    });

    const res = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);

    const offerRow = res.body.emails.find((e: { id: string }) => e.id === offerNotification.id);
    expect(offerRow.public_id).toBe(offerNotification.public_id);
    expect(offerRow.related_offer_public_id).toBe(offer.public_id);

    const assessmentRow = res.body.emails.find((e: { id: string }) => e.id === assessmentNotification.id);
    expect(assessmentRow.public_id).toBe(assessmentNotification.public_id);
    expect(assessmentRow.related_assessment_public_id).toBe(assessment.public_id);
  });

  // 20. CompanyInvitation email event normalized correctly
  it("20. normalizes a CompanyInvitation email event correctly", async () => {
    const invitation = await createInvitationEmail();

    const res = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0]).toMatchObject({
      source: "company_invitation",
      type: "company_invitation",
      type_label: "Company Invitation",
      recipient_email: "invitee@test.test",
      status: "sent",
      related_label: "Invited as HR",
      related_invitation_id: invitation.id,
    });
    expect(res.body.emails[0].public_id).toBe(invitation.public_id);
    expect(res.body.emails[0].related_invitation_public_id).toBe(invitation.public_id);
  });

  // 21. company isolation
  it("21. never returns another company's email activity", async () => {
    await createRejectionEmail();
    const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Other Job", status: "active" });
    const applicationB = await createApplicationFor(jobB);
    await EmailNotification.create({
      company_id: companyB.id,
      application_id: applicationB.id,
      candidate_id: applicationB.candidate_id,
      category: "application_rejection",
      recipient_email: "other@test.test",
      subject: "Update",
      rejection_snapshot: { candidate_name: "Other", company_name: "Company B", job_title: "Other Job" },
      status: "sent",
      mutation_version_at: new Date(),
    });

    const res = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0].recipient_email).toBe("ahmad@test.test");
  });

  // 22. recipient search
  it("22. filters by recipient email search", async () => {
    await createRejectionEmail({ recipient_email: "findme@test.test" });
    await createRejectionEmail({ recipient_email: "someoneelse@test.test" });

    const res = await request(app)
      .get(`${emailActivityUrl}?search=findme`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0].recipient_email).toBe("findme@test.test");
  });

  // 23. type filter
  it("23. filters by type, excluding company_invitation rows entirely when narrowed to a recruitment category", async () => {
    await createRejectionEmail();
    await createInvitationEmail();

    const res = await request(app)
      .get(`${emailActivityUrl}?type=application_rejection`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0].type).toBe("application_rejection");
  });

  it("23. filters to only company_invitation rows", async () => {
    await createRejectionEmail();
    await createInvitationEmail();

    const res = await request(app)
      .get(`${emailActivityUrl}?type=company_invitation`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails).toHaveLength(1);
    expect(res.body.emails[0].source).toBe("company_invitation");
  });

  // 24. status filter
  it("24. filters by status across both sources", async () => {
    await createRejectionEmail({ status: "failed", sent_at: null, failure_code: "delivery_failed" });
    await createRejectionEmail({ status: "sent" });
    await createInvitationEmail({ email_status: "failed", email_sent_at: null, email_failure_code: "delivery_failed" });

    const res = await request(app)
      .get(`${emailActivityUrl}?status=failed`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails).toHaveLength(2);
    expect(res.body.emails.every((e: { status: string }) => e.status === "failed")).toBe(true);
  });

  // 25. pagination
  it("25. paginates results", async () => {
    for (let i = 0; i < 5; i++) {
      await createRejectionEmail();
    }

    const res = await request(app)
      .get(`${emailActivityUrl}?page=1&limit=2`)
      .set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
  });

  // 26. newest first
  it("26. sorts newest activity first across both sources", async () => {
    const older = await createRejectionEmail({ sent_at: new Date(Date.now() - 60 * 60 * 1000) });
    const newer = await createInvitationEmail({ email_sent_at: new Date() });

    const res = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.emails[0].id).toBe(newer.id);
    expect(res.body.emails[1].id).toBe(older.id);
  });

  // 27. no raw provider errors/snapshots/tokens exposed
  it("27. never exposes raw failure codes as SMTP errors, tokens, or full snapshots", async () => {
    await createRejectionEmail({ status: "failed", sent_at: null, failure_code: "delivery_failed" });
    await createInvitationEmail();

    const res = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/token_hash/);
    expect(body).not.toMatch(/rejection_snapshot|offer_snapshot|event_snapshot|assessment_snapshot/);
    expect(body).not.toMatch(/smtp|ECONN|ETIMEDOUT/i);
  });

  // 28. related application/interview/offer links only for owned tenant
  it("28. related ids never point at another company's records implicitly (company-scoped query only)", async () => {
    const application = await createApplicationFor(jobA);
    await EmailNotification.create({
      company_id: companyA.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      category: "application_rejection",
      recipient_email: "ahmad@test.test",
      subject: "Update",
      rejection_snapshot: { candidate_name: "Ahmad Khalil", company_name: "Company A", job_title: "Backend Developer" },
      status: "sent",
      mutation_version_at: new Date(),
    });

    const resA = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
    const resB = await request(app).get(emailActivityUrl).set("Authorization", authHeaderFor(hrB, companyB.id));
    expect(resA.body.emails.some((e: { related_application_id?: string }) => e.related_application_id === application.id)).toBe(true);
    expect(resB.body.emails).toHaveLength(0);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get(emailActivityUrl);
    expect(res.status).toBe(401);
  });
});
