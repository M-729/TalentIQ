import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Suggestions are shown as plain text examples only — never created
// automatically. A Job may legitimately have zero stages until HR
// deliberately builds its real pipeline.
const EXAMPLES = ["Application Review", "Technical Assessment", "Interview"];

export function HiringPipelineEmptyState({ onAddFirstStage }: { onAddFirstStage: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Workflow className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">No hiring stages yet</p>
          <p className="text-sm text-muted-foreground">
            Create the stages that match this job's real recruitment process.
          </p>
        </div>
        <Button onClick={onAddFirstStage}>Add First Stage</Button>
        <div className="pt-2 text-xs text-muted-foreground">
          <p>Examples:</p>
          <p>{EXAMPLES.join(" · ")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
