import { Search } from "lucide-react";
import { IconInput } from "@/components/ui/icon-input";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/layout/FilterBar";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/types/application";
import type { Job } from "@/types/job";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  in_process: "In Process",
  rejected: "Rejected",
  offered: "Offered",
  hired: "Hired",
};

interface ApplicationsFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  jobId: string;
  onJobIdChange: (value: string) => void;
  status: ApplicationStatus | "";
  onStatusChange: (value: ApplicationStatus | "") => void;
  jobs: Job[];
}

export function ApplicationsFilterBar({
  searchInput,
  onSearchInputChange,
  jobId,
  onJobIdChange,
  status,
  onStatusChange,
  jobs,
}: ApplicationsFilterBarProps) {
  return (
    <FilterBar>
      <div className="sm:max-w-xs sm:flex-1">
        <label htmlFor="applications-search" className="sr-only">
          Search applicants
        </label>
        <IconInput
          id="applications-search"
          icon={Search}
          placeholder="Search applicants..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
        />
      </div>

      <div className="sm:w-52">
        <label htmlFor="applications-job-filter" className="sr-only">
          Filter by job
        </label>
        <Select id="applications-job-filter" value={jobId} onChange={(e) => onJobIdChange(e.target.value)}>
          <option value="">All Jobs</option>
          {jobs.map((job) => (
            <option key={job._id} value={job._id}>
              {job.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:w-48">
        <label htmlFor="applications-status-filter" className="sr-only">
          Filter by status
        </label>
        <Select
          id="applications-status-filter"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as ApplicationStatus | "")}
        >
          <option value="">All Statuses</option>
          {APPLICATION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </FilterBar>
  );
}
