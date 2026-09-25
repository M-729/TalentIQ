import { Types, type FilterQuery } from "mongoose";
import { Application, type ApplicationDoc } from "../../models/Application.model";
import { Job } from "../../models/Job.model";
import { HiringStep } from "../../models/HiringStep.model";
import { Offer, type OfferDoc } from "../../models/Offer.model";
import { companyFilter } from "../../security/companyScope";
import { NotFoundError } from "../../security/AppError";
import { resolveCompanyJobScope } from "../reporting/reporting.service";
import { resolveJobId } from "../jobs/job.service";
import { computeRate, type ApplicationsOverTimePointDTO, type HiringAnalyticsDTO } from "./hiringAnalytics.serializer";
import type { AnalyticsRange } from "./hiringAnalytics.validation";

const RANGE_DAYS: Record<AnalyticsRange, number | null> = { "30d": 30, "90d": 90, all: null };

// The single deterministic mapping from range -> time-series bucket size
// (this ticket's explicit "choose a deterministic simple convention and
// document it" rule): 30d buckets daily (~31 points), 90d buckets weekly
// (~13 points, "cleaner" per this ticket's own suggestion), all-time
// buckets monthly (bounded by how many real months of history exist —
// never thousands of empty daily points).
type TimeSeriesGranularity = "day" | "week" | "month";
const RANGE_GRANULARITY: Record<AnalyticsRange, TimeSeriesGranularity> = { "30d": "day", "90d": "week", all: "month" };

/** `null` `from` means "all time" — no lower bound at all, never a fabricated far-past date. */
function resolveDateRange(range: AnalyticsRange): { from: Date | null; to: Date } {
  const to = new Date();
  const days = RANGE_DAYS[range];
  return { from: days === null ? null : new Date(to.getTime() - days * 24 * 60 * 60 * 1000), to };
}

function dateRangeFilter(from: Date | null, to: Date): Record<string, Date> | undefined {
  return from ? { $gte: from, $lte: to } : undefined;
}

// ===== Applications Over Time bucketing — all in UTC, matching the exact
// truncation Mongo's own $dateTrunc performs below, so the JS-generated
// "expected bucket" keys line up with the aggregation's real keys. =====

function truncateToUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Monday of the week containing `date`, at UTC midnight — matches $dateTrunc's `unit:"week", startOfWeek:"monday"`. */
function truncateToUTCWeekMonday(date: Date): Date {
  const day = truncateToUTCDay(date);
  const weekday = day.getUTCDay(); // 0=Sunday..6=Saturday
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  day.setUTCDate(day.getUTCDate() + diffToMonday);
  return day;
}

function truncateToUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function truncateForGranularity(date: Date, granularity: TimeSeriesGranularity): Date {
  if (granularity === "day") return truncateToUTCDay(date);
  if (granularity === "week") return truncateToUTCWeekMonday(date);
  return truncateToUTCMonth(date);
}

function stepForGranularity(date: Date, granularity: TimeSeriesGranularity): Date {
  const next = new Date(date);
  if (granularity === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === "week") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function formatBucketKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Every bucket key from `startInclusive` to `endInclusive` (both already truncated), stepping by `granularity` — the full x-axis, so a real-but-zero period never visually "skips" (this ticket's explicit rule). */
function generateBucketKeys(startInclusive: Date, endInclusive: Date, granularity: TimeSeriesGranularity): string[] {
  const keys: string[] = [];
  let cursor = startInclusive;
  while (cursor.getTime() <= endInclusive.getTime()) {
    keys.push(formatBucketKey(cursor));
    cursor = stepForGranularity(cursor, granularity);
  }
  return keys;
}

/**
 * Applications Over Time — a real Mongo aggregation grouping
 * Application.applied_at (the SAME timestamp basis as the Total
 * Applications KPI) into UTC buckets, sized per RANGE_GRANULARITY. Zero-
 * value buckets are filled in for every period between the first and last
 * real data point (bounded — never a flat wall of zeros when there is no
 * data at all: an empty result returns `[]`, and the frontend renders its
 * own "No applications in this period" empty state instead of a
 * meaningless all-zero line).
 */
async function getApplicationsOverTime(
  applicationBaseFilter: FilterQuery<ApplicationDoc>,
  appliedAtFilter: Record<string, Date> | undefined,
  range: AnalyticsRange
): Promise<ApplicationsOverTimePointDTO[]> {
  const granularity = RANGE_GRANULARITY[range];

  const rows = await Application.aggregate<{ _id: string; count: number }>([
    { $match: { ...applicationBaseFilter, ...(appliedAtFilter ? { applied_at: appliedAtFilter } : {}) } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: {
              $dateTrunc: {
                date: "$applied_at",
                unit: granularity,
                timezone: "UTC",
                ...(granularity === "week" ? { startOfWeek: "monday" } : {}),
              },
            },
            timezone: "UTC",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  if (rows.length === 0) return [];

  const countByKey = new Map(rows.map((row) => [row._id, row.count]));

  // Bounded ranges (30d/90d) fill zeros across the WHOLE selected window,
  // even past the last real data point, so the line reaches "today".
  // All-time fills only between the earliest real application and now —
  // there is no meaningful lower bound to fabricate.
  const { from } = resolveDateRange(range);
  const startInclusive = from ? truncateForGranularity(from, granularity) : truncateForGranularity(new Date(rows[0]!._id), granularity);
  const endInclusive = truncateForGranularity(new Date(), granularity);

  return generateBucketKeys(startInclusive, endInclusive, granularity).map((period) => ({
    period,
    count: countByKey.get(period) ?? 0,
  }));
}

/**
 * Company-scoped Hiring Analytics — every metric's exact timestamp basis
 * is documented at its own query (this ticket's Part 11 "clearly define
 * which timestamp each metric uses" rule):
 *
 * - Total Applications: Application.applied_at within the period.
 * - Hired: Application.hired_at within the period (status === "hired").
 * - Offers Accepted / Declined: Offer.accepted_at / declined_at within
 *   the period — an offer sent before the period but responded to DURING
 *   it counts; one responded to before the period does not, even if still
 *   visible elsewhere.
 * - Offer Acceptance Rate: accepted / (accepted + declined) over the SAME
 *   period-scoped counts above — null (never NaN/Infinity) when both are 0.
 * - Average Time to Hire: mean(hired_at - applied_at) in DAYS, for
 *   Applications hired within the period — null when there were no hires.
 * - Applications Over Time: same applied_at-in-period basis as Total
 *   Applications, bucketed by day (30d) / week (90d) / month (all) — see
 *   getApplicationsOverTime's own doc comment for the exact bucketing
 *   convention and zero-filling rules.
 * - Applications by Job: same applied_at-in-period basis as Total
 *   Applications, grouped by Job; only Jobs with at least one matching
 *   Application are returned (never a zero-padded list of every Job).
 * - Pipeline Distribution: deliberately NOT date-filtered — see this
 *   ticket's explicit distinction between a point-in-time CURRENT STATE
 *   distribution (what this is) and a HISTORICAL CONVERSION FUNNEL (which
 *   this is not — this endpoint never claims a conversion percentage from
 *   current-state counts). It reflects "where every Application stands
 *   right now", independent of the selected date range, which only scopes
 *   the KPIs/Applications-by-Job/Offer-Outcomes sections above and below.
 * - Offer Outcomes: accepted/declined use the SAME accepted_at/declined_at
 *   basis as the KPIs above (so the two sections never silently disagree
 *   for the same period); "pending" (sent, awaiting response) and
 *   "withdrawn" have no meaningful response timestamp, so they're scoped
 *   by Offer.created_at within the period instead — Offers CREATED in
 *   this window that are still sent/withdrawn. Draft Offers are never
 *   counted anywhere here (see this ticket's explicit Part 15 rule).
 */
export async function getHiringAnalytics(
  companyId: string,
  filters: { range: AnalyticsRange; jobId?: string }
): Promise<HiringAnalyticsDTO> {
  // filters.jobId is a dual-accept public_id-or-ObjectId (see
  // job.service.ts's resolveJobId) — resolved ONCE, here, to the real
  // internal id every use below actually needs (Application.job_id/
  // Offer.job_id are always plain ObjectId references and were never
  // themselves migrated). Every other reference to the job filter in this
  // function uses this resolved value, never the raw filters.jobId.
  let resolvedJobId: string | null = null;
  if (filters.jobId) {
    resolvedJobId = await resolveJobId(companyId, filters.jobId);
    if (!resolvedJobId) {
      throw new NotFoundError("Job not found");
    }
  }

  const { from, to } = resolveDateRange(filters.range);
  const appliedAtFilter = dateRangeFilter(from, to);

  const { jobIds: allCompanyJobIds } = await resolveCompanyJobScope(companyId);
  const scopedJobIds = resolvedJobId ? [new Types.ObjectId(resolvedJobId)] : allCompanyJobIds;

  const applicationBaseFilter: FilterQuery<ApplicationDoc> = { job_id: { $in: scopedJobIds } };

  const [
    totalApplications,
    hiredApplicationsInPeriod,
    offerAcceptedCount,
    offerDeclinedCount,
    applicationsOverTime,
    applicationsByJobRaw,
    pipelineApplications,
    offerOutcomeCounts,
  ] = await Promise.all([
    Application.countDocuments({ ...applicationBaseFilter, ...(appliedAtFilter ? { applied_at: appliedAtFilter } : {}) }),
    Application.find({
      ...applicationBaseFilter,
      status: "hired",
      ...(appliedAtFilter ? { hired_at: appliedAtFilter } : {}),
    }).select("applied_at hired_at"),
    countOffers(companyId, resolvedJobId ?? undefined, { status: "accepted", timestampField: "accepted_at", from, to }),
    countOffers(companyId, resolvedJobId ?? undefined, { status: "declined", timestampField: "declined_at", from, to }),
    getApplicationsOverTime(applicationBaseFilter, appliedAtFilter, filters.range),
    Application.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { ...applicationBaseFilter, ...(appliedAtFilter ? { applied_at: appliedAtFilter } : {}) } },
      { $group: { _id: "$job_id", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Application.find(applicationBaseFilter).select("status current_step_id final_decision"),
    getOfferOutcomeCounts(companyId, resolvedJobId ?? undefined, from, to),
  ]);

  // ===== Average Time to Hire =====
  const averageTimeToHireDays =
    hiredApplicationsInPeriod.length === 0
      ? null
      : Math.round(
          (hiredApplicationsInPeriod.reduce(
            (sum, application) => sum + (application.hired_at!.getTime() - application.applied_at.getTime()),
            0
          ) /
            hiredApplicationsInPeriod.length /
            (24 * 60 * 60 * 1000)) *
            10
        ) / 10;

  // ===== Applications by Job =====
  const jobIdsForLabels = applicationsByJobRaw.map((row) => row._id);
  const jobsForLabels = jobIdsForLabels.length ? await Job.find({ _id: { $in: jobIdsForLabels } }).select("title") : [];
  const jobTitleById = new Map(jobsForLabels.map((job) => [job.id, job.title]));
  const applicationsByJob = applicationsByJobRaw
    .map((row) => ({ job_id: row._id.toString(), job_title: jobTitleById.get(row._id.toString()) ?? "Unknown job", count: row.count }))
    .filter((row) => jobTitleById.has(row.job_id));

  // ===== Pipeline Distribution (current state, not date-scoped) =====
  const inProcessStepIds = [
    ...new Set(
      pipelineApplications
        .filter((application) => application.status === "in_process" && application.current_step_id)
        .map((application) => application.current_step_id!.toString())
    ),
  ];
  const steps = inProcessStepIds.length ? await HiringStep.find({ _id: { $in: inProcessStepIds } }).select("type") : [];
  const stepTypeById = new Map(steps.map((step) => [step.id, step.type]));

  const pipelineDistribution = { new_applicants: 0, review: 0, interview: 0, assessment: 0, other: 0, offered: 0, hired: 0, rejected: 0, offer_declined: 0 };
  for (const application of pipelineApplications) {
    if (application.status === "applied" && !application.current_step_id) {
      pipelineDistribution.new_applicants += 1;
    } else if (application.status === "in_process" && application.current_step_id) {
      const type = stepTypeById.get(application.current_step_id.toString());
      if (type === "review") pipelineDistribution.review += 1;
      else if (type === "interview") pipelineDistribution.interview += 1;
      else if (type === "assessment") pipelineDistribution.assessment += 1;
      else pipelineDistribution.other += 1;
    } else if (application.status === "offered") {
      if (application.final_decision === "declined") pipelineDistribution.offer_declined += 1;
      else pipelineDistribution.offered += 1;
    } else if (application.status === "hired") {
      pipelineDistribution.hired += 1;
    } else if (application.status === "rejected") {
      pipelineDistribution.rejected += 1;
    } else {
      pipelineDistribution.other += 1;
    }
  }

  return {
    range: filters.range,
    job_id: resolvedJobId,
    kpis: {
      total_applications: totalApplications,
      hired: hiredApplicationsInPeriod.length,
      offers_accepted: offerAcceptedCount,
      offers_declined: offerDeclinedCount,
      offer_acceptance_rate: computeRate(offerAcceptedCount, offerAcceptedCount + offerDeclinedCount),
      average_time_to_hire_days: averageTimeToHireDays,
    },
    applications_over_time: applicationsOverTime,
    applications_by_job: applicationsByJob,
    pipeline_distribution: pipelineDistribution,
    offer_outcomes: {
      accepted: offerOutcomeCounts.accepted,
      declined: offerOutcomeCounts.declined,
      pending: offerOutcomeCounts.pending,
      withdrawn: offerOutcomeCounts.withdrawn,
      acceptance_rate: computeRate(offerOutcomeCounts.accepted, offerOutcomeCounts.accepted + offerOutcomeCounts.declined),
    },
  };
}

async function countOffers(
  companyId: string,
  jobId: string | undefined,
  opts: { status: OfferDoc["status"]; timestampField: "accepted_at" | "declined_at"; from: Date | null; to: Date }
): Promise<number> {
  const filter: FilterQuery<OfferDoc> = {
    ...companyFilter(companyId),
    ...(jobId ? { job_id: jobId } : {}),
    status: opts.status,
    ...(opts.from ? { [opts.timestampField]: { $gte: opts.from, $lte: opts.to } } : {}),
  };
  return Offer.countDocuments(filter);
}

async function getOfferOutcomeCounts(
  companyId: string,
  jobId: string | undefined,
  from: Date | null,
  to: Date
): Promise<{ accepted: number; declined: number; pending: number; withdrawn: number }> {
  const scope: FilterQuery<OfferDoc> = { ...companyFilter(companyId), ...(jobId ? { job_id: jobId } : {}) };
  const createdAtFilter = dateRangeFilter(from, to);

  const [accepted, declined, pending, withdrawn] = await Promise.all([
    Offer.countDocuments({ ...scope, status: "accepted", ...(from ? { accepted_at: { $gte: from, $lte: to } } : {}) }),
    Offer.countDocuments({ ...scope, status: "declined", ...(from ? { declined_at: { $gte: from, $lte: to } } : {}) }),
    Offer.countDocuments({ ...scope, status: "sent", ...(createdAtFilter ? { created_at: createdAtFilter } : {}) }),
    Offer.countDocuments({ ...scope, status: "withdrawn", ...(createdAtFilter ? { created_at: createdAtFilter } : {}) }),
  ]);

  return { accepted, declined, pending, withdrawn };
}
