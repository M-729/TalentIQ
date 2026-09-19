import type { ScreeningMatch } from "@/types/screening";

// The primary purple is used deliberately (per design guidance) — this is
// a coverage measurement, not a good/bad judgment, so it never uses
// red/amber/green the way individual skill-status badges do.
export function ScoreCoverageBar({ match }: { match: ScreeningMatch }) {
  if (!match.scorable) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground">Required Skill Coverage</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This job has no required skills configured, so a coverage score can't be calculated.
        </p>
      </div>
    );
  }

  const score = match.score ?? 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-foreground">Required Skill Coverage</p>
        <p className="text-2xl font-semibold text-foreground">{score}%</p>
      </div>
      <div
        role="progressbar"
        aria-label="Required skill coverage"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Calculated from evidence found for this job's configured required skills.
      </p>
    </div>
  );
}
