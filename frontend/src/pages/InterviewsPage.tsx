import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewsEmptyState } from "@/components/interviews/InterviewsEmptyState";
import { InterviewsFilterBar } from "@/components/interviews/InterviewsFilterBar";
import { InterviewsTable } from "@/components/interviews/InterviewsTable";
import { useInterviews } from "@/hooks/useInterviews";
import { useJobs } from "@/hooks/useJobs";
import type { InterviewStatus } from "@/types/interview";

const PAGE_SIZE = 20;

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Couldn't load interviews</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Interviews</h1>
        <p className="text-sm text-muted-foreground">Every interview scheduled across your hiring pipelines.</p>
      </div>

      <InterviewsFilterBar
        status={status}
        onStatusChange={setStatus}
        jobId={jobId}
        onJobIdChange={setJobId}
        when={when}
        onWhenChange={setWhen}
        jobs={jobsQuery.jobs ?? []}
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError message={error} onRetry={refetch} />
      ) : interviews && interviews.length > 0 ? (
        <>
          <InterviewsTable interviews={interviews} />
          {pagination && pagination.totalPages > 1 && (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
          )}
        </>
      ) : (
        <InterviewsEmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  );
}
