import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatDate";
import type { Screening } from "@/types/screening";

// De-emphasized on purpose — provider/model are useful for auditability,
// not something HR needs to make a decision from, so this is small and
// placed at the bottom of the page rather than being visually prominent.
export function ScreeningDetailsCard({ screening }: { screening: Screening }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Screening details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-foreground">{formatDateTime(screening.created_at)}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">AI provider</dt>
            <dd className="text-foreground">{screening.ai_metadata.provider}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Model</dt>
            <dd className="text-foreground">{screening.ai_metadata.model ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 sm:block">
            <dt className="text-muted-foreground">Scoring formula</dt>
            <dd className="text-foreground">{screening.score_formula_version}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
