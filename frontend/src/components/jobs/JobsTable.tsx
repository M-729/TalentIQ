import { Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { jobUrlId } from "@/lib/jobUrlId";
import type { Job } from "@/types/job";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function JobsTable({ jobs }: { jobs: Job[] }) {
  return (
    <Card className="overflow-hidden p-0">
      {/* overflow-x-auto keeps the table usable (scrollable) on narrow
          screens instead of squeezing columns unreadably. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">
                Job title
              </th>
              <th scope="col" className="px-4 py-2.5">
                Department
              </th>
              <th scope="col" className="px-4 py-2.5">
                Location
              </th>
              <th scope="col" className="px-4 py-2.5">
                Employment type
              </th>
              <th scope="col" className="px-4 py-2.5">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5">
                Created
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job._id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium text-foreground">{job.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{job.department ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{job.location ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{job.employment_type ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatDate(job.created_at)}</td>
                <td className="px-4 py-2.5 text-right">
                  {job.public_id ? (
                    <Button variant="outline" size="icon" asChild aria-label={`Edit ${job.title}`}>
                      <Link to={`/jobs/${jobUrlId(job)}/edit`}>
                        <Pencil className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="icon" disabled aria-label={`Edit ${job.title}`}>
                      <Pencil className="size-4" aria-hidden="true" />
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
