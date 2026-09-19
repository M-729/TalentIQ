import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { ApplicationsEmptyState } from "@/components/applications/ApplicationsEmptyState";
import { ApplicationsFilterBar } from "@/components/applications/ApplicationsFilterBar";
import { ApplicationsTable } from "@/components/applications/ApplicationsTable";
import { useApplications } from "@/hooks/useApplications";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useJobs } from "@/hooks/useJobs";
import type { ApplicationStatus } from "@/types/application";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Couldn't load applications</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function ApplicationsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const hasActiveFilters = debouncedSearch.trim() !== "" || jobId !== "" || status !== "";

  // Any filter change should return to page 1 — otherwise a narrower
  // filter could leave the user stranded on a now out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, jobId, status]);

  // Company jobs only, via the existing authenticated Jobs API — no new
  // backend endpoint for this dropdown.
  const jobsQuery = useJobs();

  const applications = useApplications({
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Applications</h1>
        <p className="text-sm text-muted-foreground">Review and manage candidates who have applied to your open positions.</p>
      </div>

      <ApplicationsFilterBar
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        jobId={jobId}
        onJobIdChange={setJobId}
        status={status}
        onStatusChange={setStatus}
        jobs={jobsQuery.jobs ?? []}
      />

      {applications.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : applications.error ? (
        <InlineError message={applications.error} onRetry={applications.refetch} />
      ) : applications.applications && applications.applications.length > 0 ? (
        <>
          <ApplicationsTable applications={applications.applications} />
          {applications.pagination && applications.pagination.totalPages > 1 && (
            <Pagination page={applications.pagination.page} totalPages={applications.pagination.totalPages} onPageChange={setPage} />
          )}
        </>
      ) : (
        <ApplicationsEmptyState filtered={hasActiveFilters} onClearFilters={clearFilters} />
      )}
    </div>
  );
}
