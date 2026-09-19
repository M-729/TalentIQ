import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { ScreeningStatusBadge } from "@/components/applications/ScreeningStatusBadge";
import type { ApplicationDetail } from "@/types/application";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Answers WHO / FOR WHICH JOB / WHEN / WHAT STATUS at a glance, plus a
// compact AI screening summary — the full AI Screening section below
// (AiScreeningCard) repeats this with more detail (last screened time) as
// part of the structured card layout; this is the quick-glance version.
export function ApplicationDetailHeader({ application }: { application: ApplicationDetail }) {
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" asChild>
        <Link to="/applications">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Applications
        </Link>
      </Button>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{application.candidate.full_name}</h1>
            <p className="text-sm text-muted-foreground">Application for {application.job.title}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>Applied {formatDate(application.applied_at)}</span>
            <span className="flex items-center gap-1.5">
              Status: <ApplicationStatusBadge status={application.status} />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">AI Screening:</span>
            <ScreeningStatusBadge hasScreening={application.screening.has_screening} />
            {application.screening.has_screening && application.screening.latest_score != null && (
              <span className="text-sm text-foreground">
                Required Skill Coverage: {application.screening.latest_score}%
              </span>
            )}
            <Button size="sm" asChild className="ml-auto">
              <Link to={`/applications/${application.id}/screening`}>
                {application.screening.has_screening ? "View AI Screening" : "Run AI Screening"}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
