import { cn } from "@/lib/utils";
import { HIRING_STEP_TYPE_STYLES } from "@/components/hiringPipeline/HiringStepTypeBadge";
import { HIRING_STEP_TYPES, type HiringStepType } from "@/types/hiringStep";
import type { ApplicationListRow, ApplicationStatus } from "@/types/application";

type TerminalStatus = "rejected" | "offered" | "hired";

// Distinct from HIRING_STEP_TYPE_STYLES's review/interview/assessment/other
// palette on purpose — a terminal outcome is a lifecycle fact, never a
// pipeline stage, and must stay visually distinguishable from "still
// moving through the pipeline" even if a HiringStep type ever reused a
// similar hue. rejected reuses the same red as the existing
// ApplicationStatusBadge; offered/hired are both "success", but
// deliberately two different greens (teal vs a stronger solid green) so
// the two outcomes read as different at a glance.
const TERMINAL_STYLES: Record<TerminalStatus, string> = {
  rejected: "bg-destructive/10 text-destructive",
  offered: "bg-teal-500/10 text-teal-700",
  hired: "bg-success/15 text-success",
};

const TERMINAL_LABELS: Record<TerminalStatus, string> = {
  rejected: "Rejected",
  offered: "Offered",
  hired: "Hired",
};

const NEW_APPLICANT_STYLE = "bg-muted text-muted-foreground";

function isTerminalStatus(status: ApplicationStatus): status is TerminalStatus {
  return status === "rejected" || status === "offered" || status === "hired";
}

// A HiringStep's `type` on these DTOs is typed as a plain string (see
// ApplicationCurrentStepSummary) rather than the strict HiringStepType
// union — it's still always one of the 4 real values in practice (the
// backend enum-validates it), but this guards defensively rather than
// trusting that: an unrecognized value falls back to the same neutral
// "other" gray rather than crashing or rendering unstyled.
function resolveStepTypeStyle(type: string): string {
  return HIRING_STEP_TYPE_STYLES[(HIRING_STEP_TYPES as readonly string[]).includes(type) ? (type as HiringStepType) : "other"];
}

function Pill({ styleClassName, label }: { styleClassName: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", styleClassName)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

// Renders the Applications table's "Pipeline Stage" cell. Application
// .status remains the actual lifecycle/business-rule state elsewhere in
// the app (this component only reads it, never writes or reinterprets
// it) — this is purely presentational:
//   1. A terminal outcome (rejected/offered/hired) always wins, with its
//      own fixed color — current_step may still be set from wherever the
//      candidate was before the outcome was recorded, and that's no
//      longer the useful fact to show.
//   2. Otherwise, a real current_step shows its own NAME (dynamic,
//      HR-chosen) colored by its TYPE (a fixed, small category) — never
//      the reverse. Two stages named differently but both type
//      "interview" always render the same color; two stages that happen
//      to share a name in different Jobs are never assumed related.
//   3. Otherwise (applied, no current_step yet) — "New Applicant", plain
//      neutral gray, matching every other "not yet categorized" state in
//      this app (e.g. HiringStepTypeBadge's own "other").
//   4. A defensive "In Process" fallback for legacy/inconsistent data
//      (in_process with no current_step) — never expected through the
//      normal pipeline UI, styled the same neutral gray as New Applicant.
export function PipelineStageBadge({ application }: { application: Pick<ApplicationListRow, "status" | "current_step"> }) {
  if (isTerminalStatus(application.status)) {
    return <Pill styleClassName={TERMINAL_STYLES[application.status]} label={TERMINAL_LABELS[application.status]} />;
  }

  if (application.current_step) {
    return <Pill styleClassName={resolveStepTypeStyle(application.current_step.type)} label={application.current_step.name} />;
  }

  return <Pill styleClassName={NEW_APPLICANT_STYLE} label={application.status === "applied" ? "New Applicant" : "In Process"} />;
}
