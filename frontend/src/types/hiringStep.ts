// Mirrors backend HiringStep.model.ts / hiringStep.serializer.ts exactly.
// Stage TYPE is a behavioral category (what workflow tools may apply to
// this stage later), never a specific name — "Technical Exam" and "Coding
// Challenge" are both freely HR-chosen `name` values that might both use
// type "assessment". Keep in sync if the backend model changes.
export const HIRING_STEP_TYPES = ["review", "interview", "assessment", "other"] as const;
export type HiringStepType = (typeof HIRING_STEP_TYPES)[number];

export interface HiringStep {
  id: string;
  // Opaque, URL-safe identifier — kept in sync with every other migrated
  // resource; HiringStep has no dedicated detail route/link today (always
  // managed inline via the Pipeline Setup panel), so nothing currently
  // reads this.
  public_id?: string;
  name: string;
  type: HiringStepType;
  description: string | null;
  position: number;
}

// Writable fields only — position/job_id/company_id are all backend-derived
// (append-to-end on create, dedicated reorder endpoint for position) and
// deliberately absent here, matching backend hiringStep.validation.ts.
export interface CreateHiringStepInput {
  name: string;
  type: HiringStepType;
  description?: string;
}

export type UpdateHiringStepInput = Partial<CreateHiringStepInput>;
