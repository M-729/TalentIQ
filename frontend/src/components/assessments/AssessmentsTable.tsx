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

// Professional, compact SaaS density — a plain table, matching
// ApplicationsTable.tsx/InterviewsTable.tsx exactly. No template/question
// management, no charts — see this ticket's explicit "keep it compact" rule.
export function AssessmentsTable({ assessments }: { assessments: AssessmentListRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">
                Candidate
              </th>
              <th scope="col" className="px-4 py-2.5">
                Job
              </th>
              <th scope="col" className="px-4 py-2.5">
                Assessment
              </th>
              <th scope="col" className="px-4 py-2.5">
                Pipeline Stage
              </th>
              <th scope="col" className="px-4 py-2.5">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                Grade
              </th>
              <th scope="col" className="px-4 py-2.5">
                Email
              </th>
              <th scope="col" className="px-4 py-2.5">
                Updated
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assessments.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{row.candidate.full_name}</div>
                  <div className="text-xs text-muted-foreground">{row.candidate.email}</div>
                </td>
                <td className="px-4 py-2.5 text-foreground">{row.job.title}</td>
                <td className="px-4 py-2.5 text-foreground">{row.name}</td>
                <td className="px-4 py-2.5">
                  <PipelineStageBadge application={{ status: row.application_status, current_step: row.current_step }} />
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={RESULT_CONFIG[row.status].variant}>{RESULT_CONFIG[row.status].label}</Badge>
                </td>
                <td className="px-4 py-2.5 text-foreground">{row.grade != null ? `${row.grade}%` : "—"}</td>
                <td className="px-4 py-2.5">
                  {row.email_status ? (
                    <Badge variant={EMAIL_CONFIG[row.email_status].variant}>{EMAIL_CONFIG[row.email_status].label}</Badge>
                  ) : (
                    <span className="text-muted-foreground">Not sent</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(row.updated_at)}</td>
                <td className="px-4 py-2.5 text-right">
                  {row.application_public_id ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/applications/${row.application_public_id}`}>View Application</Link>
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
