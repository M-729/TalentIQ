import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/formatDate";
import type {
  AssessmentSummary,
  HiringPipelineApplicationCard as ApplicationCardData,
  InterviewSummary,
} from "@/types/hiringPipelineBoard";

// Same date-only formatting convention already used by
// ApplicationsTable.tsx's own local formatDate.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Exact copy per state, deliberately compact (a single line, or two for
// scheduled/completed which have one extra fact worth showing). Interview
// .status is always the persisted, authoritative value here — this never
// infers "Completed" from starts_at/ends_at having passed, and never
// renders a Join Meet/interview-action affordance (Pipeline is status/
// triage only; real interview actions stay on Interview/Application detail).
function InterviewStatusLine({ summary }: { summary: InterviewSummary }) {
  switch (summary.status) {
    case "not_scheduled":
      return <p className="text-xs text-muted-foreground">Interview · Not scheduled</p>;
    case "scheduled":
      return (
        <p className="text-xs text-muted-foreground">
          Interview · Scheduled
          {summary.starts_at && <span className="block">{formatDateTime(summary.starts_at)}</span>}
        </p>
      );
    case "completed":
      return (
        <p className="text-xs text-muted-foreground">
          Interview · Completed
          {summary.feedback_total_count != null && (
            <span className="block">
              Feedback {summary.feedback_submitted_count ?? 0}/{summary.feedback_total_count}
            </span>
          )}
        </p>
      );
    case "cancelled":
      return <p className="text-xs text-muted-foreground">Interview · Cancelled</p>;
  }
}

// Exact copy per state (see this ticket's explicit Part 21). `status` is
// always the persisted ApplicationAssessment.status — grade is a
// hand-entered percentage HR chose, never derived from status. The
// "Email needs attention" hint is deliberately narrow: only while the
// result is STILL pending (once a result exists, the email outcome is no
// longer the most useful fact on a compact card) and only ever one extra
// short line, never a second badge/button (Pipeline is status/triage
// only — retry lives on Application Detail).
function AssessmentStatusLine({ summary }: { summary: AssessmentSummary }) {
  const emailNeedsAttention = summary.status === "pending" && summary.email_status === "failed";

  switch (summary.status) {
    case "not_configured":
      return <p className="text-xs text-muted-foreground">Assessment · Not configured</p>;
    case "pending":
      return (
        <p className="text-xs text-muted-foreground">
          Assessment · Pending
          {emailNeedsAttention && <span className="block">Email needs attention</span>}
        </p>
      );
    case "passed":
    case "failed":
      return (
        <p className="text-xs text-muted-foreground">
          Assessment · {summary.status === "passed" ? "Passed" : "Failed"}
          {summary.grade != null && <span className="block">Grade {summary.grade}%</span>}
        </p>
      );
  }
}

// IMPORTANT AI language: a coverage score is REQUIRED-SKILL COVERAGE,
// never candidate quality/hiring probability/ranking — see
// ScreeningStatusBadge.tsx and ApplicationsTable.tsx for the same rule
// applied elsewhere. "Not screened" is shown as plain informational text,
// never a fake 0%.
function screeningLabel(screening: ApplicationCardData["screening"]): string {
  switch (screening.status) {
    case "completed":
      return screening.latest_score != null ? `AI Match ${screening.latest_score}%` : "Screened";
    case "processing":
    case "pending":
      return "AI Screening · Processing";
    case "stale_processing":
    case "failed":
      return "AI Screening · Needs attention";
    case "not_started":
      return "Not screened";
  }
}

export interface HiringPipelineApplicationCardProps {
  application: ApplicationCardData;
  onMove: () => void;
  /** Present only for a card currently sitting in an interview-type stage — see HiringPipelineColumn's stageType prop. Never renders a Schedule Interview action otherwise. */
  onScheduleInterview?: () => void;
  /** Omitted entirely (no checkbox rendered) for a card that can never be bulk-selected — currently every card the board renders is movable, but this keeps the card itself the source of truth rather than the column guessing. */
  selected?: boolean;
  onToggleSelected?: () => void;
}

// The candidate's name is deliberately plain text, not a link — "View
// Application" is the one explicit navigation affordance (matching
// ApplicationsTable.tsx's own pattern), since a card also has an
// interactive Move button and a link wrapping other interactive elements
// is both invalid HTML and an accessibility hazard.
export function HiringPipelineApplicationCard({
  application,
  onMove,
  onScheduleInterview,
  selected,
  onToggleSelected,
}: HiringPipelineApplicationCardProps) {
  const selectable = onToggleSelected !== undefined;
  return (
    <Card className={selected ? "border-primary ring-1 ring-primary" : undefined}>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start gap-2">
          {selectable && (
            <Checkbox
              checked={!!selected}
              onChange={onToggleSelected}
              aria-label={`Select ${application.candidate.full_name}`}
              className="mt-0.5"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">{application.candidate.full_name}</p>
            <p className="text-xs text-muted-foreground">{application.candidate.email}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Applied {formatDate(application.applied_at)}</p>
        {application.source && <p className="text-xs text-muted-foreground">Source: {application.source}</p>}
        <p className="text-xs text-muted-foreground">{screeningLabel(application.screening)}</p>
        {application.interview_summary && <InterviewStatusLine summary={application.interview_summary} />}
        {application.assessment_summary && <AssessmentStatusLine summary={application.assessment_summary} />}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/applications/${application.id}`}>View Application</Link>
          </Button>
          {/* Outline, matching the other card actions — discoverable but
              secondary to the candidate's own identity, not a filled
              primary button competing for attention on a dense board. */}
          <Button variant="outline" size="sm" onClick={onMove} aria-label={`Move ${application.candidate.full_name}`}>
            Move
          </Button>
          {onScheduleInterview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onScheduleInterview}
              aria-label={`Schedule interview for ${application.candidate.full_name}`}
            >
              Schedule Interview
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
