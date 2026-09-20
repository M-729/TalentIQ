import { cn } from "@/lib/utils";
import type { HiringStepType } from "@/types/hiringStep";

// Distinct but professional tints per type — workflow categories only,
// never colors that imply candidate quality (matches JobStatusBadge's
// existing "bg-X/10 text-X" soft-tint pattern). review/other reuse this
// codebase's existing neutral/blue-ish tokens where one fits; interview
// has no existing semantic token, so it uses Tailwind's own default
// purple palette rather than inventing a new custom color.
const TYPE_STYLES: Record<HiringStepType, string> = {
  review: "bg-blue-500/10 text-blue-700",
  interview: "bg-purple-500/10 text-purple-700",
  assessment: "bg-warning/10 text-warning",
  other: "bg-muted text-muted-foreground",
};

const TYPE_LABELS: Record<HiringStepType, string> = {
  review: "Review",
  interview: "Interview",
  assessment: "Assessment",
  other: "Other",
};

export function HiringStepTypeBadge({ type }: { type: HiringStepType }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TYPE_STYLES[type])}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {TYPE_LABELS[type]}
    </span>
  );
}
