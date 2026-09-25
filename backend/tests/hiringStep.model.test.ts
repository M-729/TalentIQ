import { Types } from "mongoose";
import { HiringStep } from "../src/models/HiringStep.model";

describe("HiringStep model", () => {
  it("persists a valid hiring step", async () => {
    const jobId = new Types.ObjectId();

    const step = await HiringStep.create({ job_id: jobId, name: "Application Review", type: "review", position: 0 });

    expect(step._id).toBeDefined();
    expect(step.job_id.toString()).toBe(jobId.toString());
    expect(step.name).toBe("Application Review");
    expect(step.type).toBe("review");
    expect(step.position).toBe(0);
  });

  it("requires job_id", async () => {
    await expect(HiringStep.create({ name: "Review", type: "review", position: 0 })).rejects.toThrow();
  });

  it("requires name", async () => {
    await expect(HiringStep.create({ job_id: new Types.ObjectId(), type: "review", position: 0 })).rejects.toThrow();
  });

  it("enforces the type enum", async () => {
    await expect(
      HiringStep.create({ job_id: new Types.ObjectId(), name: "Review", type: "not-a-type", position: 0 })
    ).rejects.toThrow();
  });

  it("requires position, as a non-negative integer", async () => {
    const jobId = new Types.ObjectId();
    await expect(HiringStep.create({ job_id: jobId, name: "Review", type: "review" })).rejects.toThrow();
    await expect(HiringStep.create({ job_id: jobId, name: "Review", type: "review", position: -1 })).rejects.toThrow();
    await expect(
      HiringStep.create({ job_id: jobId, name: "Review", type: "review", position: 1.5 })
    ).rejects.toThrow();
  });

  it("sets created_at and updated_at timestamps", async () => {
    const step = await HiringStep.create({
      job_id: new Types.ObjectId(),
      name: "Review",
      type: "review",
      position: 0,
    });

    expect(step.created_at).toBeInstanceOf(Date);
    expect(step.updated_at).toBeInstanceOf(Date);
  });

  it("has a { job_id: 1, position: 1 } index for ordered reads", () => {
    const indexes = HiringStep.schema.indexes();
    const hasOrderingIndex = indexes.some(([spec]) => spec.job_id === 1 && spec.position === 1);
    expect(hasOrderingIndex).toBe(true);
  });

  it("has a case-insensitive unique { job_id, name } index", () => {
    const indexes = HiringStep.schema.indexes();
    const nameIndex = indexes.find(([spec]) => spec.job_id === 1 && spec.name === 1);
    expect(nameIndex).toBeDefined();
    const [, options] = nameIndex!;
    expect(options.unique).toBe(true);
    expect(options.collation).toEqual({ locale: "en", strength: 2 });
  });

  it("enforces the unique { job_id, name } constraint case-insensitively and trimmed", async () => {
    const jobId = new Types.ObjectId();
    await HiringStep.create({ job_id: jobId, name: "Technical Interview", type: "interview", position: 0 });

    await expect(
      HiringStep.create({ job_id: jobId, name: " technical interview ", type: "interview", position: 1 })
    ).rejects.toThrow();
  });

  it("allows the same stage name on a different Job", async () => {
    await HiringStep.create({ job_id: new Types.ObjectId(), name: "Technical Interview", type: "interview", position: 0 });

    await expect(
      HiringStep.create({ job_id: new Types.ObjectId(), name: "Technical Interview", type: "interview", position: 0 })
    ).resolves.toBeTruthy();
  });

  describe("public_id", () => {
    it("is assigned automatically on creation with the step_ prefix and 24-char hex suffix", async () => {
      const step = await HiringStep.create({ job_id: new Types.ObjectId(), name: "Review", type: "review", position: 0 });
      expect(step.public_id).toMatch(/^step_[a-f0-9]{24}$/);
    });

    it("assigns a different public_id to every new step", async () => {
      const jobId = new Types.ObjectId();
      const steps = await Promise.all([
        HiringStep.create({ job_id: jobId, name: "Review", type: "review", position: 0 }),
        HiringStep.create({ job_id: jobId, name: "Technical Interview", type: "interview", position: 1 }),
      ]);
      expect(new Set(steps.map((s) => s.public_id)).size).toBe(2);
    });

    it("has a unique, sparse index on public_id", () => {
      const indexes = HiringStep.schema.indexes();
      const publicIdIndex = indexes.find(([spec]) => spec.public_id === 1);
      expect(publicIdIndex).toBeDefined();
      expect(publicIdIndex?.[1]).toMatchObject({ unique: true, sparse: true });
    });

    it("leaves public_id untouched when an existing step is re-saved", async () => {
      const step = await HiringStep.create({ job_id: new Types.ObjectId(), name: "Review", type: "review", position: 0 });
      const originalPublicId = step.public_id;

      step.name = "Application Review";
      await step.save();

      expect(step.public_id).toBe(originalPublicId);
    });
  });
});
