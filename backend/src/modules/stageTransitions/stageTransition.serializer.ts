import type { ApplicationStageTransitionDoc } from "../../models/ApplicationStageTransition.model";

export interface StepRefDTO {
  id: string;
  name: string;
  type: string;
}

export interface MovedByDTO {
  id: string;
  name: string;
}

export interface StageTransitionDTO {
  id: string;
  from_step: StepRefDTO | null;
  to_step: StepRefDTO;
  from_status: string;
  to_status: string;
  moved_by: MovedByDTO;
  note: string | null;
  created_at: string;
}

/**
 * Explicit DTO — never a raw Mongoose document. Deliberately built from
 * the transition's own stored snapshots (from_step_snapshot/
 * to_step_snapshot), never by re-resolving the live HiringStep collection
 * — a renamed or deleted HiringStep must not change what a past
 * transition says happened (see ApplicationStageTransition.model.ts).
 *
 * `moved_by` exposes only { id, name } — a small pre-fetched name map is
 * passed in rather than looking up the User here, so a whole page of
 * history batches its actor lookups into one query instead of one per
 * row (same batching pattern as applicationHr.service.ts's
 * getLatestScreeningSummaries). Never exposes email, password_hash,
 * role, company_id, or any auth field — none of those are read from
 * anywhere near this function.
 */
export function serializeStageTransition(
  doc: ApplicationStageTransitionDoc,
  movedByName: string
): StageTransitionDTO {
  return {
    id: doc.id,
    from_step: doc.from_step_id
      ? {
          id: doc.from_step_id.toString(),
          name: doc.from_step_snapshot!.name,
          type: doc.from_step_snapshot!.type,
        }
      : null,
    to_step: {
      id: doc.to_step_id.toString(),
      name: doc.to_step_snapshot.name,
      type: doc.to_step_snapshot.type,
    },
    from_status: doc.from_status,
    to_status: doc.to_status,
    moved_by: { id: doc.moved_by.toString(), name: movedByName },
    note: doc.note ?? null,
    // Always set by Mongoose (timestamps: { createdAt: "created_at" }) —
    // the schema-inferred type just doesn't capture that as non-optional.
    created_at: doc.created_at!.toISOString(),
  };
}

export function serializeStageTransitions(
  docs: ApplicationStageTransitionDoc[],
  movedByNames: Map<string, string>
): StageTransitionDTO[] {
  return docs.map((doc) => serializeStageTransition(doc, movedByNames.get(doc.moved_by.toString()) ?? "Unknown"));
}
