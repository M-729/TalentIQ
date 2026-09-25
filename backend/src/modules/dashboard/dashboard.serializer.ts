import type { ApplicationDoc } from "../../models/Application.model";
import type { CandidateDoc } from "../../models/Candidate.model";
import type { JobDoc } from "../../models/Job.model";
import type { HiringStepDoc } from "../../models/HiringStep.model";
import type { InterviewDoc } from "../../models/Interview.model";

export interface DashboardMetricsDTO {
  open_jobs: number;
  new_applicants: number;
  upcoming_interviews: number;
  pending_offers: number;
  hired: number;
}

export interface DashboardAttentionDTO {
  failed_emails: number;
  assessments_awaiting_result: number;
  interviews_awaiting_feedback: number;
  offers_awaiting_response: number;
  offers_expiring_soon: number;
}

export interface DashboardApplicationRowDTO {
  id: string;
  // Opaque, URL-facing identifier — see applicationHr.serializer.ts's
  // ApplicationListRowDTO.public_id doc comment.
  public_id?: string;
  candidate: { id: string; name: string };
  job: { id: string; title: string };
  status: string;
  /** Same shape as applicationHr.serializer.ts's current_step — null while still unassigned/"New Applicant", or defensively if a stale current_step_id no longer resolves. */
  current_step: { id: string; name: string; type: string } | null;
  applied_at: string;
}

export interface DashboardInterviewRowDTO {
  id: string;
  // Opaque, URL-facing identifier for the Interview's parent Application —
  // the raw Mongo application_id is deliberately not exposed here (Phase 2
  // cutover — see this ticket's report): frontend navigation to the
  // Application detail page must use this field, never a database id.
  application_public_id: string;
  candidate: { id: string; name: string };
  job: { id: string; title: string };
  starts_at: string;
  timezone: string;
  status: string;
}

export interface DashboardDTO {
  metrics: DashboardMetricsDTO;
  recent_applications: DashboardApplicationRowDTO[];
  upcoming_interviews: DashboardInterviewRowDTO[];
  attention: DashboardAttentionDTO;
}

export function serializeDashboardApplicationRow(
  application: ApplicationDoc,
  candidate: CandidateDoc,
  job: JobDoc,
  currentStep: HiringStepDoc | null
): DashboardApplicationRowDTO {
  return {
    id: application.id,
    public_id: application.public_id ?? undefined,
    candidate: { id: candidate.id, name: candidate.full_name },
    job: { id: job.id, title: job.title },
    status: application.status,
    current_step: currentStep ? { id: currentStep.id, name: currentStep.name, type: currentStep.type } : null,
    applied_at: application.applied_at.toISOString(),
  };
}

export function serializeDashboardInterviewRow(
  interview: InterviewDoc,
  candidate: CandidateDoc,
  job: JobDoc,
  applicationPublicId: string
): DashboardInterviewRowDTO {
  return {
    id: interview.id,
    application_public_id: applicationPublicId,
    candidate: { id: candidate.id, name: candidate.full_name },
    job: { id: job.id, title: job.title },
    starts_at: interview.starts_at.toISOString(),
    timezone: interview.timezone,
    status: interview.status,
  };
}
