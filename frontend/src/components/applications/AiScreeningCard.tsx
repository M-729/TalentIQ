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

// Never POSTs from this page — the screening page is the single place
// that owns running/re-running AI screening. This card only ever links
// into it, whether the applicant is unscreened or already screened.
export function AiScreeningCard({ applicationId, screening }: { applicationId: string; screening: ApplicationDetail["screening"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Screening</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScreeningStatusBadge hasScreening={screening.has_screening} />

        {screening.has_screening ? (
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
