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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatSalary(row: OfferListRow): string {
  if (row.salary_amount == null || !row.salary_currency) return "—";
  return `${row.salary_amount.toLocaleString()} ${row.salary_currency}`;
}

// Professional, compact SaaS density — a plain table, matching
// AssessmentsTable.tsx/ApplicationsTable.tsx exactly. No charts, no PDF
// export — see this ticket's explicit "keep it compact, no charts" rule.
export function OffersTable({ offers }: { offers: OfferListRow[] }) {
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
                Offer
              </th>
              <th scope="col" className="px-4 py-2.5">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                Salary
              </th>
              <th scope="col" className="px-4 py-2.5">
                Start Date
              </th>
              <th scope="col" className="px-4 py-2.5">
                Sent
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
            {offers.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{row.candidate.full_name}</div>
                  <div className="text-xs text-muted-foreground">{row.candidate.email}</div>
                </td>
                <td className="px-4 py-2.5 text-foreground">{row.job.title}</td>
                <td className="px-4 py-2.5 text-foreground">{row.title}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={STATUS_CONFIG[row.status].variant}>{STATUS_CONFIG[row.status].label}</Badge>
                </td>
                <td className="px-4 py-2.5 text-foreground">{formatSalary(row)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.start_date ? formatDate(row.start_date) : "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.sent_at ? formatDate(row.sent_at) : "—"}</td>
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
