// The one place a Job/PublicJob's URL-facing identifier is chosen — every
// Job has had public_id backfilled and auto-assigned on creation since the
// Phase 2 public-id cutover, so this never falls back to the internal
// Mongo `_id` — a missing public_id is a backend defect, and constructing
// a Mongo ObjectId URL from `_id` would silently resurface a raw database
// identifier and immediately 400 against the now public-id-only backend
// anyway. Every Job/PublicJob link in the app should go through this
// instead of reading `_id` directly.
export function jobUrlId(job: { _id: string; public_id?: string }): string {
  if (!job.public_id) {
    throw new Error(`jobUrlId: missing public_id for job _id ${job._id}`);
  }
  return job.public_id;
}
