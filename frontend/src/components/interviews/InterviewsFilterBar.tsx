import type { ReactNode } from "react";
import { Briefcase, CalendarClock, ChevronDown, ListFilter } from "lucide-react";
import { jobUrlId } from "@/lib/jobUrlId";
import { INTERVIEW_STATUSES, type InterviewStatus } from "@/types/interview";
import type { Job } from "@/types/job";

const STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export interface InterviewsFilterBarProps {
  status: InterviewStatus | "";
  onStatusChange: (value: InterviewStatus | "") => void;
  jobId: string;
  onJobIdChange: (value: string) => void;
  when: "upcoming" | "past" | "";
  onWhenChange: (value: "upcoming" | "past" | "") => void;
  jobs: Job[];
}

// A page-scoped select "chip" — deliberately not the shared <Select> (used
// unchanged by several other filter bars app-wide): this toolbar wants a
// taller, icon-led, borderless-inner-control look that would be a visual
// regression everywhere else if made the shared default. Mirrors
// ApplicationsFilterBar.tsx/AssessmentsFilterBar.tsx's own FilterChip
// exactly, for a consistent toolbar language across all three list pages.
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

// Deliberately minimal — status, job, and upcoming/past only, per this
// ticket's "avoid over-engineering filters" instruction. No free-text
// search (the interviews list doesn't need one at this stage).
export function InterviewsFilterBar({
  status,
  onStatusChange,
  jobId,
  onJobIdChange,
  when,
  onWhenChange,
  jobs,
}: InterviewsFilterBarProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <FilterChip
        id="interviews-when-filter"
        label="Filter by time"
        icon={CalendarClock}
        value={when}
        onChange={(value) => onWhenChange(value as "upcoming" | "past" | "")}
      >
        <option value="">All Interviews</option>
        <option value="upcoming">Upcoming</option>
        <option value="past">Past</option>
      </FilterChip>

      <FilterChip id="interviews-job-filter" label="Filter by job" icon={Briefcase} value={jobId} onChange={onJobIdChange}>
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
        id="interviews-status-filter"
        label="Filter by status"
        icon={ListFilter}
        value={status}
        onChange={(value) => onStatusChange(value as InterviewStatus | "")}
      >
        <option value="">All Statuses</option>
        {INTERVIEW_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </FilterChip>
    </div>
  );
}
