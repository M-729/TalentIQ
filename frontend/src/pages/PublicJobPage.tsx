import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  GraduationCap,
  MapPin,
  SearchX,
} from "lucide-react";
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

// The sidebar's own label/value rows — deliberately separate from the
// page-header's own department/location/employment-type chips, since an
// ATS-style summary conventionally restates the key scan-facts next to
// compensation, which the header line has no room for.
function buildOverview(job: PublicJob, salary: string | null) {
  const items: { icon: typeof GraduationCap; iconClassName: string; label: string; value: string }[] = [];
  if (salary) {
    items.push({ icon: DollarSign, iconClassName: "bg-emerald-100 text-emerald-600", label: "Salary range", value: salary });
  }
  if (job.experience_level) {
    items.push({
      icon: GraduationCap,
      iconClassName: "bg-blue-100 text-blue-600",
      label: "Experience level",
      value: job.experience_level,
    });
  }
  if (job.location) {
    items.push({ icon: MapPin, iconClassName: "bg-pink-100 text-pink-600", label: "Location", value: job.location });
  }
  if (job.employment_type) {
    items.push({
      icon: Clock,
      iconClassName: "bg-amber-100 text-amber-600",
      label: "Employment type",
      value: job.employment_type,
    });
  }
  return items;
}

export function PublicJobPage() {
  const { id } = useParams<{ id: string }>();
  const { job, isLoading, error, notFound, refetch } = usePublicJob(id);

  const salary = job ? formatSalary(job.salary_min, job.salary_max) : null;
  const meta = job ? buildMeta(job) : [];
  const overview = job ? buildOverview(job, salary) : [];

  return (
    <div className="public-brand-theme min-h-svh bg-background">
      <PublicHeader backTo="/careers" backLabel="Back to open positions" />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 sm:pb-20 lg:px-8 lg:pt-12">
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
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
              <div className="min-w-0">
                <div className="flex items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4B3EDD,#8B7CF6)] shadow-[0_8px_20px_rgba(75,62,221,0.25)]">
                    <Building2 className="size-7 text-white" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    {job.company_name && (
                      <p className="font-mono-accent text-xs font-semibold uppercase tracking-wider text-primary">
                        {job.company_name}
                      </p>
                    )}
                    <h1 className="mt-1 font-heading text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
                      {job.title}
                    </h1>
                  </div>
                </div>

                {meta.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {meta.map((item) => (
                      <span
                        key={item.label}
                        className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                      >
                        <item.icon className="size-4 text-primary" aria-hidden="true" />
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}

                {job.description && (
                  <Card className="mt-8 rounded-2xl">
                    <CardContent className="space-y-2.5 p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground">About the role</h2>
                      <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                        {job.description}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {job.required_skills.length > 0 && (
                  <Card className="mt-6 rounded-2xl">
                    <CardContent className="space-y-3 p-6">
                      <h2 className="font-heading text-lg font-bold text-foreground">Requirements</h2>
                      <ul className="space-y-2.5">
                        {job.required_skills.map((skill) => (
                          <li key={skill} className="flex items-start gap-2.5 text-[15px] text-muted-foreground">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="lg:sticky lg:top-20 lg:self-start">
                <Card className="rounded-2xl">
                  <CardContent className="space-y-4 p-5">
                    <h2 className="font-heading text-base font-bold text-foreground">Job overview</h2>

                    {overview.length > 0 && (
                      <dl className="space-y-3">
                        {overview.map((item) => (
                          <div key={item.label} className="flex items-center gap-3 text-sm">
                            <div
                              className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${item.iconClassName}`}
                            >
                              <item.icon className="size-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <dt className="text-xs text-muted-foreground">{item.label}</dt>
                              <dd className="truncate font-semibold text-foreground">{item.value}</dd>
                            </div>
                          </div>
                        ))}
                      </dl>
                    )}

                    <Button variant="gradient" size="lg" className="w-full rounded-lg" asChild>
                      <Link to={`/careers/jobs/${jobUrlId(job)}/apply`}>Apply now</Link>
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
