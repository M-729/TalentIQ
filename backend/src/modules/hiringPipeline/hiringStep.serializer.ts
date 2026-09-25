import type { HiringStepDoc, HiringStepType } from "../../models/HiringStep.model";

export interface HiringStepDTO {
  id: string;
  // Opaque, URL-facing identifier — absent only for a HiringStep created
  // before this field existed and not yet covered by the backfill script.
  public_id?: string;
  name: string;
  type: HiringStepType;
  // Always present (never an omitted key) — `null` when not set, so
  // consumers get one predictable shape rather than an optional key.
  description: string | null;
  position: number;
}

/**
 * Explicit DTO — never a raw Mongoose document. job_id, __v, timestamps,
 * and any other internal field are excluded by construction, not by
 * remembering to strip them.
 */
export function serializeHiringStep(step: HiringStepDoc): HiringStepDTO {
  return {
    id: step.id,
    public_id: step.public_id ?? undefined,
    name: step.name,
    type: step.type,
    description: step.description ?? null,
    position: step.position,
  };
}

export function serializeHiringSteps(steps: HiringStepDoc[]): HiringStepDTO[] {
  return steps.map(serializeHiringStep);
}
