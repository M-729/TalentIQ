import type { ApplicationAssessmentDoc, ApplicationAssessmentStatus } from "../../models/ApplicationAssessment.model";
import type { CandidateDoc } from "../../models/Candidate.model";
import type { JobDoc } from "../../models/Job.model";
import type { HiringStepDoc } from "../../models/HiringStep.model";
import type { EmailNotificationDoc, EmailNotificationStatus } from "../../models/EmailNotification.model";

export interface AssessmentNotificationDTO {
  id: string;
  status: EmailNotificationStatus;
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  /** A safe, provider-neutral code (e.g. "smtp_unavailable") — never a raw SMTP error. Null unless status is "failed". */
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}

/**
 * Mirrors interviewNotification.serializer.ts's serializeInterviewNotification
 * exactly, for the assessment_invitation category. Deliberately excludes
 * company_id/application_id/candidate_id/application_assessment_id
 * (internal ids), triggered_by_user_id, __v, and the raw rendered email
 * body (never stored in the first place).
 */
export function serializeAssessmentNotification(doc: EmailNotificationDoc): AssessmentNotificationDTO {
  return {
    id: doc.id,
    status: doc.status,
    subject: doc.subject,
    recipient_email: doc.recipient_email,
    attempted_at: doc.attempted_at ? doc.attempted_at.toISOString() : null,
    sent_at: doc.sent_at ? doc.sent_at.toISOString() : null,
    failure_code: doc.failure_code ?? null,
    attempt_count: doc.attempt_count,
    created_at: doc.created_at!.toISOString(),
  };
}

export function serializeAssessmentNotifications(docs: EmailNotificationDoc[]): AssessmentNotificationDTO[] {
  return docs.map(serializeAssessmentNotification);
}

export interface ApplicationAssessmentDTO {
  id: string;
  application_id: string;
  job_id: string;
  hiring_step_id: string;
  name: string;
  external_url: string;
  status: ApplicationAssessmentStatus;
  grade: number | null;
  notes: string | null;
  sent_at: string | null;
  result_recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Explicit DTO — never a raw Mongoose document. Deliberately excludes
 * company_id/created_by_user_id/updated_by_user_id (internal ids not yet
 * useful to a client) and __v.
 */
export function serializeApplicationAssessment(doc: ApplicationAssessmentDoc): ApplicationAssessmentDTO {
  return {
    id: doc.id,
    application_id: doc.application_id.toString(),
    job_id: doc.job_id.toString(),
    hiring_step_id: doc.hiring_step_id.toString(),
    name: doc.name,
    external_url: doc.external_url,
    status: doc.status,
    grade: doc.grade ?? null,
    notes: doc.notes ?? null,
    sent_at: doc.sent_at ? doc.sent_at.toISOString() : null,
    result_recorded_at: doc.result_recorded_at ? doc.result_recorded_at.toISOString() : null,
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
  };
}

export interface AssessmentHistoryItemDTO extends ApplicationAssessmentDTO {
  /** The stage this record was created under — read from the record's own frozen stage_snapshot (immutable: a later HiringStep rename/reorder/deletion never changes this), falling back to a live HiringStep lookup only for legacy records created before stage_snapshot existed. Null only when even that legacy fallback finds no live HiringStep left. */
  stage: { id: string; name: string; type: string } | null;
  /** True for exactly the one record (if any) whose hiring_step_id matches the Application's CURRENT current_step_id — lets the frontend render the active/actionable one distinctly from read-only history without a second request. */
  is_current: boolean;
  /** The most recent assessment_invitation notification's status for THIS record — null when no invitation was ever sent for it. */
  email_status: EmailNotificationStatus | null;
}

/**
 * One Application's full assessment history, oldest business fact
 * unchanged — see applicationAssessment.service.ts's
 * listAssessmentHistoryForApplication. Reuses ApplicationAssessmentDTO's
 * exact fields (never a parallel/divergent shape) plus the extra
 * stage/is_current/email_status context a history view needs that a
 * single current-stage read doesn't.
 *
 * `stage` is passed in as a plain, already-normalized shape rather than a
 * HiringStepDoc — the caller resolves it from either the record's frozen
 * stage_snapshot or (legacy records only) a live HiringStep, and this
 * serializer doesn't need to care which.
 */
export function serializeAssessmentHistoryItem(
  doc: ApplicationAssessmentDoc,
  stage: { id: string; name: string; type: string } | null,
  isCurrent: boolean,
  emailStatus: EmailNotificationStatus | null
): AssessmentHistoryItemDTO {
  return {
    ...serializeApplicationAssessment(doc),
    stage,
    is_current: isCurrent,
    email_status: emailStatus,
  };
}

export interface AssessmentListRowDTO {
  id: string;
  application_id: string;
  candidate: { id: string; full_name: string; email: string };
  job: { id: string; title: string };
  name: string;
  status: ApplicationAssessmentStatus;
  grade: number | null;
  /** The most recent assessment_invitation notification's status for this assessment — null when no invitation has ever been sent. */
  email_status: EmailNotificationStatus | null;
  /** The Application's actual lifecycle status — same field the Applications list/Pipeline Stage column already uses, so the frontend can reuse that exact same presentation logic here. */
  application_status: string;
  /** The Application's LIVE current HiringStep (never a snapshot) — null if it has since moved on/has none. Same shape as ApplicationListRowDTO.current_step. */
  current_step: { id: string; name: string; type: string } | null;
  updated_at: string;
}

/**
 * The /assessments company-wide list row — joins in just enough
 * candidate/job/pipeline context for that page's table, batched by the
 * caller (see applicationAssessment.service.ts's listAssessments), never
 * resolved per-row.
 */
export function serializeAssessmentListRow(
  doc: ApplicationAssessmentDoc,
  candidate: CandidateDoc,
  job: JobDoc,
  applicationStatus: string,
  currentStep: HiringStepDoc | null,
  emailStatus: EmailNotificationStatus | null
): AssessmentListRowDTO {
  return {
    id: doc.id,
    application_id: doc.application_id.toString(),
    candidate: { id: candidate.id, full_name: candidate.full_name, email: candidate.email },
    job: { id: job.id, title: job.title },
    name: doc.name,
    status: doc.status,
    grade: doc.grade ?? null,
    email_status: emailStatus,
    application_status: applicationStatus,
    current_step: currentStep ? { id: currentStep.id, name: currentStep.name, type: currentStep.type } : null,
    updated_at: doc.updated_at!.toISOString(),
  };
}
