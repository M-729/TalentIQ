import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleInterviewDialog } from "@/components/interviews/ScheduleInterviewDialog";
import { useApplicationInterviews } from "@/hooks/useApplicationInterviews";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { Interview } from "@/types/interview";

export interface PipelineScheduleInterviewGateProps {
  applicationId: string;
  /** The current interview-type HiringStep the card is sitting in. */
  stepId: string;
  stepName: string;
  onClose: () => void;
  onScheduled: (interview: Interview) => void;
}

// Triggered only by an explicit "Schedule Interview" click on the pipeline
// board (see HiringPipelineApplicationCard) — never fetched for every
// card up front, which would be an N+1 request pattern on initial board
// render. This lazily loads exactly one Application's interviews, and
// only once the user has actually asked to schedule one.
export function PipelineScheduleInterviewGate({
  applicationId,
  stepId,
  stepName,
  onClose,
  onScheduled,
}: PipelineScheduleInterviewGateProps) {
  const { interviews, isLoading, error } = useApplicationInterviews(applicationId);
  const navigate = useNavigate();

  const existing = interviews?.find((interview) => interview.stage.id === stepId && interview.status === "scheduled") ?? null;

  useEffect(() => {
    if (existing) {
      onClose();
      navigate(`/interviews/${resourceUrlId(existing)}`);
    }
    // Only re-run when the resolved existing-interview id actually
    // changes — re-running on every onClose/navigate identity change
    // would immediately re-navigate/close in a loop.
  }, [existing?.id, onClose, navigate]);

  if (isLoading || existing) {
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription className="sr-only">Checking whether this candidate already has a scheduled interview.</DialogDescription>
          </DialogHeader>
          <Skeleton className="h-24 w-full" />
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription className="sr-only">There was a problem checking this candidate's existing interview.</DialogDescription>
          </DialogHeader>
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  // No active interview exists yet for this exact stage — open the real
  // scheduling form.
  return (
    <ScheduleInterviewDialog
      open
      onOpenChange={(next) => !next && onClose()}
      applicationId={applicationId}
      defaultTitle={stepName}
      onScheduled={onScheduled}
    />
  );
}
