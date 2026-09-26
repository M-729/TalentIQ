import type { ReactNode } from "react";
import { Briefcase, ChevronDown, ListFilter, Search } from "lucide-react";
import { IconInput } from "@/components/ui/icon-input";
import { jobUrlId } from "@/lib/jobUrlId";
import { APPLICATION_ASSESSMENT_STATUSES, type ApplicationAssessmentStatus } from "@/types/applicationAssessment";
import type { Job } from "@/types/job";

const STATUS_LABELS: Record<ApplicationAssessmentStatus, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
};

export interface AssessmentsFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  jobId: string;
  onJobIdChange: (value: string) => void;
  status: ApplicationAssessmentStatus | "";
  onStatusChange: (value: ApplicationAssessmentStatus | "") => void;
  jobs: Job[];
}

// A page-scoped select "chip" — deliberately not the shared <Select> (used
// unchanged by several other filter bars app-wide): this toolbar wants a
// taller, icon-led, borderless-inner-control look that would be a visual
// regression everywhere else if made the shared default. Mirrors
// ApplicationsFilterBar.tsx's own FilterChip exactly, for a consistent
// toolbar language across both list pages.
function FilterChip({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  icon: typeof Briefcase;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-3 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:w-52">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full flex-1 appearance-none bg-transparent pr-6 text-sm font-medium text-foreground outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

// Deliberately minimal — Job, Result status, and an optional candidate/
// assessment-name search, matching this ticket's explicit "keep it
// compact" instruction.
export function AssessmentsFilterBar({
  searchInput,
  onSearchInputChange,
  jobId,
  onJobIdChange,
  status,
  onStatusChange,
  jobs,
}: AssessmentsFilterBarProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="sm:flex-1">
        <label htmlFor="assessments-search" className="sr-only">
          Search assessments
        </label>
        <IconInput
          id="assessments-search"
          icon={Search}
          placeholder="Search candidate or assessment..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          className="h-11 rounded-lg border-border bg-white pl-10 text-sm shadow-sm"
        />
      </div>

      <FilterChip id="assessments-job-filter" label="Filter by job" icon={Briefcase} value={jobId} onChange={onJobIdChange}>
        <option value="">All Jobs</option>
        {jobs
          .filter((job) => job.public_id)
          .map((job) => (
            <option key={job._id} value={jobUrlId(job)}>
              {job.title}
            </option>
          ))}
      </FilterChip>

      <FilterChip
        id="assessments-status-filter"
        label="Filter by result status"
        icon={ListFilter}
        value={status}
        onChange={(value) => onStatusChange(value as ApplicationAssessmentStatus | "")}
      >
        <option value="">All Statuses</option>
        {APPLICATION_ASSESSMENT_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </FilterChip>
    </div>
  );
}
