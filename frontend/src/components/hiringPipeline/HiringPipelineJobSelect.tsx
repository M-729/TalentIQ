import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useJobs } from "@/hooks/useJobs";

export interface HiringPipelineJobSelectProps {
  value: string | null;
  onChange: (jobId: string | null) => void;
}

// No status filter: normal Jobs API access already excludes soft-deleted
// Jobs by construction, and draft/closed Jobs are still shown deliberately
// — HR may configure a pipeline before publishing, or review a closed
// Job's historical configuration. Nothing here is hard-coded; every option
// comes straight from the authenticated Jobs API.
export function HiringPipelineJobSelect({ value, onChange }: HiringPipelineJobSelectProps) {
  const { jobs, isLoading, error, refetch } = useJobs();

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
        <Button variant="outline" size="sm" onClick={refetch}>
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
          <option key={job._id} value={job._id}>
            {job.title}
          </option>
        ))}
      </Select>
    </div>
  );
}
