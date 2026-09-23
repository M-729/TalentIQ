import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as rejectionService from "./rejection.service";
import { serializeApplicationDetail } from "../applications/applicationHr.serializer";
import { serializeRejectionNotification } from "./rejection.serializer";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { getLatestScreeningSummaries } from "../applications/applicationHr.service";
import { HiringStep } from "../../models/HiringStep.model";
import type { RejectApplicationInput } from "./rejection.validation";

// Reuses ApplicationDetailDTO — the standard, already-established shape
// every Application mutation in this codebase responds with (see
// stageTransition.controller.ts's moveApplicationStageHandler for the
// exact same precedent).
export const rejectApplicationHandler = asyncHandler(async (req: Request, res: Response) => {
  const { application, notification } = await rejectionService.rejectApplication(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.applicationId!,
    req.body as RejectApplicationInput
  );

  const [candidate, job, screeningSummaries, currentStep] = await Promise.all([
    Candidate.findById(application.candidate_id),
    Job.findById(application.job_id),
    getLatestScreeningSummaries([application.id]),
    application.current_step_id ? HiringStep.findById(application.current_step_id).select("name type") : null,
  ]);

  res.status(200).json({
    application: serializeApplicationDetail(application, candidate!, job!, screeningSummaries.get(application.id), currentStep),
    notification: notification ? serializeRejectionNotification(notification) : null,
  });
});

export const retryRejectionEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await rejectionService.retryRejectionEmail(req.auth!.companyId, req.params.applicationId!);
  res.status(200).json({ notification: serializeRejectionNotification(notification) });
});

export const getRejectionInfoHandler = asyncHandler(async (req: Request, res: Response) => {
  const info = await rejectionService.getRejectionInfo(req.auth!.companyId, req.params.applicationId!);
  res.status(200).json({ rejection: info });
});
