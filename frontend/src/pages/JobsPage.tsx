import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsEmptyState } from "@/components/jobs/JobsEmptyState";
import { JobsStats } from "@/components/jobs/JobsStats";
import { JobsTable } from "@/components/jobs/JobsTable";
import { useJobs } from "@/hooks/useJobs";
import type { JobStatus } from "@/types/job";

type StatusFilter = "all" | JobStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
];

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Couldn't load jobs</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Kept separate from the table fetch below so the overview counts stay
  // accurate for the whole company regardless of which status is currently
  // filtered in the table — filtering the table must not make "Total Jobs"
  // or the other counts look incomplete.
  const stats = useJobs();
  const table = useJobs(statusFilter === "all" ? undefined : statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground">Manage and monitor your company's open positions.</p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">
            <Plus className="size-4" aria-hidden="true" />
            Create Job
          </Link>
        </Button>
      </div>

      {stats.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : stats.error ? (
        <InlineError message={stats.error} onRetry={stats.refetch} />
      ) : (
        <JobsStats jobs={stats.jobs ?? []} />
      )}

      <div role="group" aria-label="Filter jobs by status" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={statusFilter === value ? "default" : "outline"}
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {table.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : table.error ? (
        <InlineError message={table.error} onRetry={table.refetch} />
      ) : table.jobs && table.jobs.length > 0 ? (
        <JobsTable jobs={table.jobs} />
      ) : (
        <JobsEmptyState filtered={statusFilter !== "all"} />
      )}
    </div>
  );
}
