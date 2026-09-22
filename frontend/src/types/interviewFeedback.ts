// Mirrors backend src/modules/interviews/interviewFeedback.serializer.ts and
// interviewFeedback.validation.ts exactly.
export const INTERVIEW_FEEDBACK_RECOMMENDATIONS = ["strong_yes", "yes", "mixed", "no", "strong_no"] as const;
export type InterviewFeedbackRecommendation = (typeof INTERVIEW_FEEDBACK_RECOMMENDATIONS)[number];

export type InterviewFeedbackStatus = "draft" | "submitted";
export type InterviewFeedbackRosterStatus = "not_started" | InterviewFeedbackStatus;

export interface FeedbackInterviewerRef {
  id: string;
  name: string;
  email: string;
}

export interface InterviewFeedback {
  id: string;
  interviewer: FeedbackInterviewerRef;
  status: InterviewFeedbackStatus;
  recommendation: InterviewFeedbackRecommendation | null;
  summary: string;
  strengths: string;
  concerns: string;
  private_notes: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewFeedbackRosterEntry {
  interviewer: FeedbackInterviewerRef;
  status: InterviewFeedbackRosterStatus;
  /** Full content only once submitted — never another interviewer's draft. */
  feedback: InterviewFeedback | null;
}

export interface InterviewFeedbackList {
  interviewers: InterviewFeedbackRosterEntry[];
  viewer: {
    assigned: boolean;
    can_edit: boolean;
    /** The viewer's OWN record (draft or submitted) — never another interviewer's. */
    feedback: InterviewFeedback | null;
  };
}

// Mirrors interviewFeedback.validation.ts's saveFeedbackDraftSchema — every
// field optional and independently omittable; an omitted field is never
// overwritten server-side (see services/api/interviewFeedback.ts).
export interface SaveFeedbackDraftInput {
  recommendation?: InterviewFeedbackRecommendation | null;
  summary?: string;
  strengths?: string;
  concerns?: string;
  private_notes?: string;
}

// Mirrors submitFeedbackSchema — recommendation and summary are required.
export interface SubmitFeedbackInput {
  recommendation: InterviewFeedbackRecommendation;
  summary: string;
  strengths?: string;
  concerns?: string;
  private_notes?: string;
}
