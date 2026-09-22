// Mirrors the backend's public-safe response exactly
// (backend/src/modules/publicJobs/publicJob.service.ts's PublicJob), which
// is a deliberate allowlist over the full Job — distinct from the
// authenticated Job type in types/job.ts. Never merge these two types:
// PublicJob must never gain company_id/created_by/internal fields just
// because Job has them.
export interface PublicJob {
  _id: string;
  title: string;
  department?: string;
  description?: string;
  required_skills: string[];
  experience_level?: string;
  location?: string;
  employment_type?: string;
  salary_min?: number;
  salary_max?: number;
  published_at?: string;
  company_name?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListPublicJobsFilters {
  search?: string;
  location?: string;
  employmentType?: string;
  department?: string;
  page: number;
  limit: number;
}
