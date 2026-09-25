import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PipelineStageBadge } from "@/components/applications/PipelineStageBadge";
import { ScreeningStatusBadge } from "@/components/applications/ScreeningStatusBadge";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { ApplicationListRow } from "@/types/application";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ApplicationsTable({ applications }: { applications: ApplicationListRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      {/* overflow-x-auto keeps the table usable (scrollable) on narrow
          screens instead of squeezing columns unreadably, matching
          JobsTable.tsx's own convention. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">
                Candidate
              </th>
              <th scope="col" className="px-4 py-2.5">
                Applied Job
              </th>
              <th scope="col" className="px-4 py-2.5">
                Applied
              </th>
              <th scope="col" className="px-4 py-2.5">
                Pipeline Stage
              </th>
              <th scope="col" className="px-4 py-2.5">
                AI Screening
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{application.candidate.full_name}</div>
                  <div className="text-xs text-muted-foreground">{application.candidate.email}</div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-foreground">{application.job.title}</div>
                  {application.job.department && (
                    <div className="text-xs text-muted-foreground">{application.job.department}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatDate(application.applied_at)}</td>
                <td className="px-4 py-2.5">
                  <PipelineStageBadge application={application} />
                </td>
                <td className="px-4 py-2.5">
                  <ScreeningStatusBadge status={application.screening.status} />
                  {/* A coverage percentage without a screening would
                      misleadingly read as "0% coverage" — only ever shown
                      once the screening actually completed and a score exists. */}
                  {application.screening.status === "completed" && application.screening.latest_score != null && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {application.screening.latest_score}% Skill Coverage
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/applications/${resourceUrlId(application)}`}>View Application</Link>
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
