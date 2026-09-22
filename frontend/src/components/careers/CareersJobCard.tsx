import { Briefcase, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div>
            {job.company_name && <p className="text-xs font-medium text-primary">{job.company_name}</p>}
            <h2 className="text-lg font-semibold text-foreground">
              <Link to={`/careers/jobs/${job._id}`} className="hover:underline">
                {job.title}
              </Link>
            </h2>
          </div>

          {meta.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
            </div>
          )}

          {job.description && <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}
        </div>

        <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
          <Link to={`/careers/jobs/${job._id}`}>View Job</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
