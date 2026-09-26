import type { ReactNode } from "react";
import { ChevronDown, ListFilter, Search, Tags } from "lucide-react";
import { IconInput } from "@/components/ui/icon-input";
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

// A page-scoped select "chip" — deliberately not the shared <Select> (used
// unchanged by several other filter bars app-wide): this toolbar wants a
// taller, icon-led, borderless-inner-control look that would be a visual
// regression everywhere else if made the shared default. Mirrors
// ApplicationsFilterBar.tsx/AssessmentsFilterBar.tsx/InterviewsFilterBar.tsx's
// own FilterChip exactly, for a consistent toolbar language across every
// list page.
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
  icon: typeof Tags;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-3 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:w-56">
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

export function EmailActivityFilterBar({
  searchInput,
  onSearchInputChange,
  type,
  onTypeChange,
  status,
  onStatusChange,
}: EmailActivityFilterBarProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="sm:flex-1">
        <label htmlFor="email-activity-search" className="sr-only">
          Search recipient
        </label>
        <IconInput
          id="email-activity-search"
          icon={Search}
          placeholder="Search recipient..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          className="h-11 rounded-lg border-border bg-white pl-10 text-sm shadow-sm"
        />
      </div>

      <FilterChip id="email-activity-type-filter" label="Filter by type" icon={Tags} value={type} onChange={(v) => onTypeChange(v as EmailActivityType | "")}>
        <option value="">All Types</option>
        {EMAIL_ACTIVITY_TYPES.map((value) => (
          <option key={value} value={value}>
            {TYPE_LABELS[value]}
          </option>
        ))}
      </FilterChip>

      <FilterChip
        id="email-activity-status-filter"
        label="Filter by status"
        icon={ListFilter}
        value={status}
        onChange={(v) => onStatusChange(v as EmailActivityStatus | "")}
      >
        <option value="">All Statuses</option>
        {EMAIL_ACTIVITY_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </FilterChip>
    </div>
  );
}
