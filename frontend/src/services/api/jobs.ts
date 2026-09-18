import { apiClient } from "@/services/api/client";
import type { CreateJobInput, Job, JobStatus, UpdateJobInput } from "@/types/job";

export function listJobs(status?: JobStatus, signal?: AbortSignal): Promise<{ jobs: Job[] }> {
  const query = status ? `?status=${status}` : "";
  return apiClient.get<{ jobs: Job[] }>(`/jobs${query}`, signal);
}

export function getJob(id: string, signal?: AbortSignal): Promise<{ job: Job }> {
  return apiClient.get<{ job: Job }>(`/jobs/${id}`, signal);
}

export function createJob(payload: CreateJobInput): Promise<{ job: Job }> {
  return apiClient.post<{ job: Job }>("/jobs", payload);
}

export function updateJob(id: string, payload: UpdateJobInput): Promise<{ job: Job }> {
  return apiClient.patch<{ job: Job }>(`/jobs/${id}`, payload);
}
