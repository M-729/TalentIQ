import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatDate";
import type { Screening } from "@/types/screening";

interface ScreeningHistoryListProps {
  screenings: Screening[];
  onSelect: (screeningId: string) => void;
}

// The backend already returns newest first (created_at descending) — this
// renders that order as-is, it never re-sorts or recomputes anything.
export function ScreeningHistoryList({ screenings, onSelect }: ScreeningHistoryListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Screening History</CardTitle>
      </CardHeader>
      <CardContent>
        {screenings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No previous screenings yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {screenings.map((screening) => (
              <li key={screening.id}>
                <button
                  type="button"
                  onClick={() => onSelect(screening.id)}
                  aria-label={`View screening from ${formatDateTime(screening.created_at)}`}
                  className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground">{formatDateTime(screening.created_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {screening.match.scorable
                        ? `${screening.match.score}% coverage · ${screening.match.foundSkills} found · ${screening.match.unclearSkills} unclear · ${screening.match.missingSkills} missing`
                        : "No required skills configured"}
                      {screening.ai_metadata.model ? ` · ${screening.ai_metadata.model}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
