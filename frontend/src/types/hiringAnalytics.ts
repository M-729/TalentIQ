export const ANALYTICS_RANGES = ["30d", "90d", "all"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface HiringAnalyticsKpis {
  total_applications: number;
  hired: number;
  offers_accepted: number;
  offers_declined: number;
  offer_acceptance_rate: number | null;
  average_time_to_hire_days: number | null;
}

export interface ApplicationsByJobRow {
  job_id: string;
  job_title: string;
  count: number;
}

export interface ApplicationsOverTimePoint {
  /** "YYYY-MM-DD" — a day (30d), the Monday of a week (90d), or the 1st of a month (all-time). */
  period: string;
  count: number;
}

export interface PipelineDistribution {
  new_applicants: number;
  review: number;
  interview: number;
  assessment: number;
  other: number;
  offered: number;
  hired: number;
  rejected: number;
  offer_declined: number;
}

export interface OfferOutcomes {
  accepted: number;
  declined: number;
  pending: number;
  withdrawn: number;
  acceptance_rate: number | null;
}

export interface HiringAnalytics {
  range: AnalyticsRange;
  job_id: string | null;
  kpis: HiringAnalyticsKpis;
  applications_over_time: ApplicationsOverTimePoint[];
  applications_by_job: ApplicationsByJobRow[];
  pipeline_distribution: PipelineDistribution;
  offer_outcomes: OfferOutcomes;
}
