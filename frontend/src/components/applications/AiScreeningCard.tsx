import { ArrowRight, Sparkles } from "lucide-react";
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

// A small ring visualizing the SAME latest_score number shown as text below
// it — purely a presentation of real data, never a second/derived metric.
function ScoreRing({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="38" cy="38" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
      <circle
        cx="38"
        cy="38"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="text-primary"
      />
      <text x="38" y="38" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-foreground text-[17px] font-bold" style={{ transformOrigin: "38px 38px" }}>
        {score}%
      </text>
    </svg>
  );
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
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          AI Screening
        </CardTitle>
        <ScreeningStatusBadge status={screening.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        {screening.status === "completed" ? (
          <>
            {screening.latest_score != null && (
              <div className="flex items-center gap-4 rounded-lg border border-border p-4">
                <ScoreRing score={screening.latest_score} />
                <div>
                  <p className="text-sm font-semibold text-foreground">Required Skill Coverage</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    This candidate matches {screening.latest_score}% of the required skills for this role.
                  </p>
                </div>
              </div>
            )}
            {screening.latest_screened_at && (
              <p className="text-xs text-muted-foreground">Last screened: {formatDateTime(screening.latest_screened_at)}</p>
            )}
            <Button asChild>
              <Link to={`/applications/${applicationId}/screening`}>
                View AI Screening <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
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
