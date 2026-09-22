import { useEffect, useState } from "react";
import { AlertCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentsFilterBar } from "@/components/assessments/AssessmentsFilterBar";
import { AssessmentsTable } from "@/components/assessments/AssessmentsTable";
import { useApplicationAssessmentsList } from "@/hooks/useApplicationAssessmentsList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useJobs } from "@/hooks/useJobs";
import type { ApplicationAssessmentStatus } from "@/types/applicationAssessment";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Couldn't load assessments</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ filtered, onClearFilters }: { filtered: boolean; onClearFilters: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <ClipboardCheck className="size-8 text-muted-foreground" aria-hidden="true" />
        {filtered ? (
          <>
            <p className="text-sm text-muted-foreground">No assessments match your filters.</p>
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No external assessments yet. Add one from a candidate's Application page once they reach an assessment stage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Real, company-scoped assessment management — never mock data. Tenant
// scope and cross-company access are enforced entirely server-side.
export function AssessmentsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<ApplicationAssessmentStatus | "">("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const hasActiveFilters = debouncedSearch.trim() !== "" || jobId !== "" || status !== "";

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, jobId, status]);

  const jobsQuery = useJobs();
  const { assessments, pagination, isLoading, error, refetch } = useApplicationAssessmentsList({
    search: debouncedSearch.trim() || undefined,
    jobId: jobId || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  function clearFilters() {
    setSearchInput("");
    setJobId("");
    setStatus("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Assessments</h1>
        <p className="text-sm text-muted-foreground">External assessments sent to candidates across your hiring pipelines.</p>
      </div>

      <AssessmentsFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        jobId={jobId}
        onJobIdChange={setJobId}
        status={status}
        onStatusChange={setStatus}
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
      ) : assessments && assessments.length > 0 ? (
        <>
          <AssessmentsTable assessments={assessments} />
          {pagination && pagination.totalPages > 1 && (
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
          )}
        </>
      ) : (
        <EmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  );
}
