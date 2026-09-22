import { Badge } from "@/components/ui/badge";
import type { ScreeningSummaryStatus } from "@/types/application";

// "Not screened"/"Processing" are neutral gray badges, never red — neither
// is an error or a negative signal: one is just an action HR hasn't taken
// yet (legacy), the other is normal in-progress automatic screening.
// "Needs attention" (failed) and "Interrupted" (stale processing) are the
// only warning-colored states, since those are the cases HR should
// actually act on (Retry Screening).
export function ScreeningStatusBadge({ status }: { status: ScreeningSummaryStatus }) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Screened</Badge>;
    case "processing":
    case "pending":
      return <Badge variant="neutral">Processing</Badge>;
    case "stale_processing":
      return <Badge variant="warning">Interrupted</Badge>;
    case "failed":
      return <Badge variant="warning">Needs attention</Badge>;
    case "not_started":
      return <Badge variant="neutral">Not screened</Badge>;
  }
}
