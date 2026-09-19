// Mirrors backend/src/modules/applications/application.validation.ts exactly
// — only fields the public API actually accepts. No status/pipeline/company
// fields exist here; those are backend-derived or not part of this ticket.
export interface SubmitApplicationInput {
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  portfolio_url?: string;
}

// Everything below mirrors backend/src/modules/applications/applicationHr.serializer.ts
// exactly — the authenticated HR-facing Applications list/detail API, not
// the public submission above. Keep in sync if the backend serializer
// changes.
export const APPLICATION_STATUSES = ["applied", "in_process", "rejected", "offered", "hired"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationScreeningSummary {
  has_screening: boolean;
  // A coverage score, never a hiring judgment — see ScreeningStatusBadge.
  latest_score?: number | null;
  latest_screened_at?: string;
}

export interface ApplicationListRow {
  id: string;
  status: ApplicationStatus;
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
  screening: ApplicationScreeningSummary;
}

export interface ApplicationDetail {
  id: string;
  status: ApplicationStatus;
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
  screening: ApplicationScreeningSummary;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
