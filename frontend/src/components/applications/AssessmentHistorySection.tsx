import { Check, ClipboardCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyAssessmentLinkButton } from "@/components/applications/CopyAssessmentLinkButton";
import { formatDateTime } from "@/lib/formatDate";
import type { AssessmentEmailStatus, AssessmentHistoryItem, ApplicationAssessmentStatus } from "@/types/applicationAssessment";

const RESULT_CONFIG: Record<ApplicationAssessmentStatus, { label: string; variant: "neutral" | "success" | "destructive" }> = {
  pending: { label: "Pending", variant: "neutral" },
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

// Same leading status-dot treatment as the Interviews section and the
// active assessment card above, so all three read as one workflow.
const STATUS_DOT_STYLES: Record<ApplicationAssessmentStatus, string> = {
  pending: "bg-primary text-primary-foreground",
  passed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
};

const EMAIL_CONFIG: Record<AssessmentEmailStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  pending: { label: "Sending…", variant: "warning" },
};

// Read-only history of every assessment record from stages the candidate
// is no longer on — see this ticket's explicit "preserve assessment
// history visibly, just like Interview history" requirement. Deliberately
// exposes only Open/Copy (safe for authenticated HR — Part 26) alongside
// the recorded outcome; it never offers Add Assessment, Send/Retry, or
// Record Result for a stage the Application isn't currently in, since the
// existing backend rules would reject those anyway.
export function AssessmentHistorySection({ items }: { items: AssessmentHistoryItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ClipboardCheck className="size-4" aria-hidden="true" />
          </span>
          Assessment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-lg border border-border p-3.5">
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${STATUS_DOT_STYLES[item.status]}`}
                aria-hidden="true"
              >
                {item.status === "passed" ? (
                  <Check className="size-3.5" />
                ) : item.status === "failed" ? (
                  <X className="size-3" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{item.name}</p>
                  {item.stage && <span className="text-xs text-muted-foreground">{item.stage.name}</span>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={item.external_url} target="_blank" rel="noopener noreferrer">
                      Open Assessment
                    </a>
                  </Button>
                  <CopyAssessmentLinkButton url={item.external_url} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={RESULT_CONFIG[item.status].variant}>{RESULT_CONFIG[item.status].label}</Badge>
                  {item.grade != null && <span className="text-sm text-foreground">Grade {item.grade}%</span>}
                  {item.email_status && (
                    <Badge variant={EMAIL_CONFIG[item.email_status].variant}>{EMAIL_CONFIG[item.email_status].label}</Badge>
                  )}
                </div>

                {item.notes && <p className="text-sm text-foreground">{item.notes}</p>}

                <p className="text-xs text-muted-foreground">
                  {item.result_recorded_at ? `Result recorded ${formatDateTime(item.result_recorded_at)}` : `Updated ${formatDateTime(item.updated_at)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
