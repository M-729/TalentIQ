import { Types } from "mongoose";
import { EmailNotification } from "../src/models/EmailNotification.model";

function validEventSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    candidate_name: "Sarah Ahmed",
    company_name: "Company A",
    job_title: "Backend Developer",
    interview_title: "Backend Technical Interview",
    stage_name: "Technical Interview",
    starts_at: new Date("2026-09-21T10:00:00.000Z"),
    ends_at: new Date("2026-09-21T11:00:00.000Z"),
    timezone: "Asia/Beirut",
    interviewer_names: ["Alex Interviewer"],
    meeting_url: null,
    ...overrides,
  };
}

function validAttrs(overrides: Record<string, unknown> = {}) {
  return {
    company_id: new Types.ObjectId(),
    application_id: new Types.ObjectId(),
    candidate_id: new Types.ObjectId(),
    interview_id: new Types.ObjectId(),
    category: "interview_scheduled",
    recipient_email: "sarah@candidate.test",
    subject: "Interview scheduled — Backend Developer",
    event_snapshot: validEventSnapshot(),
    mutation_version_at: new Date(),
    ...overrides,
  };
}

describe("EmailNotification model", () => {
  it("persists a valid notification", async () => {
    const doc = await EmailNotification.create(validAttrs());
    expect(doc._id).toBeDefined();
  });

  it("defaults status to pending", async () => {
    const doc = await EmailNotification.create(validAttrs());
    expect(doc.status).toBe("pending");
  });

  it("defaults attempt_count to 0", async () => {
    const doc = await EmailNotification.create(validAttrs());
    expect(doc.attempt_count).toBe(0);
  });

  it("defaults failure_code, attempted_at, sent_at, triggered_by_user_id to null", async () => {
    const doc = await EmailNotification.create(validAttrs());
    expect(doc.failure_code).toBeNull();
    expect(doc.attempted_at).toBeNull();
    expect(doc.sent_at).toBeNull();
    expect(doc.triggered_by_user_id).toBeNull();
  });

  it.each([
    "company_id",
    "application_id",
    "candidate_id",
    "category",
    "recipient_email",
    "subject",
    "event_snapshot",
    "mutation_version_at",
  ])("requires %s", async (field) => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs[field];
    await expect(EmailNotification.create(attrs)).rejects.toThrow();
  });

  it("allows interview_id to be omitted (nullable, for a future non-interview category)", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.interview_id;
    await expect(EmailNotification.create(attrs)).resolves.toBeTruthy();
  });

  // ===== EVENT SNAPSHOT =====
  describe("event_snapshot", () => {
    it("persists every snapshot field", async () => {
      const doc = await EmailNotification.create(
        validAttrs({ event_snapshot: validEventSnapshot({ meeting_url: "https://meet.google.com/abc-defg-hij" }) })
      );
      expect(doc.event_snapshot.candidate_name).toBe("Sarah Ahmed");
      expect(doc.event_snapshot.job_title).toBe("Backend Developer");
      expect(doc.event_snapshot.interviewer_names).toEqual(["Alex Interviewer"]);
      expect(doc.event_snapshot.meeting_url).toBe("https://meet.google.com/abc-defg-hij");
    });

    it("allows a null meeting_url in the snapshot (no Meet link at that event)", async () => {
      const doc = await EmailNotification.create(validAttrs({ event_snapshot: validEventSnapshot({ meeting_url: null }) }));
      expect(doc.event_snapshot.meeting_url).toBeNull();
    });

    it("allows a null stage_name in the snapshot (e.g. a future non-interview category)", async () => {
      const doc = await EmailNotification.create(validAttrs({ event_snapshot: validEventSnapshot({ stage_name: null }) }));
      expect(doc.event_snapshot.stage_name).toBeNull();
    });

    it.each(["candidate_name", "company_name", "job_title", "interview_title", "starts_at", "ends_at", "timezone"])(
      "requires event_snapshot.%s",
      async (field) => {
        const snapshot = validEventSnapshot() as Record<string, unknown>;
        delete snapshot[field];
        await expect(EmailNotification.create(validAttrs({ event_snapshot: snapshot }))).rejects.toThrow();
      }
    );

    it("never stores rendered HTML/text content anywhere on the document", async () => {
      const doc = await EmailNotification.create(validAttrs());
      const stored = JSON.stringify(doc.toObject());
      expect(stored).not.toMatch(/<!doctype|<html|<body/i);
    });
  });

  it("rejects an invalid category", async () => {
    await expect(EmailNotification.create(validAttrs({ category: "not_a_real_category" }))).rejects.toThrow();
  });

  it("rejects an invalid status", async () => {
    await expect(EmailNotification.create(validAttrs({ status: "delivered" }))).rejects.toThrow();
  });

  it("rejects an invalid failure_code", async () => {
    await expect(EmailNotification.create(validAttrs({ failure_code: "raw_nodemailer_error" }))).rejects.toThrow();
  });

  // ===== IDEMPOTENCY (unique index) =====
  describe("uniqueness on (interview_id, category, mutation_version_at)", () => {
    it("prevents two notifications for the exact same interview + category + mutation", async () => {
      const interviewId = new Types.ObjectId();
      const mutationVersionAt = new Date();
      await EmailNotification.create(validAttrs({ interview_id: interviewId, mutation_version_at: mutationVersionAt }));

      await expect(
        EmailNotification.create(validAttrs({ interview_id: interviewId, mutation_version_at: mutationVersionAt }))
      ).rejects.toThrow();
    });

    it("allows a second notification for the same interview + category with a DIFFERENT mutation version (a real second reschedule)", async () => {
      const interviewId = new Types.ObjectId();
      await EmailNotification.create(
        validAttrs({ interview_id: interviewId, category: "interview_rescheduled", mutation_version_at: new Date("2026-01-01T00:00:00Z") })
      );

      await expect(
        EmailNotification.create(
          validAttrs({ interview_id: interviewId, category: "interview_rescheduled", mutation_version_at: new Date("2026-01-02T00:00:00Z") })
        )
      ).resolves.toBeTruthy();
    });

    it("allows different categories for the same interview + mutation version", async () => {
      const interviewId = new Types.ObjectId();
      const mutationVersionAt = new Date();
      await EmailNotification.create(validAttrs({ interview_id: interviewId, category: "interview_scheduled", mutation_version_at: mutationVersionAt }));

      await expect(
        EmailNotification.create(validAttrs({ interview_id: interviewId, category: "interview_cancelled", mutation_version_at: mutationVersionAt }))
      ).resolves.toBeTruthy();
    });

    it("has a unique index on { interview_id, category, mutation_version_at }", () => {
      const indexes = EmailNotification.schema.indexes();
      const uniqueIndex = indexes.find(
        ([spec, options]) => spec.interview_id === 1 && spec.category === 1 && spec.mutation_version_at === 1 && options.unique
      );
      expect(uniqueIndex).toBeDefined();
    });
  });
});
