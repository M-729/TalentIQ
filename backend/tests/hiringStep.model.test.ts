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
});
