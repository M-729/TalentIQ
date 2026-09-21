import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { Interview } from "../src/models/Interview.model";
import { GoogleCalendarConnection } from "../src/models/GoogleCalendarConnection.model";
import { encryptToken } from "../src/security/googleTokenEncryption";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Only the provider abstraction is mocked — never real googleapis (see
// googleCalendar.service.test.ts for that boundary's own coverage) and
// never googleCalendarConnection.service (real connections + real
// encrypt/decrypt round-trips are used here, so owner-resolution behavior
// is genuinely exercised end to end).
jest.mock("../src/modules/integrations/googleCalendar/googleCalendarProvider", () => {
  const actual = jest.requireActual("../src/modules/integrations/googleCalendar/googleCalendar.types");
  return {
    googleCalendarProvider: {
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      cancelEvent: jest.fn(),
      getEvent: jest.fn(),
    },
    GoogleCalendarProviderError: actual.GoogleCalendarProviderError,
  };
});

// Scheduling now attempts a real candidate notification email (see
// interviewNotification.service.ts) — mocked here at the same boundary
// interview.api.test.ts uses, so this suite never depends on (or
// accidentally exercises) real SMTP. Every test in this file schedules
// at least one Interview via the helper below, so this is a top-level
// mock, not a per-test spy.
jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

import {
  googleCalendarProvider,
  GoogleCalendarProviderError,
} from "../src/modules/integrations/googleCalendar/googleCalendarProvider";

const mockCreateEvent = googleCalendarProvider.createEvent as jest.Mock;
const mockUpdateEvent = googleCalendarProvider.updateEvent as jest.Mock;
const mockCancelEvent = googleCalendarProvider.cancelEvent as jest.Mock;
const mockGetEvent = googleCalendarProvider.getEvent as jest.Mock;
const { emailService } = jest.requireMock("../src/services/email/email.service") as { emailService: { send: jest.Mock } };

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
function createEventUrl(interviewId: string) {
  return `${interviewUrl(interviewId)}/google-calendar`;
}
function syncUrl(interviewId: string) {
  return `${interviewUrl(interviewId)}/google-calendar/sync`;
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

function successResult(overrides: Partial<{ eventId: string; meetingUrl: string | null; conferencePending: boolean }> = {}) {
  return { eventId: "google-evt-1", meetingUrl: "https://meet.google.com/abc-defg-hij", conferencePending: false, ...overrides };
}

describe("Interview <-> Google Calendar sync API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let bobA: UserDoc;
  let interviewerA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let interviewStage: HiringStepDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "alice@a.test", role: "HR", name: "Alice" });
    bobA = await createUser({ companyId: companyA.id, email: "bob@a.test", role: "HR", name: "Bob" });
    interviewerA = await createUser({ companyId: companyA.id, email: "interviewer@a.test", role: "HR", name: "Interviewer" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    interviewStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 0 });

    emailService.send.mockReset().mockResolvedValue(undefined);
    mockCreateEvent.mockReset();
    mockUpdateEvent.mockReset();
    mockCancelEvent.mockReset();
    mockGetEvent.mockReset();
  });

  async function createApplicationInInterviewStage(overrides: Record<string, unknown> = {}): Promise<ApplicationDoc> {
    const candidate = await Candidate.create({
      full_name: "Sarah Ahmed",
      email: `sarah-${new Types.ObjectId().toString()}@candidate.test`,
    });
    return Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
      current_step_id: interviewStage._id,
      ...overrides,
    });
  }

  async function connectGoogle(
    user: UserDoc,
    companyId: string,
    email = "owner@gmail.com",
    overrides: Record<string, unknown> = {}
  ) {
    return GoogleCalendarConnection.create({
      user_id: user.id,
      company_id: companyId,
      google_account_email: email,
      encrypted_refresh_token: encryptToken(`refresh-token-for-${user.id}`),
      granted_scopes: ["https://www.googleapis.com/auth/calendar.events"],
      // A normal, fully-healthy connection fixture — tests exercising the
      // Part 10 "permission missing" hardening pass an explicit override.
      calendar_permission_granted: true,
      connected_at: new Date(),
      ...overrides,
    });
  }

  async function scheduleInterview(interviewerIds: string[] = [interviewerA.id]) {
    const application = await createApplicationInInterviewStage();
    const res = await request(app)
      .post(scheduleUrl(application.id))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send(validBody({ interviewer_user_ids: interviewerIds }));
    return { application, interviewId: res.body.interview.id as string };
  }

  // ===== CREATE EVENT: AUTH / TENANCY =====
  describe("create event: auth and tenancy", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const { interviewId } = await scheduleInterview();
      const res = await request(app).post(createEventUrl(interviewId)).send({});
      expect(res.status).toBe(401);
    });

    it("returns 404 for a cross-company Interview", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrB, companyB.id);
      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({});
      expect(res.status).toBe(404);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it("rejects an unexpected field in the request body", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      const res = await request(app)
        .post(createEventUrl(interviewId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ attendees: ["attacker@evil.test"] });
      expect(res.status).toBe(400);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });
  });

  // ===== CREATE EVENT: BUSINESS GATES =====
  describe("create event: business rules", () => {
    it("requires an active Google connection for the caller", async () => {
      const { interviewId } = await scheduleInterview();
      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it("blocks event creation when the connection is missing the required Calendar permission, without calling the provider", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id, "owner@gmail.com", { calendar_permission_granted: false });

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
      expect(mockCreateEvent).not.toHaveBeenCalled();

      const stored = await Interview.findById(interviewId);
      expect(stored!.calendar_event_id).toBeNull();
    });

    it("creates the event for a connected HR user on a scheduled Interview", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(201);
      expect(res.body.interview.calendar.provider).toBe("google");
      expect(res.body.interview.calendar.meeting_url).toBe("https://meet.google.com/abc-defg-hij");
      expect(res.body.interview.calendar.sync_status).toBe("synced");
    });

    it("passes the Interview's title/start/end/timezone to the provider", async () => {
      const application = await createApplicationInInterviewStage();
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(
          validBody({
            title: "Custom Interview Title",
            interviewer_user_ids: [interviewerA.id],
            starts_at: hoursFromNow(5),
            ends_at: hoursFromNow(6),
            timezone: "Europe/Berlin",
          })
        );
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());

      await request(app)
        .post(createEventUrl(scheduleRes.body.interview.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      const input = mockCreateEvent.mock.calls[0]![1];
      expect(input.summary).toBe("Custom Interview Title");
      expect(input.timezone).toBe("Europe/Berlin");
      expect(new Date(input.startsAt).toISOString()).toBe(scheduleRes.body.interview.starts_at);
      expect(new Date(input.endsAt).toISOString()).toBe(scheduleRes.body.interview.ends_at);
    });

    it("never leaks AI/screening/internal detail in the event description", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());

      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const input = mockCreateEvent.mock.calls[0]![1];
      expect(input.description).toMatch(/^TalentIQ interview for:/);
      expect(input.description).not.toMatch(/score|screening|gap|note/i);
    });

    it("includes the candidate and all interviewers as attendees, deduplicated case-insensitively", async () => {
      const secondInterviewer = await createUser({ companyId: companyA.id, email: "SECOND@a.test", role: "HR" });
      const application = await createApplicationInInterviewStage();
      const candidate = await Candidate.findById(application.candidate_id);
      const scheduleRes = await request(app)
        .post(scheduleUrl(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ interviewer_user_ids: [interviewerA.id, secondInterviewer.id] }));
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());

      await request(app)
        .post(createEventUrl(scheduleRes.body.interview.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      const input = mockCreateEvent.mock.calls[0]![1];
      expect(input.attendeeEmails).toEqual(
        expect.arrayContaining([candidate!.email.toLowerCase(), "interviewer@a.test", "second@a.test"])
      );
      expect(input.attendeeEmails).toHaveLength(3);
    });

    it("ignores/rejects arbitrary attendee emails sent in the request", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());

      const res = await request(app)
        .post(createEventUrl(interviewId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ attendee_emails: ["injected@evil.test"] });
      expect(res.status).toBe(400);
    });

    it("generates a fresh conferenceRequestId per create call", async () => {
      const { interviewId: id1 } = await scheduleInterview();
      const { interviewId: id2 } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult({ eventId: "evt-a" }));
      await request(app).post(createEventUrl(id1)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      mockCreateEvent.mockResolvedValue(successResult({ eventId: "evt-b" }));
      await request(app).post(createEventUrl(id2)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const requestId1 = mockCreateEvent.mock.calls[0]![1].conferenceRequestId;
      const requestId2 = mockCreateEvent.mock.calls[1]![1].conferenceRequestId;
      expect(requestId1).toBeTruthy();
      expect(requestId2).toBeTruthy();
      expect(requestId1).not.toBe(requestId2);
    });

    it("persists the returned event id and meeting URL, and stamps calendar_owner_user_id to the caller", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult({ eventId: "google-evt-77" }));

      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const stored = await Interview.findById(interviewId);
      expect(stored!.calendar_event_id).toBe("google-evt-77");
      expect(stored!.calendar_owner_user_id!.toString()).toBe(hrA.id);
      expect(stored!.calendar_provider).toBe("google");
    });

    it("never trusts provider-shaped fields sent in the request body", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      const res = await request(app)
        .post(createEventUrl(interviewId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ calendar_event_id: "fake-evt", meeting_url: "https://meet.google.com/fake" });
      expect(res.status).toBe(400);
    });

    it("does not create a second event for an Interview that already has one", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });

    it("returns a safe error (never a raw Google error) when the provider is unavailable", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockRejectedValue(new GoogleCalendarProviderError("provider_unavailable", "raw upstream detail should never leak"));

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(503);
      expect(JSON.stringify(res.body)).not.toMatch(/raw upstream detail/);

      const stored = await Interview.findById(interviewId);
      expect(stored!.calendar_sync_status).toBe("failed");
      expect(stored!.calendar_sync_error_code).toBe("provider_unavailable");
    });

    it("cannot create an event for a cancelled Interview", async () => {
      const { interviewId } = await scheduleInterview();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      await connectGoogle(hrA, companyA.id);

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it("cannot create a NEW event once the Job is soft-deleted", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(404);
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });
  });

  // ===== MEET PENDING =====
  describe("Meet conference pending", () => {
    it("stores the event id with a null meeting URL and pending status when the conference is pending", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue({ eventId: "evt-pending", meetingUrl: null, conferencePending: true });

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(201);
      expect(res.body.interview.calendar.meeting_url).toBeNull();
      expect(res.body.interview.calendar.sync_status).toBe("pending");

      const stored = await Interview.findById(interviewId);
      expect(stored!.calendar_event_id).toBe("evt-pending");
    });

    it("retrieves the Meet URL on a later sync/refresh without creating a duplicate event", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue({ eventId: "evt-pending", meetingUrl: null, conferencePending: true });
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockGetEvent.mockResolvedValue({ eventId: "evt-pending", meetingUrl: "https://meet.google.com/now-ready", conferencePending: false });
      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(res.status).toBe(200);
      expect(res.body.interview.calendar.meeting_url).toBe("https://meet.google.com/now-ready");
      expect(res.body.interview.calendar.sync_status).toBe("synced");
      expect(mockGetEvent).toHaveBeenCalledWith(expect.any(String), "evt-pending");
      expect(mockCreateEvent).toHaveBeenCalledTimes(1);
    });
  });

  // ===== RESCHEDULE SYNC =====
  describe("reschedule sync", () => {
    it("keeps current behavior when there is no linked Google event", async () => {
      const { interviewId } = await scheduleInterview();
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Europe/Berlin" });
      expect(res.status).toBe(200);
      expect(res.body.interview.calendar).toBeNull();
      expect(mockUpdateEvent).not.toHaveBeenCalled();
    });

    it("6. an identical reschedule retry causes no second Google Calendar sync call", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockUpdateEvent.mockResolvedValue(successResult());
      const newStart = hoursFromNow(48);
      const newEnd = hoursFromNow(49);
      const body = { starts_at: newStart, ends_at: newEnd, timezone: "Asia/Beirut", interviewer_user_ids: [interviewerA.id] };

      const first = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(body);
      expect(first.status).toBe(200);
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);

      const second = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(body);
      expect(second.status).toBe(200);
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    });

    it("patches the linked provider event with the new time/timezone on reschedule", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockUpdateEvent.mockResolvedValue(successResult());
      const newStart = hoursFromNow(48);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: hoursFromNow(49), timezone: "Europe/Berlin" });

      expect(res.status).toBe(200);
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
      const [, eventId, input] = mockUpdateEvent.mock.calls[0]!;
      expect(eventId).toBe("google-evt-1");
      expect(new Date(input.startsAt).toISOString()).toBe(new Date(newStart).toISOString());
      expect(input.timezone).toBe("Europe/Berlin");
      expect(res.body.interview.calendar.sync_status).toBe("synced");
      expect(res.body.interview.calendar.last_synced_at).toBeTruthy();
    });

    it("synchronizes changed interviewers as attendees, keeping the candidate attached", async () => {
      const { interviewId } = await scheduleInterview();
      const secondInterviewer = await createUser({ companyId: companyA.id, email: "newinterviewer@a.test", role: "HR" });
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockUpdateEvent.mockResolvedValue(successResult());
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut", interviewer_user_ids: [secondInterviewer.id] });

      const input = mockUpdateEvent.mock.calls[0]![2];
      expect(input.attendeeEmails).toEqual(expect.arrayContaining(["newinterviewer@a.test"]));
      expect(input.attendeeEmails).not.toEqual(expect.arrayContaining(["interviewer@a.test"]));
    });

    it("keeps the local reschedule committed even when the provider sync fails", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockUpdateEvent.mockRejectedValue(new GoogleCalendarProviderError("provider_unavailable", "boom"));
      const newStart = hoursFromNow(48);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: newStart, ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      expect(res.status).toBe(200);
      expect(new Date(res.body.interview.starts_at).toISOString()).toBe(new Date(newStart).toISOString());
      expect(res.body.interview.calendar.sync_status).toBe("failed");

      const stored = await Interview.findById(interviewId);
      expect(stored!.starts_at.toISOString()).toBe(new Date(newStart).toISOString());
      expect(stored!.calendar_sync_error_code).toBe("provider_unavailable");
    });

    it("allows retrying a failed reschedule sync via the sync endpoint", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockUpdateEvent.mockRejectedValueOnce(new GoogleCalendarProviderError("provider_unavailable", "boom"));
      await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      mockUpdateEvent.mockResolvedValueOnce(successResult());
      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.interview.calendar.sync_status).toBe("synced");
    });

    it("uses the ORIGINAL calendar owner's connection, even when a different HR/Admin performs the reschedule", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id, "alice@gmail.com");
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      // Bob also has his own Google connection — a DIFFERENT one.
      await connectGoogle(bobA, companyA.id, "bob@gmail.com");

      mockUpdateEvent.mockResolvedValue(successResult());
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      expect(res.status).toBe(200);
      expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
      const refreshTokenUsed = mockUpdateEvent.mock.calls[0]![0];
      expect(refreshTokenUsed).toBe(`refresh-token-for-${hrA.id}`);
      expect(refreshTokenUsed).not.toBe(`refresh-token-for-${bobA.id}`);

      const stored = await Interview.findById(interviewId);
      expect(stored!.calendar_owner_user_id!.toString()).toBe(hrA.id);
    });

    it("produces a safe, retryable failed state when the calendar owner has disconnected", async () => {
      const { interviewId } = await scheduleInterview();
      const connection = await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      await GoogleCalendarConnection.updateOne({ _id: connection._id }, { $set: { revoked_at: new Date() } });

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      // Local reschedule still succeeds — the disconnected owner only affects sync.
      expect(res.status).toBe(200);
      expect(res.body.interview.calendar.sync_status).toBe("failed");
      expect(mockUpdateEvent).not.toHaveBeenCalled();
    });

    it("produces a safe, retryable failed state when the owner's connection is missing the required Calendar permission", async () => {
      const { interviewId } = await scheduleInterview();
      const connection = await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      await GoogleCalendarConnection.updateOne({ _id: connection._id }, { $set: { calendar_permission_granted: false } });

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/reschedule`)
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ starts_at: hoursFromNow(48), ends_at: hoursFromNow(49), timezone: "Asia/Beirut" });

      expect(res.status).toBe(200);
      expect(res.body.interview.calendar.sync_status).toBe("failed");
      expect(mockUpdateEvent).not.toHaveBeenCalled();
    });
  });

  // ===== CANCEL SYNC =====
  describe("cancel sync", () => {
    it("keeps current behavior when there is no linked Google event", async () => {
      const { interviewId } = await scheduleInterview();
      const res = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(mockCancelEvent).not.toHaveBeenCalled();
    });

    it("cancels the provider event using sendUpdates semantics on local cancellation", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockCancelEvent.mockResolvedValue(undefined);
      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ reason: "Candidate withdrew" });

      expect(res.status).toBe(200);
      expect(res.body.interview.status).toBe("cancelled");
      expect(mockCancelEvent).toHaveBeenCalledWith(expect.any(String), "google-evt-1");
      expect(res.body.interview.calendar.sync_status).toBe("synced");
    });

    it("keeps the local cancellation even when provider cancellation fails, and allows retry", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockCancelEvent.mockRejectedValueOnce(new GoogleCalendarProviderError("provider_unavailable", "boom"));
      const cancelRes = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.interview.status).toBe("cancelled");
      expect(cancelRes.body.interview.calendar.sync_status).toBe("failed");

      mockCancelEvent.mockResolvedValueOnce(undefined);
      const retryRes = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.interview.calendar.sync_status).toBe("synced");
    });

    it("remains possible after the Job has been soft-deleted", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });
      mockCancelEvent.mockResolvedValue(undefined);

      const res = await request(app)
        .patch(`${interviewUrl(interviewId)}/cancel`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ reason: "Job closed administratively" });
      expect(res.status).toBe(200);
      expect(mockCancelEvent).toHaveBeenCalledTimes(1);
    });

    it("produces a safe failed state (not a crash) when the calendar owner is disconnected", async () => {
      const { interviewId } = await scheduleInterview();
      const connection = await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      await GoogleCalendarConnection.updateOne({ _id: connection._id }, { $set: { revoked_at: new Date() } });

      const res = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(bobA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.interview.status).toBe("cancelled");
      expect(res.body.interview.calendar.sync_status).toBe("failed");
      expect(mockCancelEvent).not.toHaveBeenCalled();
    });

    it("produces a safe failed state (not a crash) when the owner's connection is missing the required Calendar permission", async () => {
      const { interviewId } = await scheduleInterview();
      const connection = await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      await GoogleCalendarConnection.updateOne({ _id: connection._id }, { $set: { calendar_permission_granted: false } });

      const res = await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(bobA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.interview.status).toBe("cancelled");
      expect(res.body.interview.calendar.sync_status).toBe("failed");
      expect(mockCancelEvent).not.toHaveBeenCalled();
    });
  });

  // ===== RETRY / SYNC ENDPOINT =====
  describe("sync/retry endpoint", () => {
    it("returns 404 for a cross-company Interview", async () => {
      const { interviewId } = await scheduleInterview();
      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({});
      expect(res.status).toBe(404);
    });

    it("returns a safe conflict when the Interview has no Google integration at all", async () => {
      const { interviewId } = await scheduleInterview();
      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
    });

    it("blocks retry when the owner's connection is missing the required Calendar permission, without calling the provider", async () => {
      const { interviewId } = await scheduleInterview();
      const connection = await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      await GoogleCalendarConnection.updateOne({ _id: connection._id }, { $set: { calendar_permission_granted: false } });

      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(409);
      expect(mockGetEvent).not.toHaveBeenCalled();
      expect(mockUpdateEvent).not.toHaveBeenCalled();

      const stored = await Interview.findById(interviewId);
      expect(stored!.calendar_sync_status).toBe("failed");
    });

    it("retries a failed create as an initial create (idempotent, no duplicate)", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockRejectedValueOnce(new GoogleCalendarProviderError("provider_unavailable", "boom"));
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockCreateEvent.mockResolvedValueOnce(successResult());
      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.interview.calendar.sync_status).toBe("synced");
      expect(mockCreateEvent).toHaveBeenCalledTimes(2);
    });

    it("re-syncs a cancelled Interview whose provider event still exists", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      mockCancelEvent.mockRejectedValueOnce(new GoogleCalendarProviderError("provider_unavailable", "boom"));
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockCancelEvent.mockResolvedValueOnce(undefined);
      const res = await request(app).post(syncUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.interview.calendar.sync_status).toBe("synced");
    });
  });

  // ===== SECURITY =====
  describe("security", () => {
    it("never returns the encrypted refresh token or provider tokens in any Interview response", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(JSON.stringify(res.body)).not.toMatch(/ciphertext|encrypted_refresh_token|auth_tag|calendar_owner_user_id/i);
    });

    it("scopes the connection to the exact User + company (does not leak across companies)", async () => {
      await connectGoogle(hrA, companyA.id);
      const found = await GoogleCalendarConnection.findOne({ user_id: hrB.id });
      expect(found).toBeNull();
    });

    it("never exposes a raw Google error message to the client", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockRejectedValue(new Error("raw googleapis internal stack trace, should never appear"));

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(JSON.stringify(res.body)).not.toMatch(/raw googleapis internal stack trace/);
    });
  });

  // ===== PRODUCT RULES =====
  describe("product rules", () => {
    it("moving an Application into an interview stage does not touch calendar sync", async () => {
      const application = await createApplicationInInterviewStage();
      await request(app)
        .patch(`/api/v1/applications/${application.id}/hiring-step`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ step_id: interviewStage.id });
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });

    it("never constructs a fake meet.google.com URL locally", async () => {
      const { interviewId } = await scheduleInterview();
      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue({ eventId: "evt-1", meetingUrl: null, conferencePending: true });

      const res = await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.body.interview.calendar.meeting_url).toBeNull();
    });

    it("does not send a duplicate Nodemailer email for calendar events (only the schedule notification email is sent)", async () => {
      const { interviewId } = await scheduleInterview();
      // Scheduling itself legitimately sends exactly one candidate
      // notification email (see interviewNotification.service.ts) —
      // this test's actual point is that the SEPARATE "Add to Google
      // Calendar" action does not trigger a second one on top of it (see
      // this ticket's Part 12: Google Calendar/Meet creation is never a
      // reason to send a second TalentIQ email).
      expect(emailService.send).toHaveBeenCalledTimes(1);

      await connectGoogle(hrA, companyA.id);
      mockCreateEvent.mockResolvedValue(successResult());
      await request(app).post(createEventUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });
  });
});
