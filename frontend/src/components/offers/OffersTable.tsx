import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/formatDate";
import type { OfferListRow, OfferStatus } from "@/types/offer";

const STATUS_CONFIG: Record<OfferStatus, { label: string; variant: "neutral" | "success" | "destructive" | "warning" }> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Sent", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "neutral" },
};

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatSalary(row: OfferListRow): string {
  if (row.salary_amount == null || !row.salary_currency) return "—";
  return `${row.salary_amount.toLocaleString()} ${row.salary_currency}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// A stable per-row tint keyed off the row's own id (never index-based, so a
// row's color never shifts as other rows are added/removed/paginated) —
// purely decorative, no meaning attached to the color itself. Matches
// ApplicationsTable.tsx/AssessmentsTable.tsx/InterviewsTable.tsx's own
// avatarTone exactly, for a consistent look across every list page.
function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

// Professional, compact SaaS density — a plain table, matching
// AssessmentsTable.tsx/ApplicationsTable.tsx exactly. No charts, no PDF
// export — see this ticket's explicit "keep it compact, no charts" rule.
export function OffersTable({ offers }: { offers: OfferListRow[] }) {
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
                Offer
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5">
                Salary
              </th>
              <th scope="col" className="px-4 py-3.5">
                Start Date
              </th>
              <th scope="col" className="px-4 py-3.5">
                Sent
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
            {offers.map((row) => (
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
                <td className="px-4 py-3.5 text-foreground">{row.title}</td>
                <td className="px-4 py-3.5">
                  <Badge variant={STATUS_CONFIG[row.status].variant}>{STATUS_CONFIG[row.status].label}</Badge>
                </td>
                <td className="px-4 py-3.5 text-sm font-bold text-foreground">{formatSalary(row)}</td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-muted-foreground">{row.start_date ? formatDate(row.start_date) : "—"}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-muted-foreground">{row.sent_at ? formatDate(row.sent_at) : "—"}</span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-muted-foreground">{formatDateTime(row.updated_at)}</span>
                </td>
                <td className="px-4 py-3.5 pr-5 text-right">
                  {row.application_public_id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                      asChild
                    >
                      <Link to={`/applications/${row.application_public_id}`}>
                        <Eye className="size-3.5" aria-hidden="true" />
                        View Application
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
