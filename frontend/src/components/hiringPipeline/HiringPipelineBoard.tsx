import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { BulkMoveApplicationsDialog } from "@/components/hiringPipeline/BulkMoveApplicationsDialog";
import { HiringPipelineBoardEmptyState } from "@/components/hiringPipeline/HiringPipelineBoardEmptyState";
import { HiringPipelineColumn } from "@/components/hiringPipeline/HiringPipelineColumn";
import { HiringPipelineNeedsAttention } from "@/components/hiringPipeline/HiringPipelineNeedsAttention";
import { HiringPipelineSelectionToolbar } from "@/components/hiringPipeline/HiringPipelineSelectionToolbar";
import { HiringStepTypeBadge } from "@/components/hiringPipeline/HiringStepTypeBadge";
import { MoveApplicationDialog } from "@/components/hiringPipeline/MoveApplicationDialog";
import { PipelineScheduleInterviewGate } from "@/components/interviews/PipelineScheduleInterviewGate";
import { useHiringPipelineBoard } from "@/hooks/useHiringPipelineBoard";
import type { HiringPipelineApplicationCard } from "@/types/hiringPipelineBoard";

const SUCCESS_FLASH_MS = 4000;

interface MoveTarget {
  application: HiringPipelineApplicationCard;
  currentStepId: string | null;
  currentLabel: string;
}

interface ScheduleTarget {
  applicationId: string;
  stepId: string;
  stepName: string;
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <p className="text-sm text-muted-foreground" role="alert">
          {message}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

export interface HiringPipelineBoardProps {
  jobId: string;
  onConfigurePipeline: () => void;
}

// Owns the board fetch and the Move dialog's open/target state. New
// Applicants is a virtual system column — always rendered first, never a
// HiringStep — followed by every configured stage in exactly the order
// the API returns (position ASC; never re-sorted, alphabetized, or
// re-ranked by screening score client-side).
export function HiringPipelineBoard({ jobId, onConfigurePipeline }: HiringPipelineBoardProps) {
  const { board, isLoading, error, refetch } = useHiringPipelineBoard(jobId);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ScheduleTarget | null>(null);
  // Ephemeral UI state only — never persisted to localStorage/the URL, and
  // never carried across a Job change (this component is remounted via
  // `key={selectedJobId}` in HiringPipelinePage.tsx, so a Job switch always
  // starts from an empty Set with no extra code needed here).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false);
  const [successFlash, setSuccessFlash] = useState<string | null>(null);

  // Keeps the selection scoped to candidates that still visibly exist on
  // the board after any refetch (a bulk move, a single move, a retry,
  // or a background poll) — a selected id that quietly disappeared from
  // both New Applicants and every stage (e.g. someone else moved it to a
  // terminal status) is dropped rather than silently kept around.
  useEffect(() => {
    if (!board) return;
    const visibleIds = new Set<string>([
      ...board.unassigned.applications.map((application) => application.id),
      ...board.stages.flatMap((stage) => stage.applications.map((application) => application.id)),
    ]);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [board]);

  useEffect(() => {
    if (!successFlash) return;
    const timeout = window.setTimeout(() => setSuccessFlash(null), SUCCESS_FLASH_MS);
    return () => window.clearTimeout(timeout);
  }, [successFlash]);

  if (isLoading) {
    return <BoardSkeleton />;
  }

  if (error) {
    return <InlineError message={error} onRetry={refetch} />;
  }

  if (!board) {
    return null;
  }

  function toggleApplicationSelected(applicationId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  }

  // Scoped strictly to the column's own applicationIds (see Part 11) —
  // never touches ids from another column. If every one of this column's
  // candidates is already selected, the column deselects; otherwise it
  // selects every one of its own candidates, leaving any other column's
  // selection untouched either way.
  function toggleSelectAllInColumn(applicationIds: string[]) {
    setSelectedIds((current) => {
      const allSelected = applicationIds.length > 0 && applicationIds.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of applicationIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  const currentStepIdByApplicationId = new Map<string, string | null>();
  for (const application of board.unassigned.applications) {
    currentStepIdByApplicationId.set(application.id, null);
  }
  for (const stage of board.stages) {
    for (const application of stage.applications) {
      currentStepIdByApplicationId.set(application.id, stage.id);
    }
  }
  const candidateNameById = new Map<string, string>();
  for (const application of board.unassigned.applications) {
    candidateNameById.set(application.id, application.candidate.full_name);
  }
  for (const stage of board.stages) {
    for (const application of stage.applications) {
      candidateNameById.set(application.id, application.candidate.full_name);
    }
  }
  const selectedApplications = [...selectedIds].map((id) => ({
    id,
    candidateName: candidateNameById.get(id) ?? "This candidate",
    currentStepId: currentStepIdByApplicationId.get(id) ?? null,
  }));

  return (
    <div className="space-y-4">
      {successFlash && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <p>{successFlash}</p>
        </div>
      )}

      <HiringPipelineSelectionToolbar
        selectedCount={selectedIds.size}
        onMoveSelected={() => setBulkMoveDialogOpen(true)}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <HiringPipelineNeedsAttention items={board.needs_attention} />

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{board.job.title}</h2>
          {board.job.status === "closed" && <JobStatusBadge status="closed" />}
        </div>
        {/* Closing a Job stops new candidate intake only — it never
            freezes the existing recruitment workflow. Movement stays
            fully enabled here (never disabled client-side): the backend
            intentionally allows it, and the frontend must not invent a
            business rule the backend doesn't enforce. See task report. */}
        {board.job.status === "closed" && (
          <p className="text-sm text-muted-foreground">
            This job is closed to new applications. Existing applicants can still move through the hiring process.
          </p>
        )}
      </div>

      {board.stages.length === 0 && <HiringPipelineBoardEmptyState onConfigurePipeline={onConfigurePipeline} />}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-fit gap-4">
          <HiringPipelineColumn
            title="New Applicants"
            helperText="Candidates who have applied but have not entered the active hiring process."
            count={board.unassigned.count}
            applications={board.unassigned.applications}
            onMoveApplication={(application) =>
              setMoveTarget({ application, currentStepId: null, currentLabel: "New Applicants" })
            }
            selectedIds={selectedIds}
            onToggleApplicationSelected={toggleApplicationSelected}
            onToggleSelectAll={toggleSelectAllInColumn}
          />

          {board.stages.map((stage) => (
            <HiringPipelineColumn
              key={stage.id}
              title={stage.name}
              typeBadge={<HiringStepTypeBadge type={stage.type} />}
              count={stage.count}
              applications={stage.applications}
              onMoveApplication={(application) =>
                setMoveTarget({ application, currentStepId: stage.id, currentLabel: stage.name })
              }
              stageType={stage.type}
              onScheduleInterview={(application) =>
                setScheduleTarget({ applicationId: application.id, stepId: stage.id, stepName: stage.name })
              }
              selectedIds={selectedIds}
              onToggleApplicationSelected={toggleApplicationSelected}
              onToggleSelectAll={toggleSelectAllInColumn}
            />
          ))}
        </div>
      </div>

      <MoveApplicationDialog
        open={moveTarget !== null}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        application={moveTarget?.application ?? null}
        currentLabel={moveTarget?.currentLabel ?? ""}
        currentStepId={moveTarget?.currentStepId ?? null}
        availableStages={board.stages.map((stage) => ({ id: stage.id, name: stage.name }))}
        onRefetch={refetch}
      />

      <BulkMoveApplicationsDialog
        open={bulkMoveDialogOpen}
        onOpenChange={setBulkMoveDialogOpen}
        jobId={jobId}
        selectedApplications={selectedApplications}
        availableStages={board.stages.map((stage) => ({ id: stage.id, name: stage.name, type: stage.type }))}
        onRefetch={refetch}
        onMoved={(movedCount, targetStepName) => {
          setSelectedIds(new Set());
          setSuccessFlash(`${movedCount} candidate${movedCount === 1 ? "" : "s"} moved to ${targetStepName}.`);
        }}
      />

      {/* Scheduling is always an explicit click here — never triggered by
          moving a card into an interview-type stage. Mounted only while a
          target is set, so it lazily fetches that ONE application's
          interviews on demand rather than for every card up front. */}
      {scheduleTarget && (
        <PipelineScheduleInterviewGate
          applicationId={scheduleTarget.applicationId}
          stepId={scheduleTarget.stepId}
          stepName={scheduleTarget.stepName}
          onClose={() => setScheduleTarget(null)}
          onScheduled={() => {
            setScheduleTarget(null);
            // Only the relevant data — a full board refetch, since a
            // newly scheduled Interview doesn't change this application's
            // stage/position, but this keeps the board's own read-model
            // consistent with anything else that changed.
            refetch();
          }}
        />
      )}
    </div>
  );
}
