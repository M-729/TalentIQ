// The one place a resource DTO's URL-facing identifier is chosen, for
// every backend DTO shaped `{ id, public_id? }` (Application, Interview,
// ApplicationAssessment, Offer, HiringStep, ...). Every such resource has
// had public_id backfilled and auto-assigned on creation since the Phase 2
// public-id cutover, so this never falls back to the internal Mongo `id`
// — a missing public_id is a backend defect, and constructing a Mongo
// ObjectId URL from `id` would silently resurface a raw database
// identifier and immediately 400 against the now public-id-only backend
// anyway. Job/PublicJob use their own jobUrlId (see lib/jobUrlId.ts) since
// those two are raw `_id`-keyed responses rather than an explicit
// `id`-keyed DTO.
export function resourceUrlId(resource: { id: string; public_id?: string }): string {
  if (!resource.public_id) {
    throw new Error(`resourceUrlId: missing public_id for resource id ${resource.id}`);
  }
  return resource.public_id;
}
