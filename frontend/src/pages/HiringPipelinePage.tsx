import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Workflow } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { HiringPipelineBoard } from "@/components/hiringPipeline/HiringPipelineBoard";
import { HiringPipelineJobSelect } from "@/components/hiringPipeline/HiringPipelineJobSelect";
import { HiringPipelineWorkspaceTabs, type HiringPipelineWorkspaceTab } from "@/components/hiringPipeline/HiringPipelineWorkspaceTabs";
import { PipelineSetupPanel } from "@/components/hiringPipeline/PipelineSetupPanel";
import { useJobs } from "@/hooks/useJobs";

const JOB_ID_PARAM = "jobId";

// One workspace: a single shared Job selector, then [Board] [Pipeline
// Setup] tabs both scoped to that same selected Job. Board is the default
// view — the primary recruiter workflow is managing candidates, not
// configuring stages — with Setup one click away. `key={selectedJobId}` on
// each tab's content forces a clean remount (fresh fetch) whenever the
// selected Job changes.
//
// The selected Job lives in the URL (?jobId=...), not component state —
// this is what survives a browser refresh. The Jobs list itself is
// fetched once here (not inside HiringPipelineJobSelect, which is now
// presentational) so a URL-restored jobId can be validated against the
// same authenticated list before it's ever trusted: a jobId that doesn't
// appear there (malformed, another company's, soft-deleted, or simply
// gone) is treated identically to no selection at all and silently
// stripped from the URL — never distinguished, never used to fetch a
// Board. The active tab is deliberately NOT persisted to the URL (Board
// remains the default after every fresh load/refresh) — not clearly
// beneficial enough to justify the extra state surface.
export function HiringPipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { jobs, isLoading, error, refetch } = useJobs();
  const [activeTab, setActiveTab] = useState<HiringPipelineWorkspaceTab>("board");

  const urlJobId = searchParams.get(JOB_ID_PARAM);
  const selectedJobId = jobs && urlJobId && jobs.some((job) => job._id === urlJobId) ? urlJobId : null;

  useEffect(() => {
    // Only ever strips a jobId once the Jobs list has actually loaded and
    // demonstrably does not contain it — never on a transient fetch
    // failure (jobs stays null), which would otherwise throw away the
    // user's intended selection just because of a network blip.
    if (jobs && urlJobId && !selectedJobId) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(JOB_ID_PARAM);
          return next;
        },
        { replace: true }
      );
    }
  }, [jobs, urlJobId, selectedJobId, setSearchParams]);

  function handleSelectJob(jobId: string | null) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (jobId) {
          next.set(JOB_ID_PARAM, jobId);
        } else {
          next.delete(JOB_ID_PARAM);
        }
        return next;
      },
      { replace: true }
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Hiring Pipeline" description="Configure stages and manage applicants through each job's hiring process." />

      <HiringPipelineJobSelect
        value={selectedJobId}
        onChange={handleSelectJob}
        jobs={jobs}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />

      {isLoading || error ? null : !selectedJobId ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Workflow className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Select a job to view its hiring pipeline.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <HiringPipelineWorkspaceTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === "board" ? (
            <HiringPipelineBoard key={selectedJobId} jobId={selectedJobId} onConfigurePipeline={() => setActiveTab("setup")} />
          ) : (
            <PipelineSetupPanel key={selectedJobId} jobId={selectedJobId} />
          )}
        </>
      )}
    </div>
  );
}
