import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreCoverageBar } from "@/components/screenings/ScoreCoverageBar";
import { formatDateTime } from "@/lib/formatDate";
import type { Screening } from "@/types/screening";

interface ScreeningResultHeaderProps {
  screening: Screening;
  isHistorical: boolean;
  isCreating: boolean;
  createError: string | null;
  showSuccessFlash: boolean;
  /** Omitted in the normal completed-screening workflow (screening happens once, automatically, and the result stays stable) — an administrative rescreen mechanism, if one exists, is out of scope here. When omitted, no Rerun control is rendered at all. */
  onRequestRerun?: () => void;
  onBackToLatest: () => void;
}

export function ScreeningResultHeader({
  screening,
  isHistorical,
  isCreating,
  createError,
  showSuccessFlash,
  onRequestRerun,
  onBackToLatest,
}: ScreeningResultHeaderProps) {
  const { match } = screening;

  return (
    <Card>
      <CardContent className="space-y-4 py-6">
        {isHistorical ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Historical Screening</p>
              <p className="text-sm text-muted-foreground">Screened on {formatDateTime(screening.created_at)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onBackToLatest}>
              Back to Latest
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI Screening</h1>
              <p className="text-sm text-muted-foreground">Last screened: {formatDateTime(screening.created_at)}</p>
            </div>
            {onRequestRerun && (
              <div className="flex flex-col items-end gap-2">
                <Button onClick={onRequestRerun} disabled={isCreating}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {isCreating ? "Analyzing CV and job requirements…" : "Re-run Screening"}
                </Button>
                {showSuccessFlash && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-success" role="status">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    New screening complete
                  </p>
                )}
                {createError && (
                  <p className="max-w-xs text-right text-xs text-destructive" role="alert">
                    {createError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <ScoreCoverageBar match={match} />

        {match.scorable && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-success">{match.foundSkills} Found</span>
            <span className="text-warning">{match.unclearSkills} Unclear</span>
            <span className="text-destructive">{match.missingSkills} Missing</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
