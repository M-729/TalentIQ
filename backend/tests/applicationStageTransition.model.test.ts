import { Types } from "mongoose";
import { ApplicationStageTransition } from "../src/models/ApplicationStageTransition.model";

function validAttrs(overrides: Record<string, unknown> = {}) {
  return {
    application_id: new Types.ObjectId(),
    job_id: new Types.ObjectId(),
    from_step_id: null,
    to_step_id: new Types.ObjectId(),
    from_step_snapshot: null,
    to_step_snapshot: { name: "Application Review", type: "review" },
    from_status: "applied",
    to_status: "in_process",
    moved_by: new Types.ObjectId(),
    ...overrides,
  };
}

describe("ApplicationStageTransition model", () => {
  it("persists a valid transition", async () => {
    const doc = await ApplicationStageTransition.create(validAttrs());

    expect(doc._id).toBeDefined();
    expect(doc.from_step_id).toBeNull();
    expect(doc.to_step_snapshot.name).toBe("Application Review");
    expect(doc.from_status).toBe("applied");
    expect(doc.to_status).toBe("in_process");
  });

  it("requires application_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.application_id;
    await expect(ApplicationStageTransition.create(attrs)).rejects.toThrow();
  });

  it("requires job_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.job_id;
    await expect(ApplicationStageTransition.create(attrs)).rejects.toThrow();
  });

  it("requires to_step_id", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.to_step_id;
    await expect(ApplicationStageTransition.create(attrs)).rejects.toThrow();
  });

  it("allows from_step_id to be null", async () => {
    const doc = await ApplicationStageTransition.create(validAttrs({ from_step_id: null, from_step_snapshot: null }));
    expect(doc.from_step_id).toBeNull();
  });

  it("persists from_step_snapshot and to_step_snapshot", async () => {
    const doc = await ApplicationStageTransition.create(
      validAttrs({
        from_step_id: new Types.ObjectId(),
        from_step_snapshot: { name: "Application Review", type: "review" },
        to_step_snapshot: { name: "Technical Interview", type: "interview" },
      })
    );

    expect(doc.from_step_snapshot?.name).toBe("Application Review");
    expect(doc.from_step_snapshot?.type).toBe("review");
    expect(doc.to_step_snapshot.name).toBe("Technical Interview");
    expect(doc.to_step_snapshot.type).toBe("interview");
  });

  it("requires moved_by", async () => {
    const attrs = validAttrs() as Record<string, unknown>;
    delete attrs.moved_by;
    await expect(ApplicationStageTransition.create(attrs)).rejects.toThrow();
  });

  it("allows note to be omitted", async () => {
    const doc = await ApplicationStageTransition.create(validAttrs());
    expect(doc.note).toBeUndefined();
  });

  it("persists a provided note", async () => {
    const doc = await ApplicationStageTransition.create(validAttrs({ note: "Strong technical background." }));
    expect(doc.note).toBe("Strong technical background.");
  });

  it("sets created_at automatically", async () => {
    const doc = await ApplicationStageTransition.create(validAttrs());
    expect(doc.created_at).toBeInstanceOf(Date);
  });

  it("has no updated_at field", async () => {
    const doc = await ApplicationStageTransition.create(validAttrs());
    expect((doc as unknown as Record<string, unknown>).updated_at).toBeUndefined();
  });

  it("has a { application_id: 1, created_at: -1 } index for history reads", () => {
    const indexes = ApplicationStageTransition.schema.indexes();
    const hasIndex = indexes.some(([spec]) => spec.application_id === 1 && spec.created_at === -1);
    expect(hasIndex).toBe(true);
  });

  it("uses typed snapshot subdocuments, not a generic Mixed blob", () => {
    const snapshotPath = ApplicationStageTransition.schema.path("to_step_snapshot");
    expect(snapshotPath?.instance).not.toBe("Mixed");

    const namePath = ApplicationStageTransition.schema.path("to_step_snapshot.name");
    const typePath = ApplicationStageTransition.schema.path("to_step_snapshot.type");
    expect(namePath?.instance).toBe("String");
    expect(typePath?.instance).toBe("String");
  });
});
