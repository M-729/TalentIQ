import type { ApplicationDoc } from "../../models/Application.model";
import type { CandidateDoc } from "../../models/Candidate.model";
import type { HiringStepDoc } from "../../models/HiringStep.model";
import type { JobDoc } from "../../models/Job.model";
import {
  serializeScreeningSummary,
  type ScreeningSummary,
  type ScreeningSummaryDTO,
} from "../applications/applicationHr.serializer";

export interface BoardJobDTO {
  id: string;
  title: string;
  status: string;
}

export interface BoardCandidateDTO {
  id: string;
  full_name: string;
  email: string;
}

// "not_scheduled" is a real, distinct state from `null` — it means "this
// card IS in an interview-type stage, and simply has no Interview record
// yet" (see Part 20's "Interview · Not scheduled" copy). `interview_summary`
// itself is `null` whenever the question doesn't even apply (any
// non-interview-type stage, New Applicants, or needs_attention) — see
// getHiringPipelineBoard/getInterviewSummaries in hiringPipelineBoard
// .service.ts. `Interview.status` is always authoritative here — never
// inferred from `ends_at`/`starts_at` having passed.
export const INTERVIEW_SUMMARY_STATUSES = ["not_scheduled", "scheduled", "completed", "cancelled"] as const;
export type InterviewSummaryStatus = (typeof INTERVIEW_SUMMARY_STATUSES)[number];

export interface InterviewSummaryDTO {
  status: InterviewSummaryStatus;
  starts_at?: string;
  timezone?: string;
  feedback_submitted_count?: number;
  feedback_total_count?: number;
}

// "not_configured" is a real, distinct state from `assessment_summary`
// itself being `null` — same "in the right kind of stage but nothing
// recorded yet" vs. "the question doesn't even apply" split
// interview_summary already established. Deliberately reuses
// ApplicationAssessment's own three-value status for pending/passed/failed
// rather than re-declaring it, so this can never drift from the model.
export const ASSESSMENT_SUMMARY_STATUSES = ["not_configured", "pending", "passed", "failed"] as const;
export type AssessmentSummaryStatus = (typeof ASSESSMENT_SUMMARY_STATUSES)[number];

export interface AssessmentSummaryDTO {
  status: AssessmentSummaryStatus;
  /** A hand-entered percentage, never derived from status — see ApplicationAssessment.model.ts. */
  grade: number | null;
  /** The most recent assessment_invitation notification's delivery status — null when no invitation has ever been sent, or when there's no assessment record at all. */
  email_status: "pending" | "sent" | "failed" | null;
}

export interface BoardApplicationCardDTO {
  id: string;
  candidate: BoardCandidateDTO;
  status: string;
  applied_at: string;
  source?: string;
  screening: ScreeningSummaryDTO;
  interview_summary: InterviewSummaryDTO | null;
  assessment_summary: AssessmentSummaryDTO | null;
}

export interface BoardNeedsAttentionCardDTO extends BoardApplicationCardDTO {
  current_step_id: string | null;
}

export interface BoardStageDTO {
  id: string;
  name: string;
  type: string;
  description: string | null;
  position: number;
  count: number;
  applications: BoardApplicationCardDTO[];
}

export interface HiringPipelineBoardDTO {
  job: BoardJobDTO;
  unassigned: { count: number; applications: BoardApplicationCardDTO[] };
  stages: BoardStageDTO[];
  needs_attention: BoardNeedsAttentionCardDTO[];
}

/**
 * Explicit DTO — never a raw Mongoose document. Every field is hand-picked
 * from Application/Candidate, so nothing new added to those models later
 * (company_id, cv_file.storage_key, __v, auth fields, etc.) can leak into
 * a board card without a deliberate change here. Deliberately excludes
 * everything the ticket calls out: CV storage_key, signed CV URLs, raw CV
 * text, the AI analysis body, the AI prompt, company_id, created_by,
 * password/auth data, or any candidate-ranking/hiring-recommendation
 * field — none of those are read anywhere near this function.
 *
 * `candidate` uses `full_name` (not `name`) — matching this codebase's
 * existing DTO convention (applicationHr.serializer.ts's
 * ApplicationListRowDTO/ApplicationDetailDTO both use full_name), a
 * deliberate adaptation of the ticket's own illustrative JSON.
 */
export function serializeBoardApplicationCard(
  application: ApplicationDoc,
  candidate: CandidateDoc,
  screeningSummary: ScreeningSummary | undefined,
  interviewSummary: InterviewSummaryDTO | null = null,
  assessmentSummary: AssessmentSummaryDTO | null = null
): BoardApplicationCardDTO {
  return {
    id: application.id,
    candidate: {
      id: candidate.id,
      full_name: candidate.full_name,
      email: candidate.email,
    },
    status: application.status,
    applied_at: application.applied_at.toISOString(),
    source: application.source ?? undefined,
    screening: serializeScreeningSummary(screeningSummary),
    interview_summary: interviewSummary,
    assessment_summary: assessmentSummary,
  };
}

export function serializeBoardNeedsAttentionCard(
  application: ApplicationDoc,
  candidate: CandidateDoc,
  screeningSummary: ScreeningSummary | undefined
): BoardNeedsAttentionCardDTO {
  return {
    // Inconsistent/legacy data — never worth resolving an Interview/
    // Assessment summary for it (see BoardApplicationCardDTO's doc
    // comment above).
    ...serializeBoardApplicationCard(application, candidate, screeningSummary, null, null),
    current_step_id: application.current_step_id ? application.current_step_id.toString() : null,
  };
}

export function serializeBoardJob(job: JobDoc): BoardJobDTO {
  return { id: job.id, title: job.title, status: job.status };
}

export function serializeBoardStage(step: HiringStepDoc, applications: BoardApplicationCardDTO[]): BoardStageDTO {
  return {
    id: step.id,
    name: step.name,
    type: step.type,
    description: step.description ?? null,
    position: step.position,
    count: applications.length,
    applications,
  };
}
