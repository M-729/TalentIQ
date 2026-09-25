import { Types } from "mongoose";
import { backfillEmailNotificationPublicIds } from "../scripts/backfillEmailNotificationPublicIds";
import { EmailNotification } from "../src/models/EmailNotification.model";

async function insertLegacyNotification(overrides: Record<string, unknown> = {}) {
  // Bypasses EmailNotification.model.ts's pre("validate") hook —
  // simulates a notification created before public_id existed.
  await EmailNotification.collection.insertOne({
    company_id: new Types.ObjectId(),
    application_id: new Types.ObjectId(),
    candidate_id: new Types.ObjectId(),
    interview_id: new Types.ObjectId(),
    category: "interview_scheduled",
    recipient_email: "sarah@candidate.test",
    subject: "Interview scheduled — Backend Developer",
    event_snapshot: {
      candidate_name: "Sarah Ahmed",
      company_name: "Company A",
      job_title: "Backend Developer",
      interview_title: "Backend Technical Interview",
      stage_name: "Technical Interview",
      starts_at: new Date(),
      ends_at: new Date(),
      timezone: "Asia/Beirut",
      interviewer_names: ["Alex Interviewer"],
      meeting_url: null,
    },
    mutation_version_at: new Date(),
    status: "pending",
    attempt_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

describe("backfillEmailNotificationPublicIds", () => {
  it("assigns a public_id to every notification missing one", async () => {
    await insertLegacyNotification({ interview_id: new Types.ObjectId() });
    await insertLegacyNotification({ interview_id: new Types.ObjectId() });

    const result = await backfillEmailNotificationPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await EmailNotification.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^notif_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists, and is idempotent on rerun", async () => {
    const alreadyMigrated = await EmailNotification.create({
      company_id: new Types.ObjectId(),
      application_id: new Types.ObjectId(),
      candidate_id: new Types.ObjectId(),
      interview_id: new Types.ObjectId(),
      category: "interview_scheduled",
      recipient_email: "sarah@candidate.test",
      subject: "Interview scheduled — Backend Developer",
      event_snapshot: {
        candidate_name: "Sarah Ahmed",
        company_name: "Company A",
        job_title: "Backend Developer",
        interview_title: "Backend Technical Interview",
        stage_name: "Technical Interview",
        starts_at: new Date(),
        ends_at: new Date(),
        timezone: "Asia/Beirut",
        interviewer_names: ["Alex Interviewer"],
        meeting_url: null,
      },
      mutation_version_at: new Date(),
    });
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyNotification({ interview_id: new Types.ObjectId() });

    const first = await backfillEmailNotificationPublicIds();
    expect(first).toEqual({ inspected: 2, updated: 1, skipped: 1 });

    const reread = await EmailNotification.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);

    const second = await backfillEmailNotificationPublicIds();
    expect(second).toEqual({ inspected: 2, updated: 0, skipped: 2 });
  });
});
