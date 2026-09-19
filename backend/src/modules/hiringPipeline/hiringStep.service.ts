import { Types } from "mongoose";
import { Application } from "../../models/Application.model";
import { HiringStep, type HiringStepDoc } from "../../models/HiringStep.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { BadRequestError, ConflictError, NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany } from "../../security/companyScope";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import type { CreateHiringStepInput, UpdateHiringStepInput } from "./hiringStep.validation";

const DUPLICATE_NAME_MESSAGE = "A hiring stage with this name already exists for this job.";

// Same collation as the model's unique { job_id, name } index (see
// HiringStep.model.ts) — reusing it here means this pre-check and the
// database constraint it backs up always agree on what "duplicate" means.
const CASE_INSENSITIVE_COLLATION = { locale: "en", strength: 2 } as const;

async function assertNoDuplicateName(jobId: string, name: string, excludeStepId?: string): Promise<void> {
  const exists = await HiringStep.exists({
    job_id: jobId,
    name: name.trim(),
    ...(excludeStepId ? { _id: { $ne: excludeStepId } } : {}),
  }).collation(CASE_INSENSITIVE_COLLATION);

  if (exists) {
    throw new ConflictError(DUPLICATE_NAME_MESSAGE);
  }
}

/**
 * Database read only — never modifies anything. Position ascending.
 *
 * Every function in this file gates on NOT_DELETED_JOB_FILTER: a
 * soft-deleted Job's hiring pipeline is unavailable through this module
 * (404), since HR should not keep managing stages for an administratively
 * deleted Job. HiringStep documents themselves are never deleted or
 * otherwise touched by this — only the ability to
 * list/create/update/reorder/delete them is gated on the Job's deletion
 * state.
 */
export async function listHiringSteps(companyId: string, jobId: string): Promise<HiringStepDoc[]> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, { notFoundMessage: "Job not found" });
  return HiringStep.find({ job_id: jobId }).sort({ position: 1 });
}

/**
 * Appends to the end of the Job's pipeline — the client never chooses a
 * position. `count()` is always the correct next position because every
 * mutating operation in this file maintains the contiguous-0..N-1
 * invariant (see HiringStep.model.ts's comment on why no unique index
 * backs this specific value).
 */
export async function createHiringStep(
  companyId: string,
  jobId: string,
  input: CreateHiringStepInput
): Promise<HiringStepDoc> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, { notFoundMessage: "Job not found" });
  await assertNoDuplicateName(jobId, input.name);

  const position = await HiringStep.countDocuments({ job_id: jobId });

  try {
    return await HiringStep.create({
      job_id: jobId,
      name: input.name,
      type: input.type,
      description: input.description,
      position,
    });
  } catch (err) {
    // Race-safety net: two concurrent creates could both pass the
    // pre-check above before either commits. The unique { job_id, name }
    // index (same collation) catches that at the database level.
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(DUPLICATE_NAME_MESSAGE);
    }
    throw err;
  }
}

/**
 * May update name/type/description only — job_id and position are never
 * accepted here (position has its own dedicated reorder operation below;
 * job_id is simply absent from the validation schema, so a stage can
 * never be "moved" to another Job through this endpoint).
 */
export async function updateHiringStep(
  companyId: string,
  jobId: string,
  stepId: string,
  input: UpdateHiringStepInput
): Promise<HiringStepDoc> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, { notFoundMessage: "Job not found" });

  const step = await HiringStep.findOne({ _id: stepId, job_id: jobId });
  if (!step) {
    throw new NotFoundError("Hiring stage not found");
  }

  if (input.name !== undefined) {
    await assertNoDuplicateName(jobId, input.name, stepId);
    step.name = input.name;
  }
  if (input.type !== undefined) {
    step.type = input.type;
  }
  if (input.description !== undefined) {
    step.description = input.description;
  }

  try {
    await step.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(DUPLICATE_NAME_MESSAGE);
    }
    throw err;
  }

  return step;
}

/**
 * The submitted `orderedStepIds` must represent the Job's ENTIRE current
 * pipeline — exact same set, no more, no less, no duplicates. The client
 * never supplies numeric positions; the array's order IS the source of
 * truth, reassigned as a contiguous 0..N-1 range.
 *
 * Concurrency: a single ordered bulkWrite (one round trip, no
 * multi-document transaction). This codebase's test/dev MongoDB instance
 * (mongodb-memory-server, started as a standalone, not a replica set —
 * see tests/setup.ts) doesn't support multi-document transactions, and
 * nothing else in this codebase uses them either. No unique index on
 * { job_id, position } exists to transiently violate (see
 * HiringStep.model.ts), so there is no correctness requirement a
 * transaction would be solving here beyond "don't do N separate round
 * trips" — which bulkWrite already avoids. The realistic race (two
 * concurrent reorders for the same Job) is the same low-stakes,
 * self-correcting edge case documented on the model.
 */
export async function reorderHiringSteps(
  companyId: string,
  jobId: string,
  orderedStepIds: string[]
): Promise<HiringStepDoc[]> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, { notFoundMessage: "Job not found" });

  const existingSteps = await HiringStep.find({ job_id: jobId }).select("_id");
  const existingIds = new Set(existingSteps.map((step) => step.id));

  const submittedIds = new Set(orderedStepIds);
  if (submittedIds.size !== orderedStepIds.length) {
    throw new BadRequestError("The reorder list contains a duplicate hiring stage id.");
  }

  // A mismatched size combined with "every submitted id is a real member
  // of this job's current set" (checked below) together rule out missing
  // ids, extra ids, and ids from another Job in one pass — if any of
  // those were true, the sizes couldn't both match AND every submitted id
  // be a genuine member.
  if (submittedIds.size !== existingIds.size) {
    throw new BadRequestError("The reorder list must include every current hiring stage for this job, and no others.");
  }
  for (const id of submittedIds) {
    if (!existingIds.has(id)) {
      throw new BadRequestError("The reorder list contains a hiring stage that does not belong to this job.");
    }
  }

  if (orderedStepIds.length > 0) {
    // Mongoose's InferSchemaType (combined with this schema's custom-named
    // { createdAt: "created_at", updatedAt: "updated_at" } timestamps
    // option) produces a broad `[x: string]: NativeDate` index signature
    // that makes HiringStep.bulkWrite()'s own generic typing reject a
    // plain `{ $set: { position: number } }` update. Going through the
    // underlying native MongoDB driver collection instead (same
    // collection, same data, just the untyped-by-schema driver API) sends
    // the identical operation without fighting that inference quirk.
    await HiringStep.collection.bulkWrite(
      orderedStepIds.map((stepId, index) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(stepId), job_id: new Types.ObjectId(jobId) },
          update: { $set: { position: index } },
        },
      }))
    );
  }

  return HiringStep.find({ job_id: jobId }).sort({ position: 1 });
}

/**
 * A stage currently referenced by any Application.current_step_id is
 * never deleted — HR must explicitly move those applications first (a
 * future ticket). No candidate is silently moved, no reference is
 * silently nulled, no history is touched; the delete simply doesn't
 * happen, and nothing about the stage or its position changes.
 *
 * On a successful delete, later stages compact down by one position so
 * the pipeline stays contiguous (0..N-1) — see HiringStep.model.ts.
 */
export async function deleteHiringStep(companyId: string, jobId: string, stepId: string): Promise<void> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, { notFoundMessage: "Job not found" });

  const step = await HiringStep.findOne({ _id: stepId, job_id: jobId });
  if (!step) {
    throw new NotFoundError("Hiring stage not found");
  }

  const inUse = await Application.exists({ current_step_id: step._id });
  if (inUse) {
    throw new ConflictError("This hiring stage is currently in use by one or more applications.");
  }

  await HiringStep.deleteOne({ _id: step._id });
  await HiringStep.updateMany({ job_id: jobId, position: { $gt: step.position } }, { $inc: { position: -1 } });
}
