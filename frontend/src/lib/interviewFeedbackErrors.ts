import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same convention as interviewErrors.ts.

export function getInterviewFeedbackListErrorMessage(_err: unknown): string {
  return "Feedback could not be loaded. Please try again.";
}

export function getSaveFeedbackDraftErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 403:
        return "Only an interviewer assigned to this interview may submit feedback for it.";
      case 409:
        return "This feedback can no longer be edited. Refresh to see the latest state.";
      default:
        return "The draft could not be saved. Please try again.";
    }
  }
  return "The draft could not be saved. Please try again.";
}

export function getSubmitFeedbackErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please add a recommendation and a summary before submitting.";
      case 403:
        return "Only an interviewer assigned to this interview may submit feedback for it.";
      case 409:
        return "This feedback has already been submitted, or this interview is no longer completed.";
      default:
        return "The feedback could not be submitted. Please try again.";
    }
  }
  return "The feedback could not be submitted. Please try again.";
}
