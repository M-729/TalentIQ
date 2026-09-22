import { z } from "zod";
import { INTERVIEW_FEEDBACK_RECOMMENDATIONS } from "../../models/InterviewFeedback.model";

const MAX_TEXT_LENGTH = 4000;

const feedbackText = (label: string) => z.string().trim().max(MAX_TEXT_LENGTH, `${label} is too long`);

// Draft save: every field optional and independently omittable — a field
// left out of this particular request is never overwritten (see
// interviewFeedback.service.ts's saveFeedbackDraft, which only $sets the
// fields actually present here), so an interviewer can save one section at
// a time without losing previously-saved content. `recommendation` may be
// explicitly `null` to clear a previously-chosen value.
export const saveFeedbackDraftSchema = z
  .object({
    recommendation: z.enum(INTERVIEW_FEEDBACK_RECOMMENDATIONS).nullable().optional(),
    summary: feedbackText("Summary").optional(),
    strengths: feedbackText("Strengths").optional(),
    concerns: feedbackText("Concerns").optional(),
    private_notes: feedbackText("Private notes").optional(),
  })
  .strict();

// Submission requires a real recommendation and a meaningful summary (this
// ticket's explicit rule); strengths/concerns/private_notes remain
// optional. Once accepted, the record becomes immutable — see
// submitFeedback's own doc comment.
export const submitFeedbackSchema = z
  .object({
    recommendation: z.enum(INTERVIEW_FEEDBACK_RECOMMENDATIONS, {
      errorMap: () => ({ message: "A recommendation is required to submit feedback" }),
    }),
    summary: z.string().trim().min(1, "A summary is required to submit feedback").max(MAX_TEXT_LENGTH, "Summary is too long"),
    strengths: feedbackText("Strengths").optional(),
    concerns: feedbackText("Concerns").optional(),
    private_notes: feedbackText("Private notes").optional(),
  })
  .strict();

export type SaveFeedbackDraftInput = z.infer<typeof saveFeedbackDraftSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
