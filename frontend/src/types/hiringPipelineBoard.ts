import type { ApplicationScreeningSummary, ApplicationStatus } from "@/types/application";
import type { HiringStepType } from "@/types/hiringStep";
import type { JobStatus } from "@/types/job";

// Mirrors backend hiringPipelineBoard.serializer.ts exactly. Reuses
// ApplicationStatus/ApplicationScreeningSummary/HiringStepType/JobStatus
// rather than duplicating incompatible unions — this board is a read
// model over the same Applications/HiringSteps/Jobs those types already
// describe.
export interface HiringPipelineBoardJob {
  id: string;
  title: string;
  status: JobStatus;
}

// Mirrors backend hiringPipelineBoard.serializer.ts's InterviewSummaryDTO
// exactly. "not_scheduled" is a real, distinct state from the card's
// `interview_summary` field itself being `null` — see
// HiringPipelineApplicationCard's doc comment below. `status` is always
// the persisted Interview.status — never inferred from starts_at/ends_at
// having passed.
export const INTERVIEW_SUMMARY_STATUSES = ["not_scheduled", "scheduled", "completed", "cancelled"] as const;
export type InterviewSummaryStatus = (typeof INTERVIEW_SUMMARY_STATUSES)[number];

export interface InterviewSummary {
  status: InterviewSummaryStatus;
  starts_at?: string;
  timezone?: string;
  feedback_submitted_count?: number;
  feedback_total_count?: number;
}

// Mirrors backend hiringPipelineBoard.serializer.ts's AssessmentSummaryDTO
// exactly. "not_configured" is a real, distinct state from the card's
// `assessment_summary` field itself being `null` — same split
// interview_summary/InterviewSummaryStatus already established. `grade`
// is a hand-entered percentage, never derived from `status`.
export const ASSESSMENT_SUMMARY_STATUSES = ["not_configured", "pending", "passed", "failed"] as const;
export type AssessmentSummaryStatus = (typeof ASSESSMENT_SUMMARY_STATUSES)[number];

export interface AssessmentSummary {
  status: AssessmentSummaryStatus;
  grade: number | null;
  email_status: "pending" | "sent" | "failed" | null;
}

export interface HiringPipelineApplicationCard {
  id: string;
  // Opaque, URL-safe identifier — see types/application.ts's
  // ApplicationListRow.public_id.
  public_id?: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
  };
  status: ApplicationStatus;
  applied_at: string;
  source?: string;
  screening: ApplicationScreeningSummary;
  /** `null` whenever the card isn't currently in an interview-type stage (New Applicants, any non-interview stage, needs_attention) — never omitted, so a card component can always destructure it safely. */
  interview_summary: InterviewSummary | null;
  /** `null` whenever the card isn't currently in an assessment-type stage — same rule as interview_summary above. */
  assessment_summary: AssessmentSummary | null;
}

// "New Applicants" (current_step_id: null) is a virtual system column —
// never a HiringStep document — so it has no `id` of its own; only real
// stages appear in `stages` below.
export interface HiringPipelineBoardColumn {
  id: string;
  name: string;
  type: HiringStepType;
  description: string | null;
  position: number;
  count: number;
  applications: HiringPipelineApplicationCard[];
}

// Inconsistent/legacy Application data the backend refused to guess into
// a normal column (see backend hiringPipelineBoard.service.ts) — safe
// enough to surface for HR visibility, but deliberately excludes any
// Move affordance in the UI (see HiringPipelineNeedsAttention.tsx).
export interface HiringPipelineNeedsAttentionApplication extends HiringPipelineApplicationCard {
  current_step_id: string | null;
}

export interface HiringPipelineBoard {
  job: HiringPipelineBoardJob;
  unassigned: {
    count: number;
    applications: HiringPipelineApplicationCard[];
  };
  stages: HiringPipelineBoardColumn[];
  needs_attention: HiringPipelineNeedsAttentionApplication[];
}

// Mirrors backend stageTransition.validation.ts's moveApplicationStageSchema
// exactly — job_id/company_id/status/moved_by/current-step are all
// backend-derived and deliberately absent here.
export interface MoveApplicationHiringStepInput {
  step_id: string;
  note?: string;
}

// Mirrors backend hiringPipelineBoard.validation.ts's
// bulkMoveApplicationsSchema exactly — company_id/status/interviewer/
// assessment data are all backend-derived or simply never accepted.
export interface BulkMoveApplicationsInput {
  application_ids: string[];
  target_hiring_step_id: string;
}

// Mirrors backend hiringPipelineBoard.service.ts's BulkMoveApplicationsResult.
export interface BulkMoveApplicationsResult {
  moved_count: number;
  target_step: { id: string; name: string; type: string };
  applications: { id: string; status: ApplicationStatus; current_step_id: string }[];
}
