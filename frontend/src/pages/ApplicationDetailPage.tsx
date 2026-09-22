import { AlertCircle, SearchX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiScreeningCard } from "@/components/applications/AiScreeningCard";
import { ApplicationAssessmentSection } from "@/components/applications/ApplicationAssessmentSection";
import { ApplicationDetailHeader } from "@/components/applications/ApplicationDetailHeader";
import { ApplicationInfoCard } from "@/components/applications/ApplicationInfoCard";
import { ApplicationInterviewsSection } from "@/components/applications/ApplicationInterviewsSection";
import { CandidateInfoCard } from "@/components/applications/CandidateInfoCard";
import { CvInfoCard } from "@/components/applications/CvInfoCard";
import { JobInfoCard } from "@/components/applications/JobInfoCard";
import { useApplication } from "@/hooks/useApplication";

export function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { application, isLoading, error, notFound, refetch } = useApplication(applicationId);

  if (!applicationId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-foreground">This application is unavailable.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/applications")}>
              Back to Applications
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Couldn't load this application</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!application) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ApplicationDetailHeader application={application} />

      {/* Two columns on desktop, one column on smaller screens. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CandidateInfoCard candidate={application.candidate} />
        <JobInfoCard job={application.job} />
        <CvInfoCard cv={application.cv} />
        <ApplicationInfoCard application={application} />
      </div>

      <ApplicationInterviewsSection application={application} />

      {/* ApplicationAssessmentSection itself renders nothing unless the
          CURRENT stage is assessment-type — never shown for review/
          interview stages, and never auto-created just because it mounts
          (see this ticket's explicit "no auto-create" rules). */}
      <ApplicationAssessmentSection application={application} />

      <AiScreeningCard applicationId={application.id} screening={application.screening} />
    </div>
  );
}
