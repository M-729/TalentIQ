import type { ApplicationStatus } from "@/types/application";

// Mirrors backend src/modules/assessments/applicationAssessment.serializer.ts
// exactly.
export const APPLICATION_ASSESSMENT_STATUSES = ["pending", "passed", "failed"] as const;
export type ApplicationAssessmentStatus = (typeof APPLICATION_ASSESSMENT_STATUSES)[number];

export interface ApplicationAssessment {
  id: string;
  application_id: string;
  job_id: string;
  hiring_step_id: string;
  name: string;
  external_url: string;
  status: ApplicationAssessmentStatus;
  /** A hand-entered percentage (0-100), never derived from status. null when no grade has been entered. */
  grade: number | null;
  notes: string | null;
  sent_at: string | null;
  result_recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

// One item of the Application-level assessment history — see
// GET /applications/:applicationId/assessment/history. Extends the base
// record with the extra context a history view needs that a single
// current-stage read doesn't.
export interface AssessmentHistoryItem extends ApplicationAssessment {
  /** The live HiringStep this record was created against — null if that step was since deleted (a rare, genuinely orphaned reference). */
  stage: { id: string; name: string; type: string } | null;
  /** True for exactly the one record (if any) matching the Application's CURRENT stage. */
  is_current: boolean;
  email_status: AssessmentEmailStatus | null;
}

export interface CreateAssessmentInput {
  name: string;
  external_url: string;
}

export type UpdateAssessmentLinkInput = Partial<CreateAssessmentInput>;

export interface RecordAssessmentResultInput {
  status: ApplicationAssessmentStatus;
  grade?: number | null;
  notes?: string | null;
}

export const ASSESSMENT_EMAIL_STATUSES = ["pending", "sent", "failed"] as const;
export type AssessmentEmailStatus = (typeof ASSESSMENT_EMAIL_STATUSES)[number];

export interface AssessmentNotification {
  id: string;
  status: AssessmentEmailStatus;
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  /** A safe, provider-neutral code (e.g. "smtp_unavailable") — never a raw SMTP error. Null unless status is "failed". */
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}

// ===== /assessments company-wide list =====
export interface AssessmentListRow {
  id: string;
  application_id: string;
  candidate: { id: string; full_name: string; email: string };
  job: { id: string; title: string };
  name: string;
  status: ApplicationAssessmentStatus;
  grade: number | null;
  email_status: AssessmentEmailStatus | null;
  /** The Application's actual lifecycle status — reused directly by PipelineStageBadge for a consistent "Pipeline Stage" presentation with the Applications table. */
  application_status: ApplicationStatus;
  current_step: { id: string; name: string; type: string } | null;
  updated_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListAssessmentsFilters {
  jobId?: string;
  status?: ApplicationAssessmentStatus;
  search?: string;
  page?: number;
  limit?: number;
}
