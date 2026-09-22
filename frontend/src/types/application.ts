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

// Mirrors backend applicationHr.serializer.ts's ScreeningStatus exactly.
// "not_started" only ever appears for a legacy Application that predates
// automatic screening and has never been screened. "stale_processing" is
// a derived overlay for a "processing" run stuck past the configured
// timeout (e.g. a backend crash mid-screening) with no completed result —
// recoverable via an explicit Retry, unlike normal "processing".
export const SCREENING_SUMMARY_STATUSES = ["not_started", "pending", "processing", "stale_processing", "completed", "failed"] as const;
export type ScreeningSummaryStatus = (typeof SCREENING_SUMMARY_STATUSES)[number];

export interface ApplicationScreeningSummary {
  status: ScreeningSummaryStatus;
  // Derived (status === "completed") — kept for existing call sites built before `status` existed.
  has_screening: boolean;
  // A coverage score, never a hiring judgment — see ScreeningStatusBadge.
  latest_score?: number | null;
  latest_screened_at?: string;
}

export interface ApplicationCurrentStepSummary {
  id: string;
  name: string;
  type: string;
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
  /** Resolved from the LIVE HiringStep, mirroring ApplicationDetail.current_step — null when the application has no current stage, or (defensively) if it doesn't resolve. Presentation data only: `status` above remains the actual lifecycle/business-rule value. */
  current_step: ApplicationCurrentStepSummary | null;
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
  /** Resolved from the LIVE HiringStep (not a snapshot) — null when the application has no current stage. Lets the UI decide whether to offer "Schedule Interview" without a second request. */
  current_step: { id: string; name: string; type: string } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
