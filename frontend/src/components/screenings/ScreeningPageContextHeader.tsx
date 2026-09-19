import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import type { ApplicationDetail } from "@/types/application";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface ScreeningPageContextHeaderProps {
  applicationId: string;
  application: ApplicationDetail | null;
  isLoading: boolean;
}

/**
 * Concise candidate/job context for the AI Screening page — deliberately
 * NOT a duplicate of the full Application Detail page, just enough that
 * HR always knows whose CV and which job they're reviewing. Loads
 * independently of the screening data itself (its own isLoading), so
 * neither blocks the other, and never shows incorrect content while
 * loading (a skeleton, not stale/wrong text).
 */
export function ScreeningPageContextHeader({ applicationId, application, isLoading }: ScreeningPageContextHeaderProps) {
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" asChild>
        <Link to={`/applications/${applicationId}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Application
        </Link>
      </Button>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        application && (
          <Card>
            <CardContent className="space-y-2 py-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground">{application.candidate.full_name}</h1>
                <p className="text-sm text-muted-foreground">Application for {application.job.title}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Applied {formatDate(application.applied_at)}</span>
                <span className="flex items-center gap-1.5">
                  Status: <ApplicationStatusBadge status={application.status} />
                </span>
              </div>
            </CardContent>
          </Card>
        )
        // If application context failed to load (error/not found), this
        // silently omits the card rather than showing a second, competing
        // error message — the screening content below already reports its
        // own "This application is unavailable." when relevant.
      )}
    </div>
  );
}
