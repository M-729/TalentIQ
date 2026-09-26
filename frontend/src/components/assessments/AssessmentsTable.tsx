import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PipelineStageBadge } from "@/components/applications/PipelineStageBadge";
import { EMAIL_DELIVERY_STATUS_VARIANT } from "@/lib/emailDeliveryStatus";
import { formatDateTime } from "@/lib/formatDate";
import type { AssessmentListRow, ApplicationAssessmentStatus, AssessmentEmailStatus } from "@/types/applicationAssessment";

const RESULT_CONFIG: Record<ApplicationAssessmentStatus, { label: string; variant: "neutral" | "success" | "destructive" }> = {
  pending: { label: "Pending", variant: "neutral" },
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

const EMAIL_CONFIG: Record<AssessmentEmailStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  sent: { label: "Sent", variant: EMAIL_DELIVERY_STATUS_VARIANT.sent },
  failed: { label: "Failed", variant: EMAIL_DELIVERY_STATUS_VARIANT.failed },
  pending: { label: "Sending…", variant: EMAIL_DELIVERY_STATUS_VARIANT.pending },
};

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// A stable per-row tint keyed off the row's own id (never index-based, so a
// row's color never shifts as other rows are added/removed/paginated) —
// purely decorative, no meaning attached to the color itself. Matches
// ApplicationsTable.tsx's own avatarTone exactly, for a consistent look
// across both list pages.
function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

// Professional, compact SaaS density — a plain table, matching
// ApplicationsTable.tsx/InterviewsTable.tsx exactly. No template/question
// management, no charts — see this ticket's explicit "keep it compact" rule.
export function AssessmentsTable({ assessments }: { assessments: AssessmentListRow[] }) {
  return (
    <Card className="overflow-hidden rounded-xl border-border p-0 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-3.5">
                Candidate
              </th>
              <th scope="col" className="px-4 py-3.5">
                Job
              </th>
              <th scope="col" className="px-4 py-3.5">
                Assessment
              </th>
              <th scope="col" className="px-4 py-3.5">
                Pipeline Stage
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5">
                Grade
              </th>
              <th scope="col" className="px-4 py-3.5">
                Email
              </th>
              <th scope="col" className="px-4 py-3.5">
                Updated
              </th>
              <th scope="col" className="px-4 py-3.5 pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-primary/5">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(row.id)}`}
                    >
                      {getInitials(row.candidate.full_name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{row.candidate.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.candidate.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{row.job.title}</td>
                <td className="px-4 py-3.5 text-foreground">{row.name}</td>
                <td className="px-4 py-3.5">
                  <PipelineStageBadge application={{ status: row.application_status, current_step: row.current_step }} />
                </td>
                <td className="px-4 py-3.5">
                  <Badge variant={RESULT_CONFIG[row.status].variant}>{RESULT_CONFIG[row.status].label}</Badge>
                </td>
                <td className="px-4 py-3.5 font-semibold text-foreground">{row.grade != null ? `${row.grade}%` : "—"}</td>
                <td className="px-4 py-3.5">
                  {row.email_status ? (
                    <Badge variant={EMAIL_CONFIG[row.email_status].variant}>{EMAIL_CONFIG[row.email_status].label}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not sent</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-sm text-muted-foreground">{formatDateTime(row.updated_at)}</td>
                <td className="px-4 py-3.5 pr-5 text-right">
                  {row.application_public_id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                      asChild
                    >
                      <Link to={`/applications/${row.application_public_id}`}>
                        View Application <ArrowRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      View Application
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
