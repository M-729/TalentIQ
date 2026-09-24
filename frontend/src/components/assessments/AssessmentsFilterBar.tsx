import { Search } from "lucide-react";
import { IconInput } from "@/components/ui/icon-input";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/layout/FilterBar";
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
    <FilterBar>
      <div className="sm:max-w-xs sm:flex-1">
        <label htmlFor="assessments-search" className="sr-only">
          Search assessments
        </label>
        <IconInput
          id="assessments-search"
          icon={Search}
          placeholder="Search candidate or assessment..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
        />
      </div>

      <div className="sm:w-52">
        <label htmlFor="assessments-job-filter" className="sr-only">
          Filter by job
        </label>
        <Select id="assessments-job-filter" value={jobId} onChange={(e) => onJobIdChange(e.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map((job) => (
            <option key={job._id} value={job._id}>
              {job.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:w-48">
        <label htmlFor="assessments-status-filter" className="sr-only">
          Filter by result status
        </label>
        <Select
          id="assessments-status-filter"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as ApplicationAssessmentStatus | "")}
        >
          <option value="">All Statuses</option>
          {APPLICATION_ASSESSMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </FilterBar>
  );
}
