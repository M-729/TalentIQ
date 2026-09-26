import {
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  Eye,
  FileSignature,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EMAIL_DELIVERY_STATUS_VARIANT } from "@/lib/emailDeliveryStatus";
import { formatDateTime } from "@/lib/formatDate";
import type { EmailActivityRow, EmailActivityStatus, EmailActivityType } from "@/types/emailActivity";

const STATUS_CONFIG: Record<EmailActivityStatus, { label: string; variant: "neutral" | "success" | "destructive" | "warning" }> = {
  pending: { label: "Pending", variant: EMAIL_DELIVERY_STATUS_VARIANT.pending },
  sent: { label: "Sent", variant: EMAIL_DELIVERY_STATUS_VARIANT.sent },
  failed: { label: "Failed", variant: EMAIL_DELIVERY_STATUS_VARIANT.failed },
};

// Purely decorative per-type icon/tint over the real `type_label` text —
// never a second label, never implying a type the row doesn't actually
// have.
const TYPE_ICON_CONFIG: Record<EmailActivityType, { icon: LucideIcon; tone: string }> = {
  interview_scheduled: { icon: CalendarClock, tone: "bg-blue-100 text-blue-600" },
  interview_rescheduled: { icon: CalendarClock, tone: "bg-amber-100 text-amber-600" },
  interview_cancelled: { icon: CalendarX, tone: "bg-rose-100 text-rose-600" },
  assessment_invitation: { icon: ClipboardCheck, tone: "bg-violet-100 text-violet-600" },
  application_rejection: { icon: XCircle, tone: "bg-rose-100 text-rose-600" },
  offer_sent: { icon: FileSignature, tone: "bg-emerald-100 text-emerald-600" },
  company_invitation: { icon: UserPlus, tone: "bg-indigo-100 text-indigo-600" },
};

/** Where "View related record" navigates — the closest useful detail page this HR user can already reach, never a raw email viewer (see this ticket's explicit "operational history, not an email viewer" rule). */
function relatedLinkFor(row: EmailActivityRow): string | null {
  if (row.type === "company_invitation") return "/settings/team";
  // public_id is always populated for these resources post-migration — if
  // it's ever unexpectedly missing, show no link rather than construct a
  // Mongo ObjectId URL (see lib/resourceUrlId.ts's own fail-safe rule).
  if (row.related_interview_id) return row.related_interview_public_id ? `/interviews/${row.related_interview_public_id}` : null;
  if (row.related_application_id) return row.related_application_public_id ? `/applications/${row.related_application_public_id}` : null;
  return null;
}

export interface EmailActivityTableProps {
  rows: EmailActivityRow[];
  onRetry: (row: EmailActivityRow) => void;
  retryingRowId: string | null;
}

export function EmailActivityTable({ rows, onRetry, retryingRowId }: EmailActivityTableProps) {
  return (
    <Card className="overflow-hidden rounded-xl border-border p-0 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-3.5">
                Recipient
              </th>
              <th scope="col" className="px-4 py-3.5">
                Type
              </th>
              <th scope="col" className="px-4 py-3.5">
                Related Record
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5">
                Sent/Updated
              </th>
              <th scope="col" className="px-4 py-3.5 pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const link = relatedLinkFor(row);
              const { icon: TypeIcon, tone } = TYPE_ICON_CONFIG[row.type];
              return (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-primary/5">
                  <td className="px-5 py-3.5 font-medium text-foreground">{row.recipient_email}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${tone}`}>
                        <TypeIcon className="size-3.5" aria-hidden="true" />
                      </span>
                      <span className="font-medium text-foreground">{row.type_label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{row.related_label}</td>
                  <td className="px-4 py-3.5">
                    <Badge variant={STATUS_CONFIG[row.status].variant}>{STATUS_CONFIG[row.status].label}</Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm text-muted-foreground">{formatDateTime(row.sent_at ?? row.updated_at)}</span>
                  </td>
                  <td className="px-4 py-3.5 pr-5 text-right">
                    <div className="flex justify-end gap-2">
                      {row.status === "failed" && (
                        <Button variant="outline" size="sm" onClick={() => onRetry(row)} disabled={retryingRowId === row.id}>
                          {retryingRowId === row.id ? "Retrying…" : "Retry"}
                        </Button>
                      )}
                      {link && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                          asChild
                        >
                          <Link to={link}>
                            <Eye className="size-3.5" aria-hidden="true" />
                            View
                          </Link>
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
