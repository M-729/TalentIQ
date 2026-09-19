import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkillStatusBadge } from "@/components/screenings/SkillStatusBadge";
import type { ScreeningMatchBreakdownEntry, SkillMatchStatus } from "@/types/screening";

const NO_EVIDENCE_TEXT: Record<SkillMatchStatus, string> = {
  found: "No additional evidence details were provided.",
  not_found: "No direct evidence found in the submitted CV.",
  unclear: "Evidence was inconclusive in the submitted CV.",
};

export function RequiredSkillBreakdown({ breakdown }: { breakdown: ScreeningMatchBreakdownEntry[] }) {
  if (breakdown.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Required Skill Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mathematical weights (1 / 0.5 / 0) are intentionally not shown
            here — HR needs the evidence and status, not the scoring
            internals. */}
        {breakdown.map((entry) => (
          <div
            key={entry.skill}
            className="flex flex-col gap-1.5 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="flex items-center gap-2 sm:w-1/3 sm:shrink-0">
              <span className="font-medium text-foreground">{entry.skill}</span>
            </div>
            <div className="flex-1 space-y-1">
              <SkillStatusBadge status={entry.status} />
              <p className="text-sm text-muted-foreground">{entry.evidence ?? NO_EVIDENCE_TEXT[entry.status]}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
