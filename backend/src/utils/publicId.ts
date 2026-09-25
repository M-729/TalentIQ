import { randomBytes } from "crypto";

// 12 random bytes (96 bits) hex-encoded — enough entropy that a collision
// across any realistic number of documents is not a practical concern (see
// each model's collision-retry handling at the actual insert site, which
// exists only as a safety net, not because this is expected to fire).
const PUBLIC_ID_BYTE_LENGTH = 12;

/**
 * Generates an opaque, cryptographically random public identifier for a
 * URL-facing resource, e.g. generatePublicId("job") -> "job_a8f13c92e51b4f638dde79bf".
 * Never derived from the resource's Mongo _id — the two are intentionally
 * unrelated so the public id reveals nothing about insertion order/time.
 */
export function generatePublicId(prefix: string): string {
  return `${prefix}_${randomBytes(PUBLIC_ID_BYTE_LENGTH).toString("hex")}`;
}

/** Matches exactly what generatePublicId(prefix) produces — for validation schemas. */
export function publicIdPattern(prefix: string): RegExp {
  return new RegExp(`^${prefix}_[a-f0-9]{${PUBLIC_ID_BYTE_LENGTH * 2}}$`);
}
