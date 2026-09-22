import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Job } from "@/types/job";

// The public Careers detail route — see routes/router.tsx. Kept in one
// place so this action and PublicJobPage/ApplyPage's own internal links
// can never drift from each other.
export function publicJobPath(jobId: string): string {
  return `/careers/jobs/${jobId}`;
}

function unavailabilityReason(status: Job["status"]): string {
  switch (status) {
    case "draft":
      return "This job is still a draft — publish it (set status to Active) to make it publicly visible.";
    case "closed":
      return "This job is closed and is no longer publicly visible to candidates.";
    case "active":
      return "";
  }
}

// Only ever renders a real, clickable public link for a Job that is
// ACTUALLY publicly reachable right now (status "active" — the exact same
// rule backend/src/modules/publicJobs/publicJob.service.ts enforces
// server-side). For draft/closed Jobs this deliberately shows why the link
// isn't available instead of a link that would 404 for a candidate.
export function PublicJobLinkAction({ job }: { job: Job }) {
  const [copied, setCopied] = useState(false);

  if (job.status !== "active") {
    return <p className="text-xs text-muted-foreground">{unavailabilityReason(job.status)}</p>;
  }

  const path = publicJobPath(job._id);
  const url = `${window.location.origin}${path}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied/unavailable (permissions, non-secure
      // context) — a failed copy is a minor inconvenience, never worth
      // surfacing as an error state on this page.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={path} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="size-4" aria-hidden="true" />
          View Public Job
        </a>
      </Button>
      <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
        <Copy className="size-4" aria-hidden="true" />
        {copied ? "Link copied!" : "Copy Public Link"}
      </Button>
    </div>
  );
}
