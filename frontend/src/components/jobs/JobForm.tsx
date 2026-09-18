import { useState, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, Banknote, Briefcase, Building2, Clock, MapPin, TrendingUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkillsInput } from "@/components/jobs/SkillsInput";
import { cn } from "@/lib/utils";
import { JOB_STATUSES } from "@/types/job";
import type { CreateJobInput, Job, JobStatus } from "@/types/job";

interface JobFormValues {
  title: string;
  department: string;
  location: string;
  employment_type: string;
  experience_level: string;
  description: string;
  required_skills: string[];
  salary_min: string;
  salary_max: string;
  status: JobStatus;
}

function toFormValues(job?: Job): JobFormValues {
  return {
    title: job?.title ?? "",
    department: job?.department ?? "",
    location: job?.location ?? "",
    employment_type: job?.employment_type ?? "",
    experience_level: job?.experience_level ?? "",
    description: job?.description ?? "",
    required_skills: job?.required_skills ?? [],
    salary_min: job?.salary_min !== undefined ? String(job.salary_min) : "",
    salary_max: job?.salary_max !== undefined ? String(job.salary_max) : "",
    status: job?.status ?? "draft",
  };
}

function validate(values: JobFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.title.trim()) {
    errors.title = "Title is required";
  }
  if (values.salary_min !== "" && Number(values.salary_min) < 0) {
    errors.salary_min = "Must be 0 or greater";
  }
  if (values.salary_max !== "" && Number(values.salary_max) < 0) {
    errors.salary_max = "Must be 0 or greater";
  }
  return errors;
}

function buildPayload(values: JobFormValues): CreateJobInput {
  const payload: CreateJobInput = { title: values.title.trim(), required_skills: values.required_skills };

  if (values.department.trim()) payload.department = values.department.trim();
  if (values.location.trim()) payload.location = values.location.trim();
  if (values.employment_type.trim()) payload.employment_type = values.employment_type.trim();
  if (values.experience_level.trim()) payload.experience_level = values.experience_level.trim();
  if (values.description.trim()) payload.description = values.description.trim();
  if (values.salary_min !== "") payload.salary_min = Number(values.salary_min);
  if (values.salary_max !== "") payload.salary_max = Number(values.salary_max);
  payload.status = values.status;

  return payload;
}

// One continuous card with internal sections (heading + divider), matching
// the approved wireframe's single-panel form layout rather than several
// separate cards.
function Section({ title, first, children }: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <div className={cn("space-y-4", !first && "border-t border-border pt-6")}>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

function Field({ label, htmlFor, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Small leading-icon treatment on text inputs, matching the wireframe's
// icon-prefixed fields (Job Title, Department, Location, ...).
function IconInput({ icon: Icon, className, ...props }: { icon: LucideIcon } & ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input className={cn("pl-9", className)} {...props} />
    </div>
  );
}

export interface JobFormProps {
  mode: "create" | "edit";
  job?: Job;
  isSubmitting: boolean;
  serverError?: string | null;
  fieldErrors?: Record<string, string>;
  onSubmit: (payload: CreateJobInput) => void | Promise<void>;
  onCancel: () => void;
}

export function JobForm({ mode, job, isSubmitting, serverError, fieldErrors, onSubmit, onCancel }: JobFormProps) {
  const [values, setValues] = useState<JobFormValues>(() => toFormValues(job));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);

  const errors = { ...fieldErrors, ...localErrors };

  const minSalaryNum = values.salary_min !== "" ? Number(values.salary_min) : undefined;
  const maxSalaryNum = values.salary_max !== "" ? Number(values.salary_max) : undefined;
  // UX-only hint, not a submission blocker — the backend does not enforce
  // salary_min <= salary_max, so neither does this form. Flagged as an
  // assumption in the task report, not a permanent business rule.
  const salaryRangeWarning =
    minSalaryNum !== undefined && maxSalaryNum !== undefined && minSalaryNum > maxSalaryNum
      ? "Minimum salary is higher than maximum salary."
      : null;

  function update<K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function runSubmit(targetStatus: JobStatus) {
    const nextValues = { ...values, status: targetStatus };
    const validationErrors = validate(nextValues);
    setLocalErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    setValues(nextValues);
    setPendingStatus(targetStatus);
    await onSubmit(buildPayload(nextValues));
    setPendingStatus(null);
  }

  return (
    // Actions are explicit buttons (type="button"), not native form
    // submission — with two different actions in create mode (Draft vs
    // Publish), letting Enter implicitly trigger "whichever button is
    // first" would risk accidentally publishing a job the user meant to
    // save as a draft.
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      {serverError && !Object.keys(fieldErrors ?? {}).length && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{serverError}</p>
        </div>
      )}

      <Card>
        <CardContent className="space-y-6">
          <Section title="Basic Information" first>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Job Title" htmlFor="title" required error={errors.title}>
                  <IconInput
                    icon={Briefcase}
                    id="title"
                    value={values.title}
                    onChange={(e) => update("title", e.target.value)}
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? "title-error" : undefined}
                  />
                </Field>
              </div>

              <Field label="Department" htmlFor="department">
                <IconInput
                  icon={Building2}
                  id="department"
                  value={values.department}
                  onChange={(e) => update("department", e.target.value)}
                />
              </Field>

              <Field label="Location" htmlFor="location">
                <IconInput
                  icon={MapPin}
                  id="location"
                  value={values.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </Field>

              <Field label="Employment Type" htmlFor="employment_type">
                <IconInput
                  icon={Clock}
                  id="employment_type"
                  placeholder="e.g. Full-time"
                  value={values.employment_type}
                  onChange={(e) => update("employment_type", e.target.value)}
                />
              </Field>

              <Field label="Experience Level" htmlFor="experience_level">
                <IconInput
                  icon={TrendingUp}
                  id="experience_level"
                  placeholder="e.g. Mid-level"
                  value={values.experience_level}
                  onChange={(e) => update("experience_level", e.target.value)}
                />
              </Field>

              <Field label="Minimum Salary" htmlFor="salary_min" error={errors.salary_min}>
                <IconInput
                  icon={Banknote}
                  id="salary_min"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values.salary_min}
                  onChange={(e) => update("salary_min", e.target.value)}
                  aria-invalid={!!errors.salary_min}
                  aria-describedby={errors.salary_min ? "salary_min-error" : undefined}
                />
              </Field>

              <Field label="Maximum Salary" htmlFor="salary_max" error={errors.salary_max}>
                <IconInput
                  icon={Banknote}
                  id="salary_max"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={values.salary_max}
                  onChange={(e) => update("salary_max", e.target.value)}
                  aria-invalid={!!errors.salary_max}
                  aria-describedby={errors.salary_max ? "salary_max-error" : undefined}
                />
              </Field>
              {salaryRangeWarning && <p className="sm:col-span-2 text-xs text-warning">{salaryRangeWarning}</p>}
            </div>
          </Section>

          <Section title="Job Description">
            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                rows={5}
                value={values.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Required Skills">
            <Field label="Skills" htmlFor="skills">
              <SkillsInput
                id="skills"
                value={values.required_skills}
                onChange={(skills) => update("required_skills", skills)}
                placeholder="Type a skill and press Enter"
              />
            </Field>
          </Section>

          {mode === "edit" && (
            <Section title="Status">
              <div role="group" aria-label="Job status" className="flex flex-wrap gap-2">
                {JOB_STATUSES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={values.status === s ? "default" : "outline"}
                    aria-pressed={values.status === s}
                    onClick={() => update("status", s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </Section>
          )}

          <div
            className={cn(
              "flex flex-wrap items-center gap-3 border-t border-border pt-6",
              mode === "create" ? "justify-between" : "justify-end"
            )}
          >
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>

            {mode === "create" ? (
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => void runSubmit("draft")}>
                  {isSubmitting && pendingStatus === "draft" ? "Saving…" : "Save as Draft"}
                </Button>
                <Button type="button" disabled={isSubmitting} onClick={() => void runSubmit("active")}>
                  {isSubmitting && pendingStatus === "active" ? "Publishing…" : "Publish Job"}
                </Button>
              </div>
            ) : (
              <Button type="button" disabled={isSubmitting} onClick={() => void runSubmit(values.status)}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
