import { ArrowLeft, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import type { ApplicationDetail } from "@/types/application";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
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
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {getInitials(application.candidate.full_name)}
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{application.candidate.full_name}</h1>
              <p className="text-sm text-muted-foreground">Application for {application.job.title}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ApplicationStatusBadge status={application.status} />
                {application.current_step && <Badge variant="neutral">{application.current_step.name}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            Applied {formatDate(application.applied_at)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
