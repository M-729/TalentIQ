import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import type { ApplicationDetail } from "@/types/application";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Answers WHO / FOR WHICH JOB / CURRENT STAGE / STATUS / WHEN at a glance —
// compact by design so it never competes with the review content below it.
// AI screening used to be quick-glanced here too, but that duplicated
// AiScreeningCard (now the first card a recruiter sees) for no real benefit,
// so it was removed from here rather than kept in two places.
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
        <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{application.candidate.full_name}</h1>
            <p className="text-sm text-muted-foreground">Application for {application.job.title}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>Applied {formatDate(application.applied_at)}</span>
            {application.current_step && <span>Stage: {application.current_step.name}</span>}
            <span className="flex items-center gap-1.5">
              Status: <ApplicationStatusBadge status={application.status} />
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
