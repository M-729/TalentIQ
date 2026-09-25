import { Types } from "mongoose";
import { backfillHiringStepPublicIds } from "../scripts/backfillHiringStepPublicIds";
import { HiringStep } from "../src/models/HiringStep.model";

async function insertLegacyStep(overrides: Record<string, unknown> = {}) {
  // Bypasses HiringStep.model.ts's pre("validate") hook — simulates a
  // step created before public_id existed.
  await HiringStep.collection.insertOne({
    job_id: new Types.ObjectId(),
    name: "Application Review",
    type: "review",
    position: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });
}

describe("backfillHiringStepPublicIds", () => {
  it("assigns a public_id to every step missing one", async () => {
    await insertLegacyStep({ name: "Legacy One" });
    await insertLegacyStep({ name: "Legacy Two" });

    const result = await backfillHiringStepPublicIds();

    expect(result).toEqual({ inspected: 2, updated: 2, skipped: 0 });
    const docs = await HiringStep.find({});
    for (const doc of docs) {
      expect(doc.public_id).toMatch(/^step_[a-f0-9]{24}$/);
    }
  });

  it("never changes a public_id that already exists, and is idempotent on rerun", async () => {
    const alreadyMigrated = await HiringStep.create({
      job_id: new Types.ObjectId(),
      name: "Already Migrated",
      type: "review",
      position: 0,
    });
    const originalPublicId = alreadyMigrated.public_id;
    await insertLegacyStep({ name: "Still Legacy" });

    const first = await backfillHiringStepPublicIds();
    expect(first).toEqual({ inspected: 2, updated: 1, skipped: 1 });

    const reread = await HiringStep.findById(alreadyMigrated.id);
    expect(reread?.public_id).toBe(originalPublicId);

    const second = await backfillHiringStepPublicIds();
    expect(second).toEqual({ inspected: 2, updated: 0, skipped: 2 });
  });

  it("touches no field other than public_id", async () => {
    await insertLegacyStep({ name: "Only Public Id Changes", position: 3 });

    await backfillHiringStepPublicIds();

    const doc = await HiringStep.findOne({});
    expect(doc?.name).toBe("Only Public Id Changes");
    expect(doc?.position).toBe(3);
    expect(doc?.type).toBe("review");
  });
});
