import { useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteHiringStepDialog } from "@/components/hiringPipeline/DeleteHiringStepDialog";
import { HiringPipelineEmptyState } from "@/components/hiringPipeline/HiringPipelineEmptyState";
import { HiringStepCard } from "@/components/hiringPipeline/HiringStepCard";
import { HiringStepFormDialog } from "@/components/hiringPipeline/HiringStepFormDialog";
import { HiringStepTypeHelp } from "@/components/hiringPipeline/HiringStepTypeHelp";
import { useHiringSteps } from "@/hooks/useHiringSteps";
import { useReorderHiringSteps } from "@/hooks/useReorderHiringSteps";
import type { HiringStep } from "@/types/hiringStep";

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        <p className="text-sm text-muted-foreground" role="alert">
          {message}
        </p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// Owns everything about listing/creating/editing/reordering/deleting the
// stages of ONE Job. Deliberately separate from HiringPipelinePage (which
// only owns Job selection) so a future "Board" view can sit alongside this
// panel under the same selected Job without this feature being rewritten.
export function PipelineSetupPanel({ jobId }: { jobId: string }) {
  const { steps, isLoading, error, refetch, setSteps } = useHiringSteps(jobId);
  const reorder = useReorderHiringSteps(jobId);

  const [formDialog, setFormDialog] = useState<{ mode: "create" | "edit"; step?: HiringStep } | null>(null);
  const [stepToDelete, setStepToDelete] = useState<HiringStep | null>(null);

  const isMutating = reorder.isReordering;

  async function moveStep(index: number, direction: -1 | 1) {
    if (!steps) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const reordered = [...steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved!);

    const updated = await reorder.run(reordered.map((s) => s.id));
    if (updated) {
      setSteps(updated);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <InlineError message={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Pipeline Setup</h2>
        {steps && steps.length > 0 && (
          <Button onClick={() => setFormDialog({ mode: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Add Stage
          </Button>
        )}
      </div>

      {reorder.error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{reorder.error}</p>
        </div>
      )}

      {!steps || steps.length === 0 ? (
        <HiringPipelineEmptyState onAddFirstStage={() => setFormDialog({ mode: "create" })} />
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <HiringStepCard
              key={step.id}
              step={step}
              displayPosition={index + 1}
              isFirst={index === 0}
              isLast={index === steps.length - 1}
              disabled={isMutating}
              onMoveUp={() => void moveStep(index, -1)}
              onMoveDown={() => void moveStep(index, 1)}
              onEdit={() => setFormDialog({ mode: "edit", step })}
              onDelete={() => setStepToDelete(step)}
            />
          ))}
        </div>
      )}

      <HiringStepTypeHelp />

      <HiringStepFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => !open && setFormDialog(null)}
        jobId={jobId}
        mode={formDialog?.mode ?? "create"}
        step={formDialog?.step}
        onSuccess={refetch}
      />

      <DeleteHiringStepDialog
        open={stepToDelete !== null}
        onOpenChange={(open) => !open && setStepToDelete(null)}
        jobId={jobId}
        step={stepToDelete}
        onSuccess={refetch}
      />
    </div>
  );
}
