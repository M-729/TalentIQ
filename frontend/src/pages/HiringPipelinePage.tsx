import { useState } from "react";
import { Workflow } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HiringPipelineJobSelect } from "@/components/hiringPipeline/HiringPipelineJobSelect";
import { PipelineSetupPanel } from "@/components/hiringPipeline/PipelineSetupPanel";

// Structured as [Job selector] + [Pipeline Setup] so a future ticket can
// add a candidate Board view alongside Pipeline Setup (e.g. a [Board]
// [Pipeline Setup] tab pair) under this same selected Job, without
// rewriting stage configuration. No fake disabled "Board" tab is added
// here — there is nothing behind it yet.
export function HiringPipelinePage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hiring Pipeline</h1>
        <p className="text-sm text-muted-foreground">Configure the recruitment stages used for each job.</p>
      </div>

      <HiringPipelineJobSelect value={selectedJobId} onChange={setSelectedJobId} />

      {selectedJobId ? (
        <PipelineSetupPanel key={selectedJobId} jobId={selectedJobId} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Workflow className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Select a job to configure its hiring pipeline.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
