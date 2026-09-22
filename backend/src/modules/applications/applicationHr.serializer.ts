import type { ApplicationDoc } from "../../models/Application.model";
import type { CandidateDoc } from "../../models/Candidate.model";
import type { JobDoc } from "../../models/Job.model";
import type { HiringStepDoc } from "../../models/HiringStep.model";
import type { ReportedScreeningStatus } from "../../services/ai/screeningRun.service";

/** "not_started" only ever appears for a legacy Application that predates the automatic-screening feature and has never been screened; "stale_processing" only ever appears for a "processing" run stuck past the configured timeout with no completed screening — see screeningRun.service.ts's ReportedScreeningStatus/resolveReportedStatus. */
export type ScreeningStatus = ReportedScreeningStatus;

export interface ScreeningSummary {
  status: ScreeningStatus;
  latestScore: number | null;
  latestScreenedAt: Date | null;
}

export interface ScreeningSummaryDTO {
  status: ScreeningStatus;
  /** Derived (status === "completed") — kept alongside `status` for existing consumers built before this field existed. */
  has_screening: boolean;
  latest_score?: number | null;
  latest_screened_at?: string;
}

export function serializeScreeningSummary(summary: ScreeningSummary | undefined): ScreeningSummaryDTO {
  if (!summary || summary.status !== "completed") {
    return { status: summary?.status ?? "not_started", has_screening: false };
  }
  return {
    status: "completed",
    has_screening: true,
    latest_score: summary.latestScore,
    latest_screened_at: summary.latestScreenedAt?.toISOString(),
  };
}

export interface ApplicationListRowDTO {
  id: string;
  status: string;
  source?: string;
  applied_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    location?: string;
  };
  job: {
    id: string;
    title: string;
    department?: string;
    status: string;
  };
  screening: ScreeningSummaryDTO;
}

/**
 * Explicit DTO — never a raw Mongoose document. Hand-picks every field so
 * nothing new added to the models later (company_id, created_by, __v,
 * storage_key, auth fields, etc.) can leak into an HR-facing response
 * without a deliberate change here.
 */
export function serializeApplicationListRow(
  application: ApplicationDoc,
  candidate: CandidateDoc,
  job: JobDoc,
  screeningSummary: ScreeningSummary | undefined
): ApplicationListRowDTO {
  return {
    id: application.id,
    status: application.status,
    source: application.source ?? undefined,
    applied_at: application.applied_at.toISOString(),
    candidate: {
      id: candidate.id,
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone ?? undefined,
      location: candidate.location ?? undefined,
    },
    job: {
      id: job.id,
      title: job.title,
      department: job.department ?? undefined,
      status: job.status,
    },
    screening: serializeScreeningSummary(screeningSummary),
  };
}

export interface ApplicationDetailDTO {
  id: string;
  status: string;
  source?: string;
  applied_at: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    location?: string;
    linkedin_url?: string;
    portfolio_url?: string;
  };
  job: {
    id: string;
    title: string;
    department?: string;
    description?: string;
    required_skills: string[];
    experience_level?: string;
    location?: string;
    employment_type?: string;
    status: string;
  };
  cv: {
    original_name: string;
    mime_type: string;
    size_bytes: number;
  };
  screening: ScreeningSummaryDTO;
  /**
   * The application's current stage, resolved from the LIVE HiringStep
   * (unlike Interview.stage_snapshot, which is deliberately frozen —
   * there is no analogous "historical" concern here: an Application's
   * current stage is, by definition, whatever the live pipeline says it
   * is right now). null when the Application has no current stage (e.g.
   * still "applied", never moved into the active pipeline). This is what
   * lets the frontend decide whether to offer "Schedule Interview"
   * without a second request.
   */
  current_step: { id: string; name: string; type: string } | null;
}

/**
 * Deliberately excludes: cv storage_key, any R2/signed URL, company_id,
 * created_by, __v, and any AI prompt/raw-provider data — none of those
 * are read from anywhere near this function, so there is nothing to leak
 * by omission here. The full AI analysis/match breakdown is intentionally
 * NOT included — that already has its own endpoint
 * (GET .../screenings/latest); this is only a summary.
 */
export function serializeApplicationDetail(
  application: ApplicationDoc,
  candidate: CandidateDoc,
  job: JobDoc,
  screeningSummary: ScreeningSummary | undefined,
  currentStep: HiringStepDoc | null = null
): ApplicationDetailDTO {
  return {
    id: application.id,
    status: application.status,
    source: application.source ?? undefined,
    applied_at: application.applied_at.toISOString(),
    candidate: {
      id: candidate.id,
      full_name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone ?? undefined,
      location: candidate.location ?? undefined,
      linkedin_url: candidate.linkedin_url ?? undefined,
      portfolio_url: candidate.portfolio_url ?? undefined,
    },
    job: {
      id: job.id,
      title: job.title,
      department: job.department ?? undefined,
      description: job.description ?? undefined,
      required_skills: job.required_skills,
      experience_level: job.experience_level ?? undefined,
      location: job.location ?? undefined,
      employment_type: job.employment_type ?? undefined,
      status: job.status,
    },
    cv: {
      original_name: application.cv_file.original_name,
      mime_type: application.cv_file.mime_type,
      size_bytes: application.cv_file.size_bytes,
    },
    screening: serializeScreeningSummary(screeningSummary),
    current_step: currentStep ? { id: currentStep.id, name: currentStep.name, type: currentStep.type } : null,
  };
}
