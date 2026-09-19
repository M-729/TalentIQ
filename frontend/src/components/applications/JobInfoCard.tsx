import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationDetail } from "@/types/application";

const LONG_DESCRIPTION_THRESHOLD = 240;

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function JobInfoCard({ job }: { job: ApplicationDetail["job"] }) {
  const isLongDescription = (job.description?.length ?? 0) > LONG_DESCRIPTION_THRESHOLD;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Job title" value={job.title} />
          <Field label="Department" value={job.department} />
          <Field label="Employment type" value={job.employment_type} />
          <Field label="Location" value={job.location} />
          <Field label="Experience level" value={job.experience_level} />
        </dl>

        {job.required_skills.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Required skills</p>
            <div className="flex flex-wrap gap-2">
              {job.required_skills.map((skill) => (
                <span key={skill} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.description &&
          (isLongDescription ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-foreground">Description</summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{job.description}</p>
            </details>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{job.description}</p>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
