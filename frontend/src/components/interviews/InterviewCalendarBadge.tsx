import { Badge } from "@/components/ui/badge";
import type { CalendarSyncStatus, InterviewCalendar } from "@/types/interview";

// "Not linked" covers both a genuinely un-integrated Interview (calendar:
// null) and the defensive not_connected case, which the backend never
// actually produces once calendar_provider is set (see
// Interview.model.ts's CALENDAR_SYNC_STATUSES doc comment) but is handled
// here rather than assumed impossible.
const SYNC_STATUS_CONFIG: Record<CalendarSyncStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  not_connected: { label: "Not linked", variant: "neutral" },
  pending: { label: "Pending", variant: "warning" },
  synced: { label: "Synced", variant: "success" },
  failed: { label: "Sync issue", variant: "destructive" },
};

export function InterviewCalendarBadge({ calendar }: { calendar: InterviewCalendar | null }) {
  const config = SYNC_STATUS_CONFIG[calendar?.sync_status ?? "not_connected"];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
