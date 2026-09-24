import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EMAIL_DELIVERY_STATUS_VARIANT } from "@/lib/emailDeliveryStatus";
import { formatDateTime } from "@/lib/formatDate";
import type { EmailActivityRow, EmailActivityStatus } from "@/types/emailActivity";

const STATUS_CONFIG: Record<EmailActivityStatus, { label: string; variant: "neutral" | "success" | "destructive" | "warning" }> = {
  pending: { label: "Pending", variant: EMAIL_DELIVERY_STATUS_VARIANT.pending },
  sent: { label: "Sent", variant: EMAIL_DELIVERY_STATUS_VARIANT.sent },
  failed: { label: "Failed", variant: EMAIL_DELIVERY_STATUS_VARIANT.failed },
};

/** Where "View related record" navigates — the closest useful detail page this HR user can already reach, never a raw email viewer (see this ticket's explicit "operational history, not an email viewer" rule). */
function relatedLinkFor(row: EmailActivityRow): string | null {
  if (row.type === "company_invitation") return "/settings/team";
  if (row.related_interview_id) return `/interviews/${row.related_interview_id}`;
  if (row.related_application_id) return `/applications/${row.related_application_id}`;
  return null;
}

export interface EmailActivityTableProps {
  rows: EmailActivityRow[];
  onRetry: (row: EmailActivityRow) => void;
  retryingRowId: string | null;
}

export function EmailActivityTable({ rows, onRetry, retryingRowId }: EmailActivityTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">
                Recipient
              </th>
              <th scope="col" className="px-4 py-2.5">
                Type
              </th>
              <th scope="col" className="px-4 py-2.5">
                Related Record
              </th>
              <th scope="col" className="px-4 py-2.5">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                Sent/Updated
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const link = relatedLinkFor(row);
              return (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5 text-foreground">{row.recipient_email}</td>
                  <td className="px-4 py-2.5 text-foreground">{row.type_label}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.related_label}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={STATUS_CONFIG[row.status].variant}>{STATUS_CONFIG[row.status].label}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(row.sent_at ?? row.updated_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {row.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRetry(row)}
                          disabled={retryingRowId === row.id}
                        >
                          {retryingRowId === row.id ? "Retrying…" : "Retry"}
                        </Button>
                      )}
                      {link && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={link}>View</Link>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
