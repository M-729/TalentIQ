import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PipelineStageBadge } from "@/components/applications/PipelineStageBadge";
import { ScreeningStatusBadge } from "@/components/applications/ScreeningStatusBadge";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { ApplicationListRow } from "@/types/application";

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// A stable per-row tint keyed off the candidate's own id (never index-based,
// so a row's color never shifts as other rows are added/removed/paginated)
// — purely decorative, no meaning attached to the color itself.
function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function ApplicationsTable({ applications }: { applications: ApplicationListRow[] }) {
  return (
    <Card className="overflow-hidden rounded-xl border-border p-0 shadow-sm">
      {/* overflow-x-auto keeps the table usable (scrollable) on narrow
          screens instead of squeezing columns unreadably, matching
          JobsTable.tsx's own convention. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-3.5">
                Candidate
              </th>
              <th scope="col" className="px-4 py-3.5">
                Applied Job
              </th>
              <th scope="col" className="px-4 py-3.5">
                Applied
              </th>
              <th scope="col" className="px-4 py-3.5">
                Pipeline Stage
              </th>
              <th scope="col" className="px-4 py-3.5">
                AI Screening
              </th>
              <th scope="col" className="px-4 py-3.5 pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-border last:border-0 hover:bg-primary/5">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(application.id)}`}
                    >
                      {getInitials(application.candidate.full_name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{application.candidate.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{application.candidate.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-medium text-foreground">{application.job.title}</div>
                  {application.job.department && (
                    <div className="text-xs text-muted-foreground">{application.job.department}</div>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-muted-foreground">{formatDate(application.applied_at)}</span>
                </td>
                <td className="px-4 py-3.5">
                  <PipelineStageBadge application={application} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="space-y-1">
                    <ScreeningStatusBadge status={application.screening.status} />
                    {/* A coverage percentage without a screening would
                        misleadingly read as "0% coverage" — only ever shown
                        once the screening actually completed and a score exists. */}
                    {application.screening.status === "completed" && application.screening.latest_score != null && (
                      <p className="text-xs font-medium text-muted-foreground">
                        {application.screening.latest_score}% Skill Coverage
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 pr-5 text-right">
                  <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary" asChild>
                    <Link to={`/applications/${resourceUrlId(application)}`}>
                      View Application <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
