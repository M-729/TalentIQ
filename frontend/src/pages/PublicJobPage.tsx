import { AlertCircle, Banknote, Briefcase, Clock, MapPin, SearchX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { usePublicJob } from "@/hooks/usePublicJob";

function formatSalary(min?: number, max?: number): string | null {
  if (min === undefined && max === undefined) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (min !== undefined && max !== undefined) return `${fmt(min)} – ${fmt(max)}`;
  if (min !== undefined) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export function PublicJobPage() {
  const { id } = useParams<{ id: string }>();
  const { job, isLoading, error, notFound, refetch } = usePublicJob(id);

  const salary = job ? formatSalary(job.salary_min, job.salary_max) : null;
  const meta = job ? [job.department, job.location, job.employment_type].filter(Boolean) : [];

  return (
    <div className="min-h-svh bg-background">
      <PublicHeader backTo="/careers" backLabel="Back to open positions" />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : notFound ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Job not available</p>
                <p className="text-sm text-muted-foreground">
                  This position is no longer available or could not be found.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Couldn't load this job</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={refetch}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          job && (
            <div className="space-y-6">
              <div>
                {job.company_name && (
                  <p className="text-sm font-medium text-primary">{job.company_name}</p>
                )}
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{job.title}</h1>
                {meta.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
              </div>

              <Card>
                <CardContent className="space-y-6">
                  {job.description && (
                    <div className="space-y-2">
                      <h2 className="text-base font-semibold text-foreground">About this role</h2>
                      <p className="whitespace-pre-line text-sm text-muted-foreground">{job.description}</p>
                    </div>
                  )}

                  {job.required_skills.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-6 first:border-0 first:pt-0">
                      <h2 className="text-base font-semibold text-foreground">Required Skills</h2>
                      <div className="flex flex-wrap gap-2">
                        {job.required_skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.experience_level && (
                    <div className="space-y-2 border-t border-border pt-6 first:border-0 first:pt-0">
                      <h2 className="text-base font-semibold text-foreground">Experience Level</h2>
                      <p className="text-sm text-muted-foreground">{job.experience_level}</p>
                    </div>
                  )}

                  {salary && (
                    <div className="space-y-2 border-t border-border pt-6 first:border-0 first:pt-0">
                      <h2 className="text-base font-semibold text-foreground">Compensation</h2>
                      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Banknote className="size-4" aria-hidden="true" />
                        {salary}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link to={`/careers/jobs/${job._id}/apply`}>Apply for this position</Link>
                </Button>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
