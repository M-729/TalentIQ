import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { InterviewsEmptyState } from "@/components/interviews/InterviewsEmptyState";
import { InterviewsFilterBar } from "@/components/interviews/InterviewsFilterBar";
import { InterviewsTable } from "@/components/interviews/InterviewsTable";
import { useInterviews } from "@/hooks/useInterviews";
import { useJobs } from "@/hooks/useJobs";
import type { InterviewStatus } from "@/types/interview";

const PAGE_SIZE = 20;

// Real, company-scoped interview management — never mock data. Tenant
// scope and cross-company access are enforced entirely server-side (see
// GET /api/v1/interviews); this page only ever renders what the backend
// returns for the authenticated caller.
export function InterviewsPage() {
  const [status, setStatus] = useState<InterviewStatus | "">("");
  const [jobId, setJobId] = useState("");
  const [when, setWhen] = useState<"upcoming" | "past" | "">("");
  const [page, setPage] = useState(1);

  const hasActiveFilters = status !== "" || jobId !== "" || when !== "";

  useEffect(() => {
    setPage(1);
  }, [status, jobId, when]);

  const jobsQuery = useJobs();
  const { interviews, pagination, isLoading, error, refetch } = useInterviews({
    status: status || undefined,
    jobId: jobId || undefined,
    when: when || undefined,
    page,
    limit: PAGE_SIZE,
  });

  function clearFilters() {
    setStatus("");
    setJobId("");
    setWhen("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Interviews</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every interview scheduled across your hiring pipelines.</p>
        </div>
      </div>

      <Card className="border-border bg-muted/20">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <InterviewsFilterBar
            status={status}
            onStatusChange={setStatus}
            jobId={jobId}
            onJobIdChange={setJobId}
            when={when}
            onWhenChange={setWhen}
            jobs={jobsQuery.jobs ?? []}
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError title="Couldn't load interviews" message={error} onRetry={refetch} />
      ) : interviews && interviews.length > 0 ? (
        <>
          <InterviewsTable interviews={interviews} />
          {pagination && pagination.totalPages > 1 && (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} onPageChange={setPage} />
          )}
        </>
      ) : (
        <InterviewsEmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  );
}
