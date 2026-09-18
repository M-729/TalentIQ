import { useState } from "react";
import { AlertCircle, SearchX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { JobForm } from "@/components/jobs/JobForm";
import { useJob } from "@/hooks/useJob";
import * as jobsApi from "@/services/api/jobs";
import { ApiError } from "@/services/api/client";
import { parseApiFieldErrors } from "@/lib/parseApiFieldErrors";
import type { UpdateJobInput } from "@/types/job";

export function EditJobPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { job, isLoading, error, notFound } = useJob(id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);

  async function handleSubmit(payload: UpdateJobInput) {
    if (!id) return;
    setIsSubmitting(true);
    setServerError(null);
    setFieldErrors(undefined);
    try {
      await jobsApi.updateJob(id, payload);
      navigate("/jobs");
    } catch (err) {
      const parsedFieldErrors = parseApiFieldErrors(err);
      if (parsedFieldErrors) {
        setFieldErrors(parsedFieldErrors);
      } else {
        setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Edit Job</h1>
        <p className="text-sm text-muted-foreground">Update this position's details.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : notFound ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Job not found</p>
              <p className="text-sm text-muted-foreground">
                This job may have been deleted, or it belongs to a different company.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/jobs")}>
              Back to Jobs
            </Button>
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
            <Button variant="outline" size="sm" onClick={() => navigate("/jobs")}>
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      ) : (
        job && (
          <JobForm
            mode="edit"
            job={job}
            isSubmitting={isSubmitting}
            serverError={serverError}
            fieldErrors={fieldErrors}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/jobs")}
          />
        )
      )}
    </div>
  );
}
