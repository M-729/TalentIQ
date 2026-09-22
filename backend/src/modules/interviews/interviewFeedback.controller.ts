import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as interviewFeedbackService from "./interviewFeedback.service";
import { serializeInterviewFeedback, serializeInterviewFeedbackList } from "./interviewFeedback.serializer";
import type { SaveFeedbackDraftInput, SubmitFeedbackInput } from "./interviewFeedback.validation";

export const listInterviewFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await interviewFeedbackService.getFeedbackForInterview(req.params.interviewId!, req.auth!.companyId);
  res.status(200).json(serializeInterviewFeedbackList(result, req.auth!.userId));
});

// Who is submitting is ALWAYS req.auth.userId — the client can never
// supply interviewer_user_id in the request body (see
// interviewFeedback.validation.ts's .strict() schemas, which don't even
// accept the field).
export const saveOwnFeedbackDraftHandler = asyncHandler(async (req: Request, res: Response) => {
  const feedback = await interviewFeedbackService.saveFeedbackDraft(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.interviewId!,
    req.body as SaveFeedbackDraftInput
  );
  res.status(200).json({ feedback: serializeInterviewFeedback(feedback) });
});

export const submitOwnFeedbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const feedback = await interviewFeedbackService.submitFeedback(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.interviewId!,
    req.body as SubmitFeedbackInput
  );
  res.status(200).json({ feedback: serializeInterviewFeedback(feedback) });
});
