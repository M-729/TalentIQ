import { Types } from "mongoose";
import { backfillInterviewPublicIds } from "../scripts/backfillInterviewPublicIds";
import { Interview } from "../src/models/Interview.model";

function legacyAttrs(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    application_id: new Types.ObjectId(),
    job_id: new Types.ObjectId(),
    hiring_step_id: new Types.ObjectId(),
    stage_snapshot: { name: "Technical Interview", type: "interview" },
    title: "Backend Technical Interview",
    starts_at: new Date(now + 60 * 60 * 1000),
    ends_at: new Date(now + 2 * 60 * 60 * 1000),
    timezone: "Asia/Beirut",
    interviewer_user_ids: [new Types.ObjectId()],
    scheduled_by: new Types.ObjectId(),
    status: "scheduled",
    calendar_sync_status: "not_connected",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

async function insertLegacyInterview(overrides: Record<string, unknown> = {}) {
  // Bypasses Interview.model.ts's pre("validate") hook — simulates an
  // Interview created before public_id existed.
  await Interview.collection.insertOne(legacyAttrs(overrides));
}

describe("backfillInterviewPublicIds", () => {
  it("assigns a public_id to every interview missing one", async () => {
    await insertLegacyInterview({ application_id: new Types.ObjectId() });
    await insertLegacyInterview({ application_id: new Types.ObjectId() });

    const result = await backfillInterviewPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await Interview.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^int_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists", async () => {
    const alreadyMigrated = await Interview.create(legacyAttrs({ application_id: new Types.ObjectId() }));
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyInterview({ application_id: new Types.ObjectId() });

    const result = await backfillInterviewPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 1, skipped: 1 });
    const reread = await Interview.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);
  });

  it("is idempotent: a second run after a full run updates nothing", async () => {
    await insertLegacyInterview();

    const first = await backfillInterviewPublicIds();
    expect(first).toEqual({ inspected: 1, updated: 1, skipped: 0 });

    const second = await backfillInterviewPublicIds();
    expect(second).toEqual({ inspected: 1, updated: 0, skipped: 1 });
  });

  it("touches no field other than public_id", async () => {
    await insertLegacyInterview({ title: "Only Public Id Changes" });

    await backfillInterviewPublicIds();

    const doc = await Interview.findOne({});
    expect(doc?.title).toBe("Only Public Id Changes");
    expect(doc?.status).toBe("scheduled");
  });
});
