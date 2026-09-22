import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate, type CandidateDoc } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { Interview } from "../src/models/Interview.model";
import { EmailNotification } from "../src/models/EmailNotification.model";
import { createCompany, createUser } from "./helpers/factories";
import { formatZonedDate, formatZonedTime } from "../src/utils/timezone";
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

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function scheduleUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/interviews`;
}
function interviewUrl(interviewId: string) {
  return `/api/v1/interviews/${interviewId}`;
}
function notificationsUrl(interviewId: string) {
  return `/api/v1/interviews/${interviewId}/notifications`;
}
function retryUrl(notificationId: string) {
  return `/api/v1/interview-notifications/${notificationId}/retry`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Backend Technical Interview",
    starts_at: hoursFromNow(24),
    ends_at: hoursFromNow(25),
    timezone: "Asia/Beirut",
    interviewer_user_ids: [],
    ...overrides,
  };
}

describe("Candidate Interview Email Notifications", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let interviewerA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let interviewStage: HiringStepDoc;
  let candidate: CandidateDoc;
  let application: ApplicationDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    interviewerA = await createUser({ companyId: companyA.id, email: "interviewer@a.test", role: "HR", name: "Alex Interviewer" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    interviewStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 0 });

    candidate = await Candidate.create({
      full_name: "Sarah Ahmed",
      email: `sarah-${new Types.ObjectId().toString()}@candidate.test`,
    });
    application = await Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
      current_step_id: interviewStage._id,
    });

    mockSend.mockReset().mockResolvedValue(undefined);
  });

  async function scheduleOne(overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post(scheduleUrl(application.id))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send(validBody({ interviewer_user_ids: [interviewerA.id], ...overrides }));
    return { interviewId: res.body.interview.id as string, res };
  }

  // ===== SCHEDULE =====
  describe("schedule notification", () => {
    it("attempts a scheduled email after a successful schedule", async () => {
      await scheduleOne();
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("persists a notification record for the scheduled email", async () => {
      const { interviewId } = await scheduleOne();
      const notification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      expect(notification).not.toBeNull();
      expect(notification!.status).toBe("sent");
    });

    it("derives the recipient from the database, not the request", async () => {
      await scheduleOne();
      const [[sentArgs]] = mockSend.mock.calls;
      expect(sentArgs.to).toBe(candidate.email);
    });

    it("rejects a request that tries to supply a candidate email", async () => {
      const res = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id], candidate_email: "attacker@evil.test" }));
      expect(res.status).toBe(400);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("includes correct job/company/interview/stage details in the email content", async () => {
      await scheduleOne({ title: "Backend Technical Interview" });
      const [[sentArgs]] = mockSend.mock.calls;
      expect(sentArgs.text).toContain("Backend Developer");
      expect(sentArgs.text).toContain("Company A");
      expect(sentArgs.text).toContain("Backend Technical Interview");
      expect(sentArgs.text).toContain("Technical Interview"); // stage name
      expect(sentArgs.html).toContain("Backend Developer");
    });

    it("renders the correct interview time in the Interview's own timezone", async () => {
      const startsAtIso = hoursFromNow(30);
      const endsAtIso = hoursFromNow(31);
      await scheduleOne({ starts_at: startsAtIso, ends_at: endsAtIso, timezone: "Europe/Berlin" });

      const [[sentArgs]] = mockSend.mock.calls;
      const expectedDate = formatZonedDate(new Date(startsAtIso), "Europe/Berlin");
      const expectedStart = formatZonedTime(new Date(startsAtIso), "Europe/Berlin");
      expect(sentArgs.text).toContain(expectedDate);
      expect(sentArgs.text).toContain(expectedStart);
      expect(sentArgs.text).toContain("Europe/Berlin");
    });

    it("includes interviewer names when interviewers are assigned", async () => {
      await scheduleOne({ interviewer_user_ids: [interviewerA.id] });
      const [[sentArgs]] = mockSend.mock.calls;
      expect(sentArgs.text).toContain("Alex Interviewer");
    });

    it("never fabricates a Meet URL when none exists (uses neutral wording instead)", async () => {
      await scheduleOne();
      const [[sentArgs]] = mockSend.mock.calls;
      expect(sentArgs.text).not.toMatch(/meet\.google\.com/);
      expect(sentArgs.text).toContain("Meeting details will be shared separately if applicable.");
      expect(sentArgs.html).not.toContain("Join Google Meet");
    });

    it("includes a real Join Google Meet link when the Interview already has one (service-level, since schedule can't produce this combination via the API alone)", async () => {
      const { sendInterviewScheduledNotification } = await import("../src/modules/interviews/interviewNotification.service");
      const interview = await Interview.create({
        application_id: application.id,
        job_id: jobA.id,
        hiring_step_id: interviewStage.id,
        stage_snapshot: { name: interviewStage.name, type: "interview" },
        title: "Backend Technical Interview",
        starts_at: new Date(hoursFromNow(24)),
        ends_at: new Date(hoursFromNow(25)),
        timezone: "Asia/Beirut",
        interviewer_user_ids: [interviewerA._id],
        scheduled_by: hrA._id,
        status: "scheduled",
        calendar_provider: "google",
        calendar_event_id: "evt-1",
        meeting_url: "https://meet.google.com/abc-defg-hij",
      });

      await sendInterviewScheduledNotification(interview, hrA.id);

      const [[sentArgs]] = mockSend.mock.calls;
      expect(sentArgs.text).toContain("https://meet.google.com/abc-defg-hij");
      expect(sentArgs.html).toContain("https://meet.google.com/abc-defg-hij");
      expect(sentArgs.html).toContain("Join Google Meet");
    });

    it("does not roll back the Interview when SMTP delivery fails", async () => {
      mockSend.mockRejectedValue(new Error("raw smtp connection error, should never leak"));
      const { interviewId, res } = await scheduleOne();

      expect(res.status).toBe(201);
      const stored = await Interview.findById(interviewId);
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe("scheduled");
    });

    it("records a failed notification (with a safe failure code) when SMTP delivery fails", async () => {
      mockSend.mockRejectedValue(new Error("raw smtp connection error, should never leak"));
      const { interviewId } = await scheduleOne();

      const notification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      expect(notification!.status).toBe("failed");
      expect(notification!.failure_code).toBeTruthy();
      expect(notification!.failure_code).not.toMatch(/raw smtp connection error/);
    });

    it("surfaces the delivery state on the returned Interview DTO", async () => {
      const { res } = await scheduleOne();
      expect(res.body.interview.latest_notification).toEqual({ category: "interview_scheduled", status: "sent" });
    });
  });

  // ===== RESCHEDULE =====
  describe("reschedule notification", () => {
    it("creates a distinct reschedule notification, separate from the schedule one", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockClear();

      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      const notifications = await EmailNotification.find({ interview_id: interviewId }).sort({ created_at: 1 });
      expect(notifications).toHaveLength(2);
      expect(notifications[0]!.category).toBe("interview_scheduled");
      expect(notifications[1]!.category).toBe("interview_rescheduled");
    });

    it("uses the NEW date/time in the rescheduled email", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockClear();

      const newStart = hoursFromNow(72);
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: hoursFromNow(73), timezone: "Asia/Beirut" });

      const [[sentArgs]] = mockSend.mock.calls;
      const expectedDate = formatZonedDate(new Date(newStart), "Asia/Beirut");
      expect(sentArgs.text).toContain(expectedDate);
      expect(sentArgs.text.toLowerCase()).toContain("rescheduled");
    });

    it("does not roll back the local reschedule when SMTP delivery fails", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));

      const newStart = hoursFromNow(72);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: hoursFromNow(73), timezone: "Asia/Beirut" });

      expect(res.status).toBe(200);
      const stored = await Interview.findById(interviewId);
      expect(new Date(stored!.starts_at).toISOString()).toBe(new Date(newStart).toISOString());
    });

    it("a second legitimate reschedule creates a second, distinct reschedule notification", async () => {
      const { interviewId } = await scheduleOne();

      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(96), ends_at: hoursFromNow(97), timezone: "Asia/Beirut" });

      const rescheduleNotifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(rescheduleNotifications).toHaveLength(2);
    });

    it("duplicate calls for the SAME committed mutation do not create a second notification", async () => {
      const { interviewId } = await scheduleOne();
      const interview = await Interview.findById(interviewId);

      const { sendInterviewRescheduledNotification } = await import("../src/modules/interviews/interviewNotification.service");
      await sendInterviewRescheduledNotification(interview!, hrA.id);
      await sendInterviewRescheduledNotification(interview!, hrA.id);

      const rescheduleNotifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(rescheduleNotifications).toHaveLength(1);
    });
  });

  // ===== CANCEL =====
  describe("cancellation notification", () => {
    it("creates a cancellation notification", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockClear();

      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const notification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_cancelled" });
      expect(notification).not.toBeNull();
    });

    it("never includes the internal cancellation reason in the candidate email", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockClear();

      await request(app)
        .patch(`${interviewUrl(interviewId)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ reason: "Candidate failed background check — internal HR use only" });

      const [[sentArgs]] = mockSend.mock.calls;
      expect(sentArgs.text).not.toMatch(/background check/i);
      expect(sentArgs.html).not.toMatch(/background check/i);
    });

    it("does not roll back the cancellation when SMTP delivery fails", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));

      const res = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.interview.status).toBe("cancelled");
    });

    it("the Interview remains cancelled on a later read regardless of email failure", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app).get(interviewUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.interview.status).toBe("cancelled");
    });
  });

  // ===== NOTIFICATION HISTORY =====
  describe("GET /interviews/:interviewId/notifications", () => {
    it("returns the full notification history, newest first", async () => {
      const { interviewId } = await scheduleOne();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app).get(notificationsUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(2);
      expect(res.body.notifications[0].category).toBe("interview_cancelled");
      expect(res.body.notifications[1].category).toBe("interview_scheduled");
    });

    it("rejects an unauthenticated request with 401", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app).get(notificationsUrl(interviewId));
      expect(res.status).toBe(401);
    });

    it("returns 404 for a cross-company interview", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app).get(notificationsUrl(interviewId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    it("never exposes credential-looking fields", async () => {
      const { interviewId } = await scheduleOne();
      const res = await request(app).get(notificationsUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(JSON.stringify(res.body)).not.toMatch(/password|smtp_pass|token|secret/i);
    });
  });

  // ===== RETRY =====
  describe("POST /interview-notifications/:notificationId/retry", () => {
    async function scheduleWithFailedNotification() {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { interviewId } = await scheduleOne();
      const notification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      return { interviewId, notificationId: notification!.id as string };
    }

    it("retries a failed notification and updates it to sent", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      mockSend.mockResolvedValueOnce(undefined);

      const res = await request(app).post(retryUrl(notificationId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.notification.status).toBe("sent");
      expect(res.body.notification.sent_at).toBeTruthy();
      expect(res.body.notification.failure_code).toBeNull();
    });

    it("records the retry attempt (attempt_count increases, sent_at set) on success", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      const before = await EmailNotification.findById(notificationId);
      mockSend.mockResolvedValueOnce(undefined);

      await request(app).post(retryUrl(notificationId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const after = await EmailNotification.findById(notificationId);
      expect(after!.attempt_count).toBe(before!.attempt_count + 1);
      expect(after!.sent_at).not.toBeNull();
    });

    it("rejects retrying an already-sent notification", async () => {
      const { interviewId } = await scheduleOne();
      const notification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      expect(notification!.status).toBe("sent");

      const res = await request(app).post(retryUrl(notification!.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
      expect(mockSend).toHaveBeenCalledTimes(1); // only the original send — retry never ran
    });

    it("returns 404 for a cross-company retry attempt", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      const res = await request(app).post(retryUrl(notificationId)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({});
      expect(res.status).toBe(404);
    });

    it("sends to the persisted recipient snapshot, never a client-supplied address", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      mockSend.mockResolvedValueOnce(undefined);

      await request(app).post(retryUrl(notificationId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [, [retryArgs]] = mockSend.mock.calls;
      expect(retryArgs.to).toBe(candidate.email);
    });

    it("rejects an attempt to supply an arbitrary recipient/body on retry", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      const res = await request(app)
        .post(retryUrl(notificationId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ recipient_email: "attacker@evil.test", body: "arbitrary content" });
      expect(res.status).toBe(400);
    });

    it("rejects an unauthenticated retry request with 401", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      const res = await request(app).post(retryUrl(notificationId)).send({});
      expect(res.status).toBe(401);
    });

    it("never exposes the raw SMTP error on a retry that fails again", async () => {
      const { notificationId } = await scheduleWithFailedNotification();
      mockSend.mockRejectedValueOnce(new Error("raw smtp auth failure detail, should never leak"));

      const res = await request(app).post(retryUrl(notificationId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.notification.status).toBe("failed");
      expect(JSON.stringify(res.body)).not.toMatch(/raw smtp auth failure detail/);
    });

    it("returns 404 for a nonexistent notification id", async () => {
      const res = await request(app)
        .post(retryUrl(new Types.ObjectId().toString()))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});
      expect(res.status).toBe(404);
    });
  });

  // ===== SECURITY =====
  describe("security", () => {
    it("never stores credential-like fields on the notification record", async () => {
      const { interviewId } = await scheduleOne();
      const notification = await EmailNotification.findOne({ interview_id: interviewId });
      const stored = JSON.stringify(notification!.toObject());
      expect(stored).not.toMatch(/smtp_pass|password|app.?password/i);
    });
  });

  // ===== HISTORICAL SNAPSHOT INTEGRITY =====
  // A retry must reproduce the ORIGINAL event's content, never whatever
  // is currently true of the Interview — see EmailNotification.model.ts's
  // eventSnapshotSchema doc comment for why.
  describe("historical snapshot integrity (retry reflects the ORIGINAL event, not the current Interview)", () => {
    it("retry of a failed SCHEDULED notification still uses the ORIGINAL scheduled date/time after a later reschedule", async () => {
      const originalStart = hoursFromNow(24);
      const originalEnd = hoursFromNow(25);
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { interviewId } = await scheduleOne({ starts_at: originalStart, ends_at: originalEnd, timezone: "Asia/Beirut" });
      const scheduledNotification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      expect(scheduledNotification!.status).toBe("failed");

      // The Interview is later rescheduled to a completely different time.
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(200), ends_at: hoursFromNow(201), timezone: "Europe/Berlin" });

      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(scheduledNotification!.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [lastCallArgs] = mockSend.mock.calls[mockSend.mock.calls.length - 1]!;
      const expectedDate = formatZonedDate(new Date(originalStart), "Asia/Beirut");
      expect(lastCallArgs.text).toContain(expectedDate);
      expect(lastCallArgs.text).toContain("Asia/Beirut");
      expect(lastCallArgs.text).not.toContain("Europe/Berlin");
    });

    it("retry of a failed FIRST reschedule still uses the FIRST reschedule's time after a second reschedule succeeds with a different time", async () => {
      const { interviewId } = await scheduleOne();

      const firstRescheduleStart = hoursFromNow(48);
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: firstRescheduleStart, ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      const firstRescheduleNotification = await EmailNotification.findOne({
        interview_id: interviewId,
        category: "interview_rescheduled",
      });
      expect(firstRescheduleNotification!.status).toBe("failed");

      // A second, genuinely later reschedule succeeds with a different time.
      mockSend.mockResolvedValueOnce(undefined);
      const secondRescheduleStart = hoursFromNow(300);
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: secondRescheduleStart, ends_at: hoursFromNow(301), timezone: "Asia/Beirut" });

      mockSend.mockResolvedValueOnce(undefined);
      await request(app)
        .post(retryUrl(firstRescheduleNotification!.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      const [lastCallArgs] = mockSend.mock.calls[mockSend.mock.calls.length - 1]!;
      const expectedDate = formatZonedDate(new Date(firstRescheduleStart), "Asia/Beirut");
      const notExpectedDate = formatZonedDate(new Date(secondRescheduleStart), "Asia/Beirut");
      expect(lastCallArgs.text).toContain(expectedDate);
      expect(lastCallArgs.text).not.toContain(notExpectedDate);
    });

    it("a Meet link added AFTER a failed notification's event does not magically appear when that notification is retried", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { interviewId } = await scheduleOne();
      const scheduledNotification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      expect(scheduledNotification!.event_snapshot!.meeting_url).toBeNull();

      // A Meet link is added to the Interview LATER, after the failed event.
      await Interview.updateOne(
        { _id: interviewId },
        { $set: { calendar_provider: "google", calendar_event_id: "evt-1", meeting_url: "https://meet.google.com/added-later" } }
      );

      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(scheduledNotification!.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [lastCallArgs] = mockSend.mock.calls[mockSend.mock.calls.length - 1]!;
      expect(lastCallArgs.text).not.toContain("https://meet.google.com/added-later");
      expect(lastCallArgs.text).toContain("Meeting details will be shared separately if applicable.");

      const reread = await EmailNotification.findById(scheduledNotification!.id);
      expect(reread!.event_snapshot!.meeting_url).toBeNull();
    });

    it("interviewer changes made AFTER a failed notification's event do not alter that notification's retried content", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { interviewId } = await scheduleOne({ interviewer_user_ids: [interviewerA.id] });
      const scheduledNotification = await EmailNotification.findOne({ interview_id: interviewId, category: "interview_scheduled" });
      expect(scheduledNotification!.event_snapshot!.interviewer_names).toEqual(["Alex Interviewer"]);

      const newInterviewer = await createUser({ companyId: companyA.id, email: "new-interviewer@a.test", role: "HR", name: "Nora New" });
      await Interview.updateOne({ _id: interviewId }, { $set: { interviewer_user_ids: [newInterviewer._id] } });

      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(scheduledNotification!.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [lastCallArgs] = mockSend.mock.calls[mockSend.mock.calls.length - 1]!;
      expect(lastCallArgs.text).toContain("Alex Interviewer");
      expect(lastCallArgs.text).not.toContain("Nora New");
    });

    it("never stores rendered HTML/text content on the notification record itself", async () => {
      const { interviewId } = await scheduleOne();
      const notification = await EmailNotification.findOne({ interview_id: interviewId });
      const stored = JSON.stringify(notification!.toObject());
      expect(stored).not.toMatch(/<!doctype|<html|<body/i);
    });

    it("never stores credential/provider secrets anywhere on the event_snapshot", async () => {
      const { interviewId } = await scheduleOne();
      const notification = await EmailNotification.findOne({ interview_id: interviewId });
      const stored = JSON.stringify(notification!.event_snapshot);
      expect(stored).not.toMatch(/smtp_pass|password|refresh_token|access_token|client_secret/i);
    });
  });

  // ===== IDEMPOTENCY SCOPE =====
  // Previously, a duplicate/identical HTTP reschedule request could reach
  // interviewService.rescheduleInterview() a second time and succeed
  // again (its guard was only { status: "scheduled" }, which reschedule
  // never changes), producing a new updated_at and therefore a genuine
  // second rescheduled-notification email. interview.service.ts's
  // rescheduleInterview now detects this specific case — the requested
  // starts_at/ends_at/timezone/interviewer_user_ids being IDENTICAL to
  // what is already persisted — as a semantic no-op: no write, no new
  // updated_at, and (see below) the controller skips the notification/
  // Google-sync calls entirely rather than relying on them to separately
  // no-op. See interviewNotification.service.ts's createAndSendNotification
  // doc comment for the deeper, still-honest explanation of what this is
  // (and isn't) a general idempotency mechanism for.
  describe("idempotency + semantic no-op protection", () => {
    it("PROTECTED (notification layer): two calls for the exact SAME committed mutation (same interview.updated_at) never create two notifications", async () => {
      const { interviewId } = await scheduleOne();
      const interview = await Interview.findById(interviewId);

      const { sendInterviewScheduledNotification } = await import("../src/modules/interviews/interviewNotification.service");
      // A second call using the SAME already-committed document (same
      // updated_at) — simulates a bug/retry at the notification layer
      // itself, not a new HTTP request.
      await sendInterviewScheduledNotification(interview!, hrA.id);

      const notifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_scheduled" });
      expect(notifications).toHaveLength(1);
    });

    it("PROTECTED (reschedule no-op): two separate HTTP reschedule requests with IDENTICAL values create no mutation and no second notification/email", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockClear();

      // Two separate requests reaching the endpoint independently — e.g. a
      // browser/proxy resending an identical PATCH /reschedule.
      const body = { starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" };
      const resA = await request(app).patch(`${interviewUrl(interviewId)}/reschedule`).set("Authorization", authHeaderFor(hrA, companyA.id)).send(body);
      const before = await Interview.findById(interviewId);
      const resB = await request(app).patch(`${interviewUrl(interviewId)}/reschedule`).set("Authorization", authHeaderFor(hrA, companyA.id)).send(body);
      const after = await Interview.findById(interviewId);

      // Both requests report success — the second is a clean no-op, never a 409.
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // updated_at is untouched by the second, identical request.
      expect(after!.updated_at!.getTime()).toBe(before!.updated_at!.getTime());

      // Exactly ONE rescheduled-notification row (and exactly one real
      // send attempt) — not two.
      const rescheduleNotifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(rescheduleNotifications).toHaveLength(1);
      expect(mockSend).toHaveBeenCalledTimes(1); // 1, not 2 — the duplicate never even attempts a send.
    });

    it("scheduleInterview is NOT exposed to the reschedule gap — a duplicate schedule request is rejected before any notification runs", async () => {
      mockSend.mockClear();
      const body = { title: "Backend Technical Interview", starts_at: hoursFromNow(24), ends_at: hoursFromNow(25), timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] };
      const resA = await request(app).post(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(body);
      const resB = await request(app).post(scheduleUrl(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(body);

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(409); // Interview.model.ts's own partial unique index rejects it first.
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("cancelInterview is NOT exposed to the reschedule gap — a duplicate cancel request is rejected before any notification runs", async () => {
      const { interviewId } = await scheduleOne();
      mockSend.mockClear();

      const resA = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const resB = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(409); // cancelInterview's own one-way status guard rejects it.
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  // ===== RESCHEDULE SEMANTIC NO-OP PROTECTION =====
  describe("reschedule semantic no-op protection", () => {
    async function scheduleAndRescheduleOnce() {
      const { interviewId } = await scheduleOne({ interviewer_user_ids: [interviewerA.id] });
      mockSend.mockClear();
      const newStart = hoursFromNow(48);
      const newEnd = hoursFromNow(49);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] });
      return { interviewId, newStart, newEnd, res };
    }

    it("1. a genuinely different first reschedule mutates the Interview and creates one rescheduled-notification event", async () => {
      const { interviewId, res } = await scheduleAndRescheduleOnce();
      expect(res.status).toBe(200);

      const notifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(notifications).toHaveLength(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("2. an identical second reschedule request returns 200 but performs no mutation", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();
      const before = await Interview.findById(interviewId);

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] });

      expect(res.status).toBe(200);
      const after = await Interview.findById(interviewId);
      expect(new Date(after!.starts_at).toISOString()).toBe(new Date(before!.starts_at).toISOString());
      expect(res.body.interview.starts_at).toBe(new Date(newStart).toISOString());
    });

    it("3. an identical retry preserves updated_at exactly", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();
      const before = await Interview.findById(interviewId);

      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] });

      const after = await Interview.findById(interviewId);
      expect(after!.updated_at!.getTime()).toBe(before!.updated_at!.getTime());
    });

    it("4. an identical retry creates no second EmailNotification", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();

      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] });

      const notifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(notifications).toHaveLength(1);
    });

    it("5. an identical retry causes no second SMTP send attempt", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();
      expect(mockSend).toHaveBeenCalledTimes(1);

      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("7. the same interviewer set submitted in a different order is treated as a no-op", async () => {
      const secondInterviewer = await createUser({ companyId: companyA.id, email: "second@a.test", role: "HR" });
      const { interviewId } = await scheduleOne({ interviewer_user_ids: [interviewerA.id, secondInterviewer.id] });
      mockSend.mockClear();
      const before = await Interview.findById(interviewId);

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({
          starts_at: before!.starts_at.toISOString(),
          ends_at: before!.ends_at.toISOString(),
          timezone: before!.timezone,
          // Reversed order relative to how they were originally stored.
          interviewer_user_ids: [secondInterviewer.id, interviewerA.id],
        });

      expect(res.status).toBe(200);
      const after = await Interview.findById(interviewId);
      expect(after!.updated_at!.getTime()).toBe(before!.updated_at!.getTime());
      expect(mockSend).not.toHaveBeenCalled();
      expect(await EmailNotification.countDocuments({ interview_id: interviewId, category: "interview_rescheduled" })).toBe(0);
    });

    it("8. a genuinely different time creates a real second reschedule and a distinct notification", async () => {
      const { interviewId, newEnd } = await scheduleAndRescheduleOnce();
      const before = await Interview.findById(interviewId);

      const anotherNewStart = hoursFromNow(96);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: anotherNewStart, ends_at: hoursFromNow(97), timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] });

      expect(res.status).toBe(200);
      const after = await Interview.findById(interviewId);
      expect(after!.updated_at!.getTime()).not.toBe(before!.updated_at!.getTime());
      expect(new Date(after!.starts_at).toISOString()).toBe(new Date(anotherNewStart).toISOString());
      void newEnd;

      const notifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(notifications).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("9. a genuinely different interviewer set creates a real second reschedule and a distinct notification", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();
      const before = await Interview.findById(interviewId);
      const differentInterviewer = await createUser({ companyId: companyA.id, email: "different@a.test", role: "HR" });

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [differentInterviewer.id] });

      expect(res.status).toBe(200);
      const after = await Interview.findById(interviewId);
      expect(after!.updated_at!.getTime()).not.toBe(before!.updated_at!.getTime());
      expect(after!.interviewer_user_ids.map((id) => id.toString())).toEqual([differentInterviewer.id]);

      const notifications = await EmailNotification.find({ interview_id: interviewId, category: "interview_rescheduled" });
      expect(notifications).toHaveLength(2);
    });

    it("10. existing authorization/tenant rules are unchanged for a no-op-shaped reschedule request", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();
      const body = { starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] };

      const unauthenticated = await request(app).patch(`${interviewUrl(interviewId)}/reschedule`).send(body);
      expect(unauthenticated.status).toBe(401);

      const crossCompany = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send(body);
      expect(crossCompany.status).toBe(404);
    });

    it("omitting interviewer_user_ids (meaning 'leave unchanged') combined with identical time is also treated as a no-op", async () => {
      const { interviewId, newStart, newEnd } = await scheduleAndRescheduleOnce();
      const before = await Interview.findById(interviewId);
      mockSend.mockClear();

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut" });

      expect(res.status).toBe(200);
      const after = await Interview.findById(interviewId);
      expect(after!.updated_at!.getTime()).toBe(before!.updated_at!.getTime());
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
