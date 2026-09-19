import { Badge } from "@/components/ui/badge";
import type { SkillMatchStatus } from "@/types/screening";

// Color is never the only signal — each badge always renders its text
// label too. "not_found" uses a soft/light destructive tint (matching
// JobStatusBadge's "closed" treatment) rather than an alarming red, since
// this isn't a rejection signal, just "no evidence found".
const STATUS_CONFIG: Record<SkillMatchStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
  found: { label: "Found", variant: "success" },
  unclear: { label: "Unclear", variant: "warning" },
  not_found: { label: "Not found", variant: "destructive" },
};

export function SkillStatusBadge({ status }: { status: SkillMatchStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
