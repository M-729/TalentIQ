import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/layout/FilterBar";
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
    <FilterBar>
      <div className="sm:w-48">
        <label htmlFor="interviews-when-filter" className="sr-only">
          Filter by time
        </label>
        <Select id="interviews-when-filter" value={when} onChange={(e) => onWhenChange(e.target.value as "upcoming" | "past" | "")}>
          <option value="">All Interviews</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </Select>
      </div>

      <div className="sm:w-52">
        <label htmlFor="interviews-job-filter" className="sr-only">
          Filter by job
        </label>
        <Select id="interviews-job-filter" value={jobId} onChange={(e) => onJobIdChange(e.target.value)}>
          <option value="">All Jobs</option>
          {jobs
            .filter((job) => job.public_id)
            .map((job) => (
              <option key={job._id} value={jobUrlId(job)}>
                {job.title}
              </option>
            ))}
        </Select>
      </div>

      <div className="sm:w-48">
        <label htmlFor="interviews-status-filter" className="sr-only">
          Filter by status
        </label>
        <Select
          id="interviews-status-filter"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as InterviewStatus | "")}
        >
          <option value="">All Statuses</option>
          {INTERVIEW_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </FilterBar>
  );
}
