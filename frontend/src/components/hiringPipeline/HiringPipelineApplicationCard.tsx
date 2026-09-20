import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { HiringPipelineApplicationCard as ApplicationCardData } from "@/types/hiringPipelineBoard";

// Same date-only formatting convention already used by
// ApplicationsTable.tsx's own local formatDate.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// IMPORTANT AI language: a coverage score is REQUIRED-SKILL COVERAGE,
// never candidate quality/hiring probability/ranking — see
// ScreeningStatusBadge.tsx and ApplicationsTable.tsx for the same rule
// applied elsewhere. "Not screened" is shown as plain informational text,
// never a fake 0%.
function screeningLabel(screening: ApplicationCardData["screening"]): string {
  if (screening.has_screening && screening.latest_score != null) {
    return `${screening.latest_score}% Skill Coverage`;
  }
  return "Not screened";
}

export interface HiringPipelineApplicationCardProps {
  application: ApplicationCardData;
  onMove: () => void;
}

// The candidate's name is deliberately plain text, not a link — "View
// Application" is the one explicit navigation affordance (matching
// ApplicationsTable.tsx's own pattern), since a card also has an
// interactive Move button and a link wrapping other interactive elements
// is both invalid HTML and an accessibility hazard.
export function HiringPipelineApplicationCard({ application, onMove }: HiringPipelineApplicationCardProps) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div>
          <p className="font-medium text-foreground">{application.candidate.full_name}</p>
          <p className="text-xs text-muted-foreground">{application.candidate.email}</p>
        </div>

        <p className="text-xs text-muted-foreground">Applied {formatDate(application.applied_at)}</p>
        {application.source && <p className="text-xs text-muted-foreground">Source: {application.source}</p>}
        <p className="text-xs text-muted-foreground">{screeningLabel(application.screening)}</p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/applications/${application.id}`}>View Application</Link>
          </Button>
          <Button size="sm" onClick={onMove} aria-label={`Move ${application.candidate.full_name}`}>
            Move
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
