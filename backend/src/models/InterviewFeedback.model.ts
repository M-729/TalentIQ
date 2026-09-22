import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

export const INTERVIEW_FEEDBACK_STATUSES = ["draft", "submitted"] as const;
export type InterviewFeedbackStatus = (typeof INTERVIEW_FEEDBACK_STATUSES)[number];

// Deliberately NOT a numeric 1-5 scorecard (technical skills, communication,
// etc.) — those dimensions are role/interview dependent and would become
// another hard-coded workflow; see this ticket's explicit "why no generic
// numeric score yet" rationale. A single overall human recommendation plus
// free-text sections keeps this professional without inventing a universal
// scoring system. Structured, configurable scorecards may be added later if
// product requirements require them.
export const INTERVIEW_FEEDBACK_RECOMMENDATIONS = ["strong_yes", "yes", "mixed", "no", "strong_no"] as const;
export type InterviewFeedbackRecommendation = (typeof INTERVIEW_FEEDBACK_RECOMMENDATIONS)[number];

const MAX_TEXT_LENGTH = 4000;

/**
 * Frozen at the moment this interviewer's FIRST feedback record is created
 * for this Interview — never re-synced from the live User document
 * afterward. Historical feedback must still identify who submitted it even
 * if that User's name/email later changes (e.g. after a legal name change
 * or an email migration) — same rationale as
 * EmailNotification.model.ts's event_snapshot and Interview.model.ts's own
 * stage_snapshot.
 */
const interviewerSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false }
);

/**
 * One interviewer's feedback for one Interview — never a general scorecard,
 * never AI-generated, never used to automatically move the Application
 * (see interviewFeedback.service.ts's explicit "feedback never mutates the
 * pipeline" contract). Only the assigned interviewer themselves may create/
 * edit their own record (enforced server-side via req.auth.userId — the
 * client can never supply interviewer_user_id to impersonate another User).
 *
 * A draft may be saved repeatedly with partial content. Once submitted,
 * this ticket treats the record as immutable — no silent re-editing after
 * submission; a future correction/audit workflow could allow amendments if
 * required.
 */
const interviewFeedbackSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    interview_id: { type: Schema.Types.ObjectId, ref: "Interview", required: true },
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    interviewer_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

    interviewer_snapshot: { type: interviewerSnapshotSchema, required: true },

    status: { type: String, enum: INTERVIEW_FEEDBACK_STATUSES, default: "draft", required: true },

    // Nullable while draft — required only at submission time (enforced by
    // interviewFeedback.validation.ts's submitFeedbackSchema, not here).
    recommendation: { type: String, enum: [...INTERVIEW_FEEDBACK_RECOMMENDATIONS, null], default: null },

    summary: { type: String, trim: true, maxlength: MAX_TEXT_LENGTH, default: "" },
    strengths: { type: String, trim: true, maxlength: MAX_TEXT_LENGTH, default: "" },
    concerns: { type: String, trim: true, maxlength: MAX_TEXT_LENGTH, default: "" },
    // "Private" from the CANDIDATE (never emailed/exposed to them, no
    // public route) — NOT private from other same-company HR/Admin, who
    // may read it once this record is submitted (see this ticket's
    // explicit Interview Detail feedback UX, which displays it alongside
    // summary/strengths/concerns for every submitted entry).
    private_notes: { type: String, trim: true, maxlength: MAX_TEXT_LENGTH, default: "" },

    submitted_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// One feedback record per (Interview, interviewer) — the database-level
// guarantee behind "one interviewer has one feedback record for that
// Interview" (see interviewFeedback.service.ts, which also pre-checks this
// for a fast/friendly reject and catches this index's duplicate-key error
// as the race-safety net, same pattern as Interview.model.ts's own
// scheduling index).
interviewFeedbackSchema.index({ interview_id: 1, interviewer_user_id: 1 }, { unique: true });

export type InterviewFeedbackDoc = HydratedDocument<InferSchemaType<typeof interviewFeedbackSchema>>;

export const InterviewFeedback = model("InterviewFeedback", interviewFeedbackSchema);
