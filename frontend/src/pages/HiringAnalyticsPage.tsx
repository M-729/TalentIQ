import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApplicationsByJobChart } from "@/components/analytics/ApplicationsByJobChart";
import { ApplicationsOverTimeChart } from "@/components/analytics/ApplicationsOverTimeChart";
import { OfferOutcomesChart } from "@/components/analytics/OfferOutcomesChart";
import { PipelineDistributionChart } from "@/components/analytics/PipelineDistributionChart";
import { useHiringAnalytics } from "@/hooks/useHiringAnalytics";
import { useJobs } from "@/hooks/useJobs";
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
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
      <PageHeader title="Hiring Analytics" description="Understand your recruitment activity and outcomes." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-52">
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
        <div className="sm:w-56">
          <label htmlFor="analytics-job-filter" className="sr-only">
            Filter by job
          </label>
          <Select id="analytics-job-filter" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">All Jobs</option>
            {(jobsQuery.jobs ?? []).map((job) => (
              <option key={job._id} value={job._id}>
                {job.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError title="Couldn't load analytics" message={error} onRetry={refetch} />
      ) : !analytics ? null : isEmptyCompany ? (
        <EmptyCompanyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard label="Total Applications" value={String(analytics.kpis.total_applications)} />
            <KpiCard label="Hired" value={String(analytics.kpis.hired)} />
            <KpiCard label="Offers Accepted" value={String(analytics.kpis.offers_accepted)} />
            <KpiCard label="Offers Declined" value={String(analytics.kpis.offers_declined)} />
            <KpiCard
              label="Offer Acceptance Rate"
              value={analytics.kpis.offer_acceptance_rate === null ? "—" : `${analytics.kpis.offer_acceptance_rate}%`}
            />
            <KpiCard
              label="Avg. Time to Hire"
              value={analytics.kpis.average_time_to_hire_days === null ? "—" : `${analytics.kpis.average_time_to_hire_days}d`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Applications Over Time</CardTitle>
              <CardDescription>New applications by {range === "all" ? "month" : range === "90d" ? "week" : "day"}.</CardDescription>
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
