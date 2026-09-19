import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApplicationStatusBadge } from "@/components/applications/ApplicationStatusBadge";
import { ScreeningStatusBadge } from "@/components/applications/ScreeningStatusBadge";
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
              <th scope="col" className="px-4 py-3">
                Candidate
              </th>
              <th scope="col" className="px-4 py-3">
                Applied Job
              </th>
              <th scope="col" className="px-4 py-3">
                Applied
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                AI Screening
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{application.candidate.full_name}</div>
                  <div className="text-xs text-muted-foreground">{application.candidate.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-foreground">{application.job.title}</div>
                  {application.job.department && (
                    <div className="text-xs text-muted-foreground">{application.job.department}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(application.applied_at)}</td>
                <td className="px-4 py-3">
                  <ApplicationStatusBadge status={application.status} />
                </td>
                <td className="px-4 py-3">
                  <ScreeningStatusBadge hasScreening={application.screening.has_screening} />
                  {/* A coverage percentage without a screening would
                      misleadingly read as "0% coverage" — only ever shown
                      once has_screening is true and a score exists. */}
                  {application.screening.has_screening && application.screening.latest_score != null && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {application.screening.latest_score}% Skill Coverage
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/applications/${application.id}`}>View Application</Link>
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
