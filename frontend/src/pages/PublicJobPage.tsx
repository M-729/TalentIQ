import { AlertCircle, Briefcase, Clock, GraduationCap, MapPin, SearchX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { usePublicJob } from "@/hooks/usePublicJob";
import { jobUrlId } from "@/lib/jobUrlId";
import type { PublicJob } from "@/types/publicJob";

function formatSalary(min?: number, max?: number): string | null {
  if (min === undefined && max === undefined) return null;
  const fmt = (n: number) => `$${n.toLocaleString()}`;
  if (min !== undefined && max !== undefined) return `${fmt(min)} – ${fmt(max)}`;
  if (min !== undefined) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function buildMeta(job: PublicJob) {
  const items: { icon: typeof Briefcase; label: string }[] = [];
  if (job.department) items.push({ icon: Briefcase, label: job.department });
  if (job.location) items.push({ icon: MapPin, label: job.location });
  if (job.employment_type) items.push({ icon: Clock, label: job.employment_type });
  return items;
}

// The compact summary panel's own label/value rows — deliberately separate
// from the page-header's own department/location/employment-type line,
// since an ATS-style summary conventionally restates the key scan-facts
// next to compensation, which the header line has no room for.
function buildOverview(job: PublicJob) {
  const items: { icon: typeof GraduationCap; label: string; value: string }[] = [];
  if (job.experience_level) items.push({ icon: GraduationCap, label: "Experience", value: job.experience_level });
  if (job.location) items.push({ icon: MapPin, label: "Location", value: job.location });
  if (job.employment_type) items.push({ icon: Clock, label: "Employment", value: job.employment_type });
  return items;
}

export function PublicJobPage() {
  const { id } = useParams<{ id: string }>();
  const { job, isLoading, error, notFound, refetch } = usePublicJob(id);

  const salary = job ? formatSalary(job.salary_min, job.salary_max) : null;
  const meta = job ? buildMeta(job) : [];
  const overview = job ? buildOverview(job) : [];

  return (
    <div className="public-brand-theme min-h-svh bg-background">
      <PublicHeader backTo="/careers" backLabel="Back to open positions" />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8 lg:pt-12">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : notFound ? (
          <Card className="mx-auto max-w-xl">
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
          <Card className="mx-auto max-w-xl">
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
            // One grid, top to bottom — the job header and the Apply
            // summary are both the FIRST child of their own column, so
            // they start at the same row instead of the summary panel
            // trailing far below the title. Mobile keeps plain DOM order
            // (header, then job content, then the Apply panel last)
            // rather than a CSS-order visual reorder that would desync
            // from keyboard/tab order.
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
              <div className="min-w-0">
                <div>
                  {job.company_name && (
                    <p className="font-mono-accent text-xs font-semibold uppercase tracking-wider text-primary">
                      {job.company_name}
                    </p>
                  )}
                  <h1 className="mt-1 font-heading text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
                    {job.title}
                  </h1>
                  {meta.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm font-medium text-muted-foreground">
                      {meta.map((item, i) => (
                        <span key={item.label} className="contents">
                          {i > 0 && <span className="mx-2 size-1 rounded-full bg-border" aria-hidden="true" />}
                          <span className="inline-flex items-center gap-1.5">
                            <item.icon className="size-4 text-primary" aria-hidden="true" />
                            {item.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {job.required_skills.length > 0 && (
                  <div className="mt-9 space-y-2.5">
                    <h2 className="font-heading text-lg font-bold text-foreground">Required skills</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {job.required_skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md bg-secondary px-2.5 py-1 font-mono-accent text-xs font-medium text-accent-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {job.description && (
                  <div className="mt-8 space-y-2.5 border-t border-border pt-5">
                    <h2 className="font-heading text-lg font-bold text-foreground">About the role</h2>
                    <p className="max-w-[64ch] whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                      {job.description}
                    </p>
                  </div>
                )}
              </div>

              <div className="lg:sticky lg:top-20 lg:self-start">
                <Card className="rounded-2xl">
                  <CardContent className="space-y-4 p-5">
                    {salary && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Compensation
                        </p>
                        <p className="font-mono-accent text-xl font-semibold tracking-tight text-foreground">
                          {salary}
                        </p>
                      </div>
                    )}

                    {salary && overview.length > 0 && <div className="h-px bg-border" />}

                    {overview.length > 0 && (
                      <dl className="space-y-2">
                        {overview.map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                            <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <item.icon className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
                              {item.label}
                            </dt>
                            <dd className="font-semibold text-foreground">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    <Button variant="gradient" size="lg" className="w-full rounded-lg" asChild>
                      <Link to={`/careers/jobs/${jobUrlId(job)}/apply`}>Apply for this position</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
