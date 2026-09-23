import { Search } from "lucide-react";
import { IconInput } from "@/components/ui/icon-input";
import { Select } from "@/components/ui/select";
import { EMAIL_ACTIVITY_STATUSES, EMAIL_ACTIVITY_TYPES, type EmailActivityStatus, type EmailActivityType } from "@/types/emailActivity";

const TYPE_LABELS: Record<EmailActivityType, string> = {
  interview_scheduled: "Interview Scheduled",
  interview_rescheduled: "Interview Rescheduled",
  interview_cancelled: "Interview Cancelled",
  assessment_invitation: "Assessment Invitation",
  application_rejection: "Application Rejection",
  offer_sent: "Offer",
  company_invitation: "Company Invitation",
};

const STATUS_LABELS: Record<EmailActivityStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
};

export interface EmailActivityFilterBarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  type: EmailActivityType | "";
  onTypeChange: (value: EmailActivityType | "") => void;
  status: EmailActivityStatus | "";
  onStatusChange: (value: EmailActivityStatus | "") => void;
}

export function EmailActivityFilterBar({
  searchInput,
  onSearchInputChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
}: EmailActivityFilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="sm:max-w-xs sm:flex-1">
        <label htmlFor="email-activity-search" className="sr-only">
          Search recipient
        </label>
        <IconInput
          id="email-activity-search"
          icon={Search}
          placeholder="Search recipient..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
        />
      </div>

      <div className="sm:w-56">
        <label htmlFor="email-activity-type-filter" className="sr-only">
          Filter by type
        </label>
        <Select id="email-activity-type-filter" value={type} onChange={(e) => onTypeChange(e.target.value as EmailActivityType | "")}>
          <option value="">All Types</option>
          {EMAIL_ACTIVITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {TYPE_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:w-44">
        <label htmlFor="email-activity-status-filter" className="sr-only">
          Filter by status
        </label>
        <Select id="email-activity-status-filter" value={status} onChange={(e) => onStatusChange(e.target.value as EmailActivityStatus | "")}>
          <option value="">All Statuses</option>
          {EMAIL_ACTIVITY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
