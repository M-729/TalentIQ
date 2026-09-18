import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { JobForm } from "@/components/jobs/JobForm";
import * as jobsApi from "@/services/api/jobs";
import { ApiError } from "@/services/api/client";
import { parseApiFieldErrors } from "@/lib/parseApiFieldErrors";
import type { CreateJobInput } from "@/types/job";

export function CreateJobPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);

  async function handleSubmit(payload: CreateJobInput) {
    setIsSubmitting(true);
    setServerError(null);
    setFieldErrors(undefined);
    try {
      await jobsApi.createJob(payload);
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Job</h1>
        <p className="text-sm text-muted-foreground">Add a new open position for your company.</p>
      </div>

      <JobForm
        mode="create"
        isSubmitting={isSubmitting}
        serverError={serverError}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
        onCancel={() => navigate("/jobs")}
      />
    </div>
  );
}
