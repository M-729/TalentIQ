import { useState } from "react";
import { AlertCircle, CheckCircle2, SearchX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { CvFileInput } from "@/components/jobs/CvFileInput";
import { usePublicJob } from "@/hooks/usePublicJob";
import { jobUrlId } from "@/lib/jobUrlId";
import * as applicationsApi from "@/services/api/applications";
import { ApiError } from "@/services/api/client";
import { parseApiFieldErrors } from "@/lib/parseApiFieldErrors";
import type { SubmitApplicationInput } from "@/types/application";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  portfolio_url: string;
}

const EMPTY_VALUES: FormValues = {
  full_name: "",
  email: "",
  phone: "",
  location: "",
  linkedin_url: "",
  portfolio_url: "",
};

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Client-side mirror of the backend's rules, for immediate UX feedback
// only — the backend is the source of truth and re-validates everything,
// including re-checking the CV's actual file content regardless of what
// passed here.
function validate(values: FormValues, cvFile: File | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.full_name.trim()) errors.full_name = "Full name is required";
  if (!values.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Invalid email address";
  }
  if (values.linkedin_url.trim() && !isValidUrl(values.linkedin_url.trim())) {
    errors.linkedin_url = "Must be a valid URL";
  }
  if (values.portfolio_url.trim() && !isValidUrl(values.portfolio_url.trim())) {
    errors.portfolio_url = "Must be a valid URL";
  }
  if (!cvFile) {
    errors.cv = "Resume/CV is required";
  }
  return errors;
}

function buildPayload(values: FormValues): SubmitApplicationInput {
  const payload: SubmitApplicationInput = { full_name: values.full_name.trim(), email: values.email.trim() };
  if (values.phone.trim()) payload.phone = values.phone.trim();
  if (values.location.trim()) payload.location = values.location.trim();
  if (values.linkedin_url.trim()) payload.linkedin_url = values.linkedin_url.trim();
  if (values.portfolio_url.trim()) payload.portfolio_url = values.portfolio_url.trim();
  return payload;
}

export function ApplyPage() {
  const { id } = useParams<{ id: string }>();
  const { job, isLoading: isJobLoading, notFound, error: jobError } = usePublicJob(id);

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!id) return;

    const validationErrors = validate(values, cvFile);
    setFieldErrors(validationErrors);
    setServerError(null);
    if (Object.keys(validationErrors).length > 0 || !cvFile) return;

    setIsSubmitting(true);
    try {
      await applicationsApi.submitApplication(id, buildPayload(values), cvFile);
      setIsSubmitted(true);
    } catch (err) {
      const parsedFieldErrors = parseApiFieldErrors(err);
      if (parsedFieldErrors) {
        setFieldErrors(parsedFieldErrors);
      } else if (err instanceof ApiError && err.status === 409) {
        setServerError("You have already applied to this position.");
      } else if (err instanceof ApiError && err.status === 404) {
        setServerError("This position is no longer available.");
      } else {
        setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const backTo = id ? `/careers/jobs/${id}` : "/";

  return (
    <div className="min-h-svh bg-background">
      <PublicHeader backTo={backTo} backLabel="Back to job details" />

      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        {isJobLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-64 w-full" />
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
        ) : jobError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Couldn't load this job</p>
                <p className="text-sm text-muted-foreground">{jobError}</p>
              </div>
            </CardContent>
          </Card>
        ) : isSubmitted ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
              <div>
                <p className="text-lg font-semibold text-foreground">Application submitted</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Thank you for applying. We'll contact you by email regarding next steps.
                </p>
              </div>
              {job && (
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link to={`/careers/jobs/${jobUrlId(job)}`}>Back to job</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          job && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">Applying for</p>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{job.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {[job.company_name, job.location, job.employment_type].filter(Boolean).join(" · ")}
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
                    {serverError && (
                      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <p role="alert">{serverError}</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="full_name">
                        Full Name<span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="full_name"
                        autoComplete="name"
                        value={values.full_name}
                        onChange={(e) => update("full_name", e.target.value)}
                        aria-invalid={!!fieldErrors.full_name}
                        aria-describedby={fieldErrors.full_name ? "full_name-error" : undefined}
                      />
                      {fieldErrors.full_name && (
                        <p id="full_name-error" role="alert" className="text-xs text-destructive">
                          {fieldErrors.full_name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email">
                        Email<span className="text-destructive"> *</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={values.email}
                        onChange={(e) => update("email", e.target.value)}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? "email-error" : undefined}
                      />
                      {fieldErrors.email && (
                        <p id="email-error" role="alert" className="text-xs text-destructive">
                          {fieldErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={values.phone}
                        onChange={(e) => update("phone", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={values.location}
                        onChange={(e) => update("location", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                      <Input
                        id="linkedin_url"
                        type="url"
                        placeholder="https://linkedin.com/in/..."
                        value={values.linkedin_url}
                        onChange={(e) => update("linkedin_url", e.target.value)}
                        aria-invalid={!!fieldErrors.linkedin_url}
                        aria-describedby={fieldErrors.linkedin_url ? "linkedin_url-error" : undefined}
                      />
                      {fieldErrors.linkedin_url && (
                        <p id="linkedin_url-error" role="alert" className="text-xs text-destructive">
                          {fieldErrors.linkedin_url}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="portfolio_url">Portfolio URL</Label>
                      <Input
                        id="portfolio_url"
                        type="url"
                        placeholder="https://..."
                        value={values.portfolio_url}
                        onChange={(e) => update("portfolio_url", e.target.value)}
                        aria-invalid={!!fieldErrors.portfolio_url}
                        aria-describedby={fieldErrors.portfolio_url ? "portfolio_url-error" : undefined}
                      />
                      {fieldErrors.portfolio_url && (
                        <p id="portfolio_url-error" role="alert" className="text-xs text-destructive">
                          {fieldErrors.portfolio_url}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cv">
                        Resume / CV<span className="text-destructive"> *</span>
                      </Label>
                      <CvFileInput id="cv" file={cvFile} onChange={setCvFile} error={fieldErrors.cv} />
                    </div>

                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting…" : "Submit application"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )
        )}
      </main>
    </div>
  );
}
