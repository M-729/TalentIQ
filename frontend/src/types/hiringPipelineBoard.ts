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

export interface HiringPipelineApplicationCard {
  id: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
  };
  status: ApplicationStatus;
  applied_at: string;
  source?: string;
  screening: ApplicationScreeningSummary;
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
