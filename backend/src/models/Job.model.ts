import { Schema, model, type FilterQuery, type InferSchemaType, type HydratedDocument } from "mongoose";
import { generatePublicId } from "../utils/publicId";

// Per ERD: only "status" is an enumerated field on jobs. employment_type and
// experience_level are plain strings in the ERD (no enumerated values given
// in the BRD/ERD), so they stay free-text here rather than inventing an enum.
export const JOB_STATUSES = ["draft", "active", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const jobSchema = new Schema(
  {
    // Opaque, URL-facing identifier — see utils/publicId.ts. Mongo `_id`
    // remains the internal identifier everywhere (relationships, indexes on
    // other collections, etc.); this field exists solely so a Job's own id
    // never has to appear in a URL/API response. `sparse: true` (not just
    // `unique: true`) is required, not optional: existing Jobs created
    // before this field existed have no public_id at all until the
    // separate backfill script (see scripts/backfillJobPublicIds.ts) runs,
    // and a plain unique index would reject every one of those documents
    // past the first for having a "duplicate" missing value. A sparse
    // index simply excludes documents that lack the field from the unique
    // constraint entirely, so deployment never has to be blocked on
    // backfill completing first.
    // Populated automatically by the pre("validate") hook below for every
    // NEW Job — never accepted from a request body (absent from both
    // createJobSchema and updateJobSchema in job.validation.ts) and never
    // reassigned once set (the hook only ever fires for `isNew` documents),
    // which is what makes it effectively immutable without needing
    // Mongoose's `immutable` schema option (whose query-level `updateOne`
    // semantics would otherwise complicate the backfill script).
    public_id: { type: String, unique: true, sparse: true },
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

// Assigns public_id exactly once, only for a brand-new document that
// doesn't already have one — covers every creation path uniformly
// (job.service.ts's createJob, the seed script, and every test's direct
// Job.create()) without each call site needing to remember to set it.
// Deliberately does nothing for an existing document being re-saved (guards
// on isNew), and deliberately does nothing if public_id is already present
// (guards on !this.public_id) — the backfill script assigns it directly via
// a query-level updateOne for legacy documents that predate this field,
// which never runs this hook (Mongoose document middleware only fires for
// `save()`/`create()`, not `updateOne`/`updateMany`), so this guard also
// prevents this hook from ever clobbering what the backfill wrote.
jobSchema.pre("validate", function assignPublicId(next) {
  if (this.isNew && !this.public_id) {
    this.public_id = generatePublicId("job");
  }
  next();
});

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
type JobShape = InferSchemaType<typeof jobSchema>;

/**
 * The one place a URL/route id param is turned into a Job lookup filter —
 * used by job.service.ts, publicJob.service.ts, and
 * application.service.ts's public submission Job resolution. Public-id
 * only (Phase 2 cutover — see this ticket's report): a legacy Mongo
 * ObjectId no longer resolves here, matching every migrated resource.
 * Kept as its own named function (not inlined at each call site) so this
 * remains the one place that decision lives, and so the shape stays
 * trivially swappable again if ever needed. Always spread alongside the
 * caller's own company/visibility filter (e.g.
 * `{ ...jobIdentifierFilter(id), ...NOT_DELETED_JOB_FILTER }`) — this
 * function only ever resolves WHICH document is being asked for, never
 * whether the caller is allowed to see it.
 */
export function jobIdentifierFilter(idParam: string): FilterQuery<JobShape> {
  return { public_id: idParam };
}

export const Job = model("Job", jobSchema);
