import { useState } from "react";
import {
  BarChart3,
  Briefcase,
  CalendarRange,
  Clock,
  FileCheck2,
  LineChart,
  Percent,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { FilterBar } from "@/components/layout/FilterBar";
import { ApplicationsByJobChart } from "@/components/analytics/ApplicationsByJobChart";
import { ApplicationsOverTimeChart } from "@/components/analytics/ApplicationsOverTimeChart";
import { OfferOutcomesChart } from "@/components/analytics/OfferOutcomesChart";
import { PipelineDistributionChart } from "@/components/analytics/PipelineDistributionChart";
import { useHiringAnalytics } from "@/hooks/useHiringAnalytics";
import { useJobs } from "@/hooks/useJobs";
import { jobUrlId } from "@/lib/jobUrlId";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/types/hiringAnalytics";

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

function EmptyCompanyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <BarChart3 className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-foreground">No hiring data yet</p>
          <p className="text-sm text-muted-foreground">Analytics will appear once candidates begin applying.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/jobs">View Jobs</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {value}
          {/* Unit rendered smaller/muted than the number itself for a
              clearer number hierarchy — never shown for "—" (unavailable). */}
          {unit && value !== "—" && <span className="ml-0.5 text-base font-medium text-muted-foreground">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

// Real, company-scoped hiring performance insight — never AI-generated,
// never a predictive score, never a candidate ranking (see this ticket's
// explicit "Do NOT BUILD" list).
export function HiringAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [jobId, setJobId] = useState("");

  const jobsQuery = useJobs();
  const { analytics, isLoading, error, refetch } = useHiringAnalytics(range, jobId || undefined);

  const isEmptyCompany =
    analytics &&
    analytics.kpis.total_applications === 0 &&
    analytics.applications_by_job.length === 0 &&
    Object.values(analytics.pipeline_distribution).every((count) => count === 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Hiring Analytics</h1>
        <p className="text-sm text-muted-foreground">Understand your recruitment activity and outcomes.</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <FilterBar>
            <div className="flex items-center gap-2 sm:w-56">
              <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="analytics-range" className="sr-only">
                Date range
              </label>
              <Select id="analytics-range" value={range} onChange={(e) => setRange(e.target.value as AnalyticsRange)}>
                {ANALYTICS_RANGES.map((value) => (
                  <option key={value} value={value}>
                    {RANGE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:w-60">
              <Briefcase className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="analytics-job-filter" className="sr-only">
                Filter by job
              </label>
              <Select id="analytics-job-filter" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">All Jobs</option>
                {(jobsQuery.jobs ?? [])
                  .filter((job) => job.public_id)
                  .map((job) => (
                    <option key={job._id} value={jobUrlId(job)}>
                      {job.title}
                    </option>
                  ))}
              </Select>
            </div>
          </FilterBar>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError title="Couldn't load analytics" message={error} onRetry={refetch} />
      ) : !analytics ? null : isEmptyCompany ? (
        <EmptyCompanyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Total Applications"
              value={String(analytics.kpis.total_applications)}
              icon={Users}
              tone="bg-violet-100 text-violet-600"
            />
            <KpiCard label="Hired" value={String(analytics.kpis.hired)} icon={TrendingUp} tone="bg-emerald-100 text-emerald-600" />
            <KpiCard
              label="Offers Accepted"
              value={String(analytics.kpis.offers_accepted)}
              icon={FileCheck2}
              tone="bg-blue-100 text-blue-600"
            />
            <KpiCard
              label="Offers Declined"
              value={String(analytics.kpis.offers_declined)}
              icon={XCircle}
              tone="bg-rose-100 text-rose-600"
            />
            <KpiCard
              label="Offer Acceptance Rate"
              value={analytics.kpis.offer_acceptance_rate === null ? "—" : String(analytics.kpis.offer_acceptance_rate)}
              unit="%"
              icon={Percent}
              tone="bg-amber-100 text-amber-600"
            />
            <KpiCard
              label="Avg. Time to Hire"
              value={analytics.kpis.average_time_to_hire_days === null ? "—" : String(analytics.kpis.average_time_to_hire_days)}
              unit="d"
              icon={Clock}
              tone="bg-indigo-100 text-indigo-600"
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LineChart className="size-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Applications Over Time</CardTitle>
                <CardDescription>New applications by {range === "all" ? "month" : range === "90d" ? "week" : "day"}.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ApplicationsOverTimeChart data={analytics.applications_over_time} range={range} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Applications by Job</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplicationsByJobChart data={analytics.applications_by_job} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Pipeline Distribution</CardTitle>
                <CardDescription>Where every active candidate stands right now — not a conversion funnel.</CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineDistributionChart distribution={analytics.pipeline_distribution} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Offer Outcomes</CardTitle>
              </CardHeader>
              <CardContent>
                <OfferOutcomesChart outcomes={analytics.offer_outcomes} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
