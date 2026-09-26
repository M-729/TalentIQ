import { CalendarDays, MapPin, Pencil } from "lucide-react";
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
    <Card className="overflow-hidden rounded-xl border-border p-0 shadow-sm">
      {/* overflow-x-auto keeps the table usable (scrollable) on narrow
          screens instead of squeezing columns unreadably. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-3.5">
                Job title
              </th>
              <th scope="col" className="px-4 py-3.5">
                Department
              </th>
              <th scope="col" className="px-4 py-3.5">
                Location
              </th>
              <th scope="col" className="px-4 py-3.5">
                Employment type
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5">
                Created
              </th>
              <th scope="col" className="px-4 py-3.5 pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job._id} className="border-b border-border last:border-0 hover:bg-primary/5">
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-foreground">{job.title}</div>
                  {(job.department || job.location) && (
                    <div className="text-xs text-muted-foreground">
                      {[job.department, job.location].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">{job.department ?? "—"}</td>
                <td className="px-4 py-3.5">
                  {job.location ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                      {job.location}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">{job.employment_type ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                    {formatDate(job.created_at)}
                  </span>
                </td>
                <td className="px-4 py-3.5 pr-5 text-right">
                  {job.public_id ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                      asChild
                      aria-label={`Edit ${job.title}`}
                    >
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
