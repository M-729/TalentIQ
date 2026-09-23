export interface HiringAnalyticsKpisDTO {
  total_applications: number;
  hired: number;
  offers_accepted: number;
  offers_declined: number;
  /** accepted / (accepted + declined) * 100, rounded to 1 decimal — null when accepted+declined === 0, never NaN/Infinity. */
  offer_acceptance_rate: number | null;
  /** Average days from Application.applied_at to Application.hired_at, for Applications hired within the period — null when there were no hires in the period. Explicitly DAYS, not hours. */
  average_time_to_hire_days: number | null;
}

export interface ApplicationsByJobRowDTO {
  job_id: string;
  job_title: string;
  count: number;
}

export interface ApplicationsOverTimePointDTO {
  /** "YYYY-MM-DD" — the start of the bucket (a day for 30d, the Monday of that week for 90d, the 1st of the month for all-time). See hiringAnalytics.service.ts's getApplicationsOverTime for the exact bucketing convention. */
  period: string;
  count: number;
}

export interface PipelineDistributionDTO {
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

export interface OfferOutcomesDTO {
  accepted: number;
  declined: number;
  pending: number;
  withdrawn: number;
  /** accepted / (accepted + declined) * 100, rounded to 1 decimal — null when accepted+declined === 0. */
  acceptance_rate: number | null;
}

export interface HiringAnalyticsDTO {
  range: "30d" | "90d" | "all";
  job_id: string | null;
  kpis: HiringAnalyticsKpisDTO;
  applications_over_time: ApplicationsOverTimePointDTO[];
  applications_by_job: ApplicationsByJobRowDTO[];
  pipeline_distribution: PipelineDistributionDTO;
  offer_outcomes: OfferOutcomesDTO;
}

export function computeRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}
