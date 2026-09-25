import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { jobUrlId } from "@/lib/jobUrlId";
import type { Job } from "@/types/job";

export interface HiringPipelineJobSelectProps {
  value: string | null;
  onChange: (jobId: string | null) => void;
  jobs: Job[] | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

// Presentational only — the Jobs list is fetched once by HiringPipelinePage
// (not here) so the page can also validate a URL-restored jobId against
// the same authenticated list before treating it as selected. No status
// filter on that fetch: normal Jobs API access already excludes
// soft-deleted Jobs by construction, and draft/closed Jobs are still shown
// deliberately — HR may configure a pipeline before publishing, or
// continue managing a closed Job's existing applicants. Nothing here is
// hard-coded; every option comes straight from the authenticated Jobs API.
export function HiringPipelineJobSelect({ value, onChange, jobs, isLoading, error, onRetry }: HiringPipelineJobSelectProps) {
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="hiring-pipeline-job">Job</Label>
        <Skeleton className="h-9 w-72" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <span role="alert">{error}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="hiring-pipeline-job">Job</Label>
      <Select
        id="hiring-pipeline-job"
        className="w-full sm:w-72"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select a job…</option>
        {(jobs ?? []).map((job) => (
          <option key={job._id} value={jobUrlId(job)}>
            {job.title}
          </option>
        ))}
      </Select>
    </div>
  );
}
