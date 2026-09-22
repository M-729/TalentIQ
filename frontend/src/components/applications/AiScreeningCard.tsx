import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreeningStatusBadge } from "@/components/applications/ScreeningStatusBadge";
import type { ApplicationDetail } from "@/types/application";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

// Never POSTs from this page — the dedicated screening page
// (ApplicationScreeningPage) is the single place that owns running/
// retrying AI screening; this card only ever links into it, whatever the
// current state. Screening happens once, automatically, right after the
// candidate applies (see this ticket) — there is deliberately no "Run"
// action here for a normal (non-legacy) Application; only a legacy one
// (status: "not_started") still offers to start it.
export function AiScreeningCard({ applicationId, screening }: { applicationId: string; screening: ApplicationDetail["screening"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Screening</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScreeningStatusBadge status={screening.status} />

        {screening.status === "completed" ? (
          <>
            {screening.latest_score != null && (
              <p className="text-sm text-foreground">Required Skill Coverage: {screening.latest_score}%</p>
            )}
            {screening.latest_screened_at && (
              <p className="text-xs text-muted-foreground">Last screened: {formatDateTime(screening.latest_screened_at)}</p>
            )}
            <Button asChild>
              <Link to={`/applications/${applicationId}/screening`}>View AI Screening</Link>
            </Button>
          </>
        ) : screening.status === "processing" || screening.status === "pending" ? (
          <>
            {/* No indefinite spinner/animation implying the page must stay
                open — HR can navigate away and the result will be there
                when they come back. */}
            <p className="text-sm text-muted-foreground">Processing candidate CV…</p>
          </>
        ) : screening.status === "stale_processing" ? (
          <>
            <p className="text-sm text-muted-foreground">Screening was interrupted before it could finish.</p>
            <Button asChild>
              <Link to={`/applications/${applicationId}/screening`}>Retry Screening</Link>
            </Button>
          </>
        ) : screening.status === "failed" ? (
          <>
            <p className="text-sm text-muted-foreground">The initial automatic screening could not be completed.</p>
            <Button asChild>
              <Link to={`/applications/${applicationId}/screening`}>Retry Screening</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Run an AI-assisted analysis of this applicant's submitted CV against the job requirements.
            </p>
            <Button asChild>
              <Link to={`/applications/${applicationId}/screening`}>Run AI Screening</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
