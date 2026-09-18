import { apiClient } from "@/services/api/client";
import type { SubmitApplicationInput } from "@/types/application";

export function submitApplication(
  jobId: string,
  payload: SubmitApplicationInput,
  cvFile: File
): Promise<{ message: string }> {
  const formData = new FormData();
  formData.set("full_name", payload.full_name);
  formData.set("email", payload.email);
  if (payload.phone) formData.set("phone", payload.phone);
  if (payload.location) formData.set("location", payload.location);
  if (payload.linkedin_url) formData.set("linkedin_url", payload.linkedin_url);
  if (payload.portfolio_url) formData.set("portfolio_url", payload.portfolio_url);
  // Field name must match the backend's multer field: "cv".
  formData.set("cv", cvFile);

  return apiClient.post<{ message: string }>(`/public/jobs/${jobId}/applications`, formData);
}
