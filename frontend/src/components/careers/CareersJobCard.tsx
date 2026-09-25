import { Briefcase, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { jobUrlId } from "@/lib/jobUrlId";
import type { PublicJob } from "@/types/publicJob";

export interface CareersJobCardProps {
  job: PublicJob;
}

// One public Job row — deliberately plain/professional (a candidate-facing
// list item, not an HR dashboard card): no status badges, no internal
// metadata, nothing beyond what a candidate needs to decide whether to
// open the role.
export function CareersJobCard({ job }: CareersJobCardProps) {
  const meta = [job.department, job.location, job.employment_type].filter(Boolean);
  const jobId = jobUrlId(job);

  return (
    <Card className="rounded-2xl">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          {job.company_name && (
            <p className="font-mono-accent text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {job.company_name}
            </p>
          )}
          <h2 className="font-heading text-lg font-bold text-foreground">
            <Link to={`/careers/jobs/${jobId}`} className="hover:underline">
              {job.title}
            </Link>
          </h2>

          {(meta.length > 0 || job.experience_level) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {job.department && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="size-4" aria-hidden="true" />
                  {job.department}
                </span>
              )}
              {job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {job.location}
                </span>
              )}
              {job.employment_type && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden="true" />
                  {job.employment_type}
                </span>
              )}
              {job.experience_level && (
                <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-primary">
                  {job.experience_level}
                </span>
              )}
            </div>
          )}
        </div>

        <Button asChild variant="gradient" size="lg" className="w-full shrink-0 rounded-lg sm:w-auto">
          <Link to={`/careers/jobs/${jobId}`}>View Job</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
