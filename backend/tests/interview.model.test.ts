import { Types } from "mongoose";
import { Interview } from "../src/models/Interview.model";

function validAttrs(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe("Interview model", () => {
  it("persists a valid Interview", async () => {
    const doc = await Interview.create(validAttrs());

    expect(doc._id).toBeDefined();
    expect(doc.status).toBe("scheduled");
    expect(doc.title).toBe("Backend Technical Interview");
    expect(doc.timezone).toBe("Asia/Beirut");
    expect(doc.interviewer_user_ids).toHaveLength(1);
  });

  it("requires application_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.application_id;
    await expect(Interview.create(attrs)).rejects.toThrow();
  });

  it("requires job_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.job_id;
    await expect(Interview.create(attrs)).rejects.toThrow();
  });

  it("requires hiring_step_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.hiring_step_id;
    await expect(Interview.create(attrs)).rejects.toThrow();
  });

  it("requires scheduled_by", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.scheduled_by;
    await expect(Interview.create(attrs)).rejects.toThrow();
  });

  it("requires at least one interviewer", async () => {
    await expect(Interview.create(validAttrs({ interviewer_user_ids: [] }))).rejects.toThrow();
  });

  it("stores a typed stage_snapshot, not a generic Mixed blob", () => {
    const namePath = Interview.schema.path("stage_snapshot.name");
    const typePath = Interview.schema.path("stage_snapshot.type");
    expect(namePath?.instance).toBe("String");
    expect(typePath?.instance).toBe("String");

    const snapshotPath = Interview.schema.path("stage_snapshot");
    expect(snapshotPath?.instance).not.toBe("Mixed");
  });

  it("rejects an invalid stage_snapshot.type", async () => {
    await expect(
      Interview.create(validAttrs({ stage_snapshot: { name: "Technical Interview", type: "not-a-type" } }))
    ).rejects.toThrow();
  });

  it("accepts only valid statuses", async () => {
    await expect(Interview.create(validAttrs({ status: "not-a-status" }))).rejects.toThrow();

    const doc = await Interview.create(validAttrs());
    expect(doc.status).toBe("scheduled");
  });

  it("sets created_at and updated_at timestamps", async () => {
    const doc = await Interview.create(validAttrs());
    expect(doc.created_at).toBeInstanceOf(Date);
    expect(doc.updated_at).toBeInstanceOf(Date);
  });

  it("defaults cancellation fields to null and allows them to be set", async () => {
    const doc = await Interview.create(validAttrs());
    expect(doc.cancelled_by).toBeNull();
    expect(doc.cancelled_at).toBeNull();
    expect(doc.cancellation_reason).toBeNull();

    const cancelledBy = new Types.ObjectId();
    doc.status = "cancelled";
    doc.cancelled_by = cancelledBy;
    doc.cancelled_at = new Date();
    doc.cancellation_reason = "Candidate requested another date";
    await doc.save();

    const reread = await Interview.findById(doc.id);
    expect(reread?.cancelled_by?.toString()).toBe(cancelledBy.toString());
    expect(reread?.cancellation_reason).toBe("Candidate requested another date");
  });

  it("has a { application_id: 1, starts_at: -1 } index for the list query", () => {
    const indexes = Interview.schema.indexes();
    const hasIndex = indexes.some(([spec]) => spec.application_id === 1 && spec.starts_at === -1);
    expect(hasIndex).toBe(true);
  });

  it("has a partial unique index on { application_id, hiring_step_id } scoped to status: scheduled", () => {
    const indexes = Interview.schema.indexes();
    const uniqueIndex = indexes.find(
      ([spec, options]) => spec.application_id === 1 && spec.hiring_step_id === 1 && options.unique
    );
    expect(uniqueIndex).toBeDefined();
    const [, options] = uniqueIndex!;
    expect(options.partialFilterExpression).toEqual({ status: "scheduled" });
  });

  it("enforces the partial unique index at the database level", async () => {
    const applicationId = new Types.ObjectId();
    const hiringStepId = new Types.ObjectId();

    await Interview.create(validAttrs({ application_id: applicationId, hiring_step_id: hiringStepId }));

    await expect(
      Interview.create(validAttrs({ application_id: applicationId, hiring_step_id: hiringStepId }))
    ).rejects.toThrow();
  });

  it("allows a new scheduled Interview for the same Application+stage after the previous one is cancelled", async () => {
    const applicationId = new Types.ObjectId();
    const hiringStepId = new Types.ObjectId();

    const first = await Interview.create(validAttrs({ application_id: applicationId, hiring_step_id: hiringStepId }));
    await Interview.updateOne({ _id: first._id }, { $set: { status: "cancelled", cancelled_at: new Date() } });

    await expect(
      Interview.create(validAttrs({ application_id: applicationId, hiring_step_id: hiringStepId }))
    ).resolves.toBeTruthy();
  });

  it("reserves nullable, non-client-facing Google/calendar integration fields", async () => {
    const doc = await Interview.create(validAttrs());
    expect(doc.get("calendar_provider")).toBeNull();
    expect(doc.get("calendar_event_id")).toBeNull();
    expect(doc.get("meeting_url")).toBeNull();
  });
});
