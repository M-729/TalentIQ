import type { ApplicationDoc } from "../../models/Application.model";
import type { CandidateDoc } from "../../models/Candidate.model";
import type { JobDoc } from "../../models/Job.model";

export interface ScreeningSummary {
  hasScreening: boolean;
  latestScore: number | null;
  latestScreenedAt: Date | null;
}

export interface ScreeningSummaryDTO {
  has_screening: boolean;
  latest_score?: number | null;
  latest_screened_at?: string;
}

export function serializeScreeningSummary(summary: ScreeningSummary | undefined): ScreeningSummaryDTO {
  if (!summary || !summary.hasScreening) {
    return { has_screening: false };
  }
  return {
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
  screeningSummary: ScreeningSummary | undefined
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
  };
}
