import { useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader } from "@/components/layout/PageHeader";
import { JobsEmptyState } from "@/components/jobs/JobsEmptyState";
import { JobsStats } from "@/components/jobs/JobsStats";
import { JobsTable } from "@/components/jobs/JobsTable";
import { useJobs } from "@/hooks/useJobs";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/job";

type StatusFilter = "all" | JobStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
];

export function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Kept separate from the table fetch below so the overview counts stay
  // accurate for the whole company regardless of which status is currently
  // filtered in the table — filtering the table must not make "Total Jobs"
  // or the other counts look incomplete.
  const stats = useJobs();
  const table = useJobs(statusFilter === "all" ? undefined : statusFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jobs"
        description="Manage and monitor your company's open positions."
        action={
          <Button asChild>
            <Link to="/jobs/new">
              <Plus className="size-4" aria-hidden="true" />
              Create Job
            </Link>
          </Button>
        }
      />

      {stats.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : stats.error ? (
        <InlineError title="Couldn't load jobs" message={stats.error} onRetry={stats.refetch} />
      ) : (
        <JobsStats jobs={stats.jobs ?? []} />
      )}

      {/* Counts always reflect the full (unfiltered) set fetched above, same
          reasoning as the stat cards — the numbers next to each tab must
          not change just because a different tab is currently selected. */}
      <div role="group" aria-label="Filter jobs by status" className="flex flex-wrap gap-5 border-b border-border">
        {STATUS_FILTERS.map(({ value, label }) => {
          const count = stats.jobs
            ? value === "all"
              ? stats.jobs.length
              : stats.jobs.filter((j) => j.status === value).length
            : undefined;
          const isActive = statusFilter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count !== undefined && <span className="text-xs">({count})</span>}
            </button>
          );
        })}
      </div>

      {table.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : table.error ? (
        <InlineError title="Couldn't load jobs" message={table.error} onRetry={table.refetch} />
      ) : table.jobs && table.jobs.length > 0 ? (
        <JobsTable jobs={table.jobs} />
      ) : (
        <JobsEmptyState filtered={statusFilter !== "all"} />
      )}
    </div>
  );
}
