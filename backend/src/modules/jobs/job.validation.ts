import { z } from "zod";
import { Types } from "mongoose";
import { JOB_STATUSES } from "../../models/Job.model";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const jobIdParamsSchema = z.object({
  id: objectIdString("job id"),
});

const title = z.string().trim().min(1, "Title is required");
const optionalTitle = z.string().trim().min(1, "Title cannot be empty").optional();
const department = z.string().trim().optional();
const description = z.string().trim().optional();
const requiredSkills = z.array(z.string().trim()).optional();
const experienceLevel = z.string().trim().optional();
const location = z.string().trim().optional();
const employmentType = z.string().trim().optional();
const salaryMin = z.number().min(0).optional();
const salaryMax = z.number().min(0).optional();
const status = z.enum(JOB_STATUSES).optional();

export const createJobSchema = z.object({
  title,
  department,
  description,
  required_skills: requiredSkills,
  experience_level: experienceLevel,
  location,
  employment_type: employmentType,
  salary_min: salaryMin,
  salary_max: salaryMax,
  status,
});

// Everything optional (partial update), but at least one field must be
// present — an empty PATCH body is a client error, not a no-op success.
export const updateJobSchema = z
  .object({
    title: optionalTitle,
    department,
    description,
    required_skills: requiredSkills,
    experience_level: experienceLevel,
    location,
    employment_type: employmentType,
    salary_min: salaryMin,
    salary_max: salaryMax,
    status,
  })
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export const listJobsQuerySchema = z.object({
  status,
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
