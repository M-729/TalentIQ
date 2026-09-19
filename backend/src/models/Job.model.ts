import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Per ERD: only "status" is an enumerated field on jobs. employment_type and
// experience_level are plain strings in the ERD (no enumerated values given
// in the BRD/ERD), so they stay free-text here rather than inventing an enum.
export const JOB_STATUSES = ["draft", "active", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const jobSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    description: { type: String, trim: true },
    required_skills: [{ type: String, trim: true }],
    experience_level: { type: String, trim: true },
    location: { type: String, trim: true },
    employment_type: { type: String, trim: true },
    salary_min: { type: Number, min: 0 },
    salary_max: { type: Number, min: 0 },
    status: { type: String, enum: JOB_STATUSES, default: "draft", required: true },
    published_at: { type: Date },
    // Administrative soft delete — deliberately distinct from `status`.
    // `status: "closed"` means "this recruitment process stopped accepting
    // candidates" (an HR lifecycle decision); `deleted_at != null` means
    // "this Job has been administratively removed from normal product
    // views" (Job management, public listing). A Job is never
    // hard-deleted: Applications, HiringSteps, and AIScreenings (via
    // Application) may still reference it, and historical recruitment
    // data must stay resolvable. `select: false` (same convention as
    // User.password_hash) keeps it out of default query projections and
    // therefore out of normal Job JSON responses, since normal routes
    // never return a Job with deleted_at set anyway (see
    // NOT_DELETED_JOB_FILTER below) — there is nothing for the client to
    // see here yet.
    deleted_at: { type: Date, default: null, select: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Covers the normal company-scoped access patterns: "this company's jobs"
// (either index serves that alone via its leading field), "this company's
// jobs filtered by status" (e.g. active jobs for a public listing), and
// "this company's jobs, most recent first" (default dashboard ordering).
jobSchema.index({ company_id: 1, status: 1 });
jobSchema.index({ company_id: 1, created_at: -1 });

// Every normal Job-management read (list, get, update, delete) filters by
// company_id + deleted_at: null — this index serves that exact pattern.
jobSchema.index({ company_id: 1, deleted_at: 1 });

/**
 * The explicit "normal Job management" scope: excludes soft-deleted Jobs.
 * Spread into a query filter at each call site that represents ordinary
 * Job management or public Job access (job.service.ts, publicJob.service.ts,
 * application.service.ts's public submission check, hiringStep.service.ts's
 * Job-ownership check).
 *
 * Deliberately NOT a global Mongoose query middleware (e.g. a pre("find")
 * hook that silently injects this filter into every query against Job).
 * Some call sites must intentionally resolve a soft-deleted Job — e.g.
 * getAccessibleApplication() in applicationAccess.service.ts resolves an
 * Application's Job purely to verify company ownership, and must keep
 * working after that Job is later soft-deleted so HR can still view
 * historical Applications/Screenings. An invisible global filter would
 * silently break that case (or require an easy-to-forget per-query
 * "bypass" flag); requiring each call site to opt in explicitly instead
 * makes "does this query see deleted Jobs?" a visible, auditable decision
 * at the point it matters, rather than a behavior silently baked into a
 * shared query path that unrelated historical-resolution code also runs
 * through.
 */
export const NOT_DELETED_JOB_FILTER = { deleted_at: null } as const;

export type JobDoc = HydratedDocument<InferSchemaType<typeof jobSchema>>;

export const Job = model("Job", jobSchema);
