import { AlertCircle, SearchX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AiScreeningCard } from "@/components/applications/AiScreeningCard";
import { ApplicationAssessmentSection } from "@/components/applications/ApplicationAssessmentSection";
import { ApplicationDetailHeader } from "@/components/applications/ApplicationDetailHeader";
import { ApplicationDetailsPanel } from "@/components/applications/ApplicationDetailsPanel";
import { ApplicationInterviewsSection } from "@/components/applications/ApplicationInterviewsSection";
import { JobInfoCard } from "@/components/applications/JobInfoCard";
import { OfferDecisionSection } from "@/components/applications/OfferDecisionSection";
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
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-foreground" role="alert">This application is unavailable.</p>
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
      <div className="mx-auto max-w-6xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            <div role="alert">
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
    <div className="mx-auto max-w-6xl space-y-6">
      <ApplicationDetailHeader application={application} />

      {/* Primary review column (AI screening -> interviews -> assessment ->
          final decision, in the order a recruiter actually works through
          them) plus a narrower context column of reference-only info.
          Single column on smaller screens, primary content first either
          way since it's the first DOM child. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AiScreeningCard applicationId={application.id} screening={application.screening} />

          <ApplicationInterviewsSection application={application} />

          {/* ApplicationAssessmentSection itself renders nothing unless the
              CURRENT stage is assessment-type — never shown for review/
              interview stages, and never auto-created just because it
              mounts (see this ticket's explicit "no auto-create" rules). */}
          <ApplicationAssessmentSection application={application} />

          {/* Every final hiring outcome (Reject, Offer, Accept/Decline,
              Hire) is an explicit HR action here — always rendered,
              regardless of the Application's current pipeline stage. */}
          <OfferDecisionSection application={application} onApplicationChanged={refetch} />
        </div>

        <div className="space-y-6">
          <ApplicationDetailsPanel candidate={application.candidate} cv={application.cv} source={application.source} />
          <JobInfoCard job={application.job} />
        </div>
      </div>
    </div>
  );
}
