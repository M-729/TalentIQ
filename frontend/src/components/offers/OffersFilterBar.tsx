import { Search } from "lucide-react";
import { IconInput } from "@/components/ui/icon-input";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/layout/FilterBar";
import { jobUrlId } from "@/lib/jobUrlId";
import { OFFER_STATUSES, type OfferStatus } from "@/types/offer";
import type { Job } from "@/types/job";

const STATUS_LABELS: Record<OfferStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export interface OffersFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  jobId: string;
  onJobIdChange: (value: string) => void;
  status: OfferStatus | "";
  onStatusChange: (value: OfferStatus | "") => void;
  jobs: Job[];
}

// Deliberately minimal — Job, Offer status, and an optional candidate/
// offer-title search, matching this ticket's explicit "keep it compact" rule.
export function OffersFilterBar({ searchInput, onSearchInputChange, jobId, onJobIdChange, status, onStatusChange, jobs }: OffersFilterBarProps) {
  return (
    <FilterBar>
      <div className="sm:max-w-xs sm:flex-1">
        <label htmlFor="offers-search" className="sr-only">
          Search offers
        </label>
        <IconInput
          id="offers-search"
          icon={Search}
          placeholder="Search candidate or offer title..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
        />
      </div>

      <div className="sm:w-52">
        <label htmlFor="offers-job-filter" className="sr-only">
          Filter by job
        </label>
        <Select id="offers-job-filter" value={jobId} onChange={(e) => onJobIdChange(e.target.value)}>
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
        <label htmlFor="offers-status-filter" className="sr-only">
          Filter by offer status
        </label>
        <Select id="offers-status-filter" value={status} onChange={(e) => onStatusChange(e.target.value as OfferStatus | "")}>
          <option value="">All Statuses</option>
          {OFFER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </FilterBar>
  );
}
