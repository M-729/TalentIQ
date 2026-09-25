/**
 * Generic backfill primitive shared by every per-resource backfill script
 * (backfillJobPublicIds.ts, backfillApplicationPublicIds.ts, etc.) — one
 * shared implementation of the exact retry/idempotency contract each of
 * them needs, instead of copy-pasting it per resource. See
 * backfillJobPublicIds.ts (the reference implementation this was factored
 * out of) for the full rationale.
 */
import type { FilterQuery, Model } from "mongoose";
import { generatePublicId } from "../../src/utils/publicId";
import { isDuplicateKeyError } from "../../src/middleware/error.middleware";

const MAX_COLLISION_RETRIES = 3;

export interface BackfillPublicIdResult {
  inspected: number;
  updated: number;
  skipped: number;
}

interface HasPublicId {
  public_id?: string | null;
}

async function assignPublicId<T extends HasPublicId>(model: Model<T>, docId: unknown, prefix: string): Promise<boolean> {
  const filter = { _id: docId, public_id: { $exists: false } } as FilterQuery<T>;

  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    try {
      // The `public_id: { $exists: false }` guard (not just `_id: docId`)
      // is what makes this safe under a concurrent second run of the same
      // script: this update only ever applies if the document still lacks
      // a public_id at write time.
      const result = await model.updateOne(filter, { $set: { public_id: generatePublicId(prefix) } });
      return result.modifiedCount === 1;
    } catch (err) {
      if (!isDuplicateKeyError(err) || attempt === MAX_COLLISION_RETRIES) {
        throw err;
      }
    }
  }
  return false;
}

/**
 * Assigns public_id to every document in `model` that doesn't already have
 * one. Idempotent (a document that already has a public_id is never read
 * or touched — re-running after a full run updates nothing) and touches
 * only the public_id field. Does no connecting/disconnecting of its own —
 * callers own the DB connection lifecycle (see each resource's own
 * backfill script for the connect -> call -> log -> disconnect wrapper).
 */
export async function backfillPublicId<T extends HasPublicId>(model: Model<T>, prefix: string): Promise<BackfillPublicIdResult> {
  const inspected = await model.countDocuments({});

  const missingFilter = { public_id: { $exists: false } } as FilterQuery<T>;
  let updated = 0;
  const cursor = model.find(missingFilter).select("_id").cursor();
  for await (const doc of cursor) {
    if (await assignPublicId(model, doc._id, prefix)) {
      updated++;
    }
  }

  return { inspected, updated, skipped: inspected - updated };
}
