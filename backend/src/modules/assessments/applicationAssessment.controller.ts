import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as applicationAssessmentService from "./applicationAssessment.service";
import * as applicationAssessmentEmailService from "./applicationAssessmentEmail.service";
import {
  serializeApplicationAssessment,
  serializeAssessmentNotification,
  serializeAssessmentNotifications,
} from "./applicationAssessment.serializer";
import type {
  CreateAssessmentInput,
  ListAssessmentsQuery,
  RecordAssessmentResultInput,
  UpdateAssessmentLinkInput,
} from "./applicationAssessment.validation";

export const createAssessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await applicationAssessmentService.createAssessment(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.applicationId!,
    req.body as CreateAssessmentInput
  );
  res.status(201).json({ assessment: serializeApplicationAssessment(assessment) });
});

// null (not 404) when the current stage simply has no assessment yet —
// this is a normal "not created yet" state the Application Detail page
// renders an "Add Assessment" prompt for, never an error.
export const getAssessmentForApplicationHandler = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await applicationAssessmentService.getAssessmentForCurrentStage(req.auth!.companyId, req.params.applicationId!);
  res.status(200).json({ assessment: assessment ? serializeApplicationAssessment(assessment) : null });
});

// Every assessment record this Application has ever had, oldest stage
// included — an empty array (never 404) when none exist yet.
export const listAssessmentHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const assessments = await applicationAssessmentService.listAssessmentHistoryForApplication(
    req.auth!.companyId,
    req.params.applicationId!
  );
  res.status(200).json({ assessments });
});

export const updateAssessmentLinkHandler = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await applicationAssessmentService.updateAssessmentLink(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.assessmentId!,
    req.body as UpdateAssessmentLinkInput
  );
  res.status(200).json({ assessment: serializeApplicationAssessment(assessment) });
});

export const recordAssessmentResultHandler = asyncHandler(async (req: Request, res: Response) => {
  const assessment = await applicationAssessmentService.recordAssessmentResult(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.assessmentId!,
    req.body as RecordAssessmentResultInput
  );
  res.status(200).json({ assessment: serializeApplicationAssessment(assessment) });
});

export const sendAssessmentInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await applicationAssessmentEmailService.sendAssessmentInvitation(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.assessmentId!
  );
  res.status(201).json({ notification: serializeAssessmentNotification(notification) });
});

export const listAssessmentNotificationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await applicationAssessmentEmailService.listNotificationsForAssessment(
    req.auth!.companyId,
    req.params.assessmentId!
  );
  res.status(200).json({ notifications: serializeAssessmentNotifications(notifications) });
});

export const retryAssessmentNotificationHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await applicationAssessmentEmailService.retryAssessmentNotification(
    req.auth!.companyId,
    req.params.assessmentId!,
    req.params.notificationId!
  );
  res.status(200).json({ notification: serializeAssessmentNotification(notification) });
});

export const listAssessmentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListAssessmentsQuery;
  const { assessments, total } = await applicationAssessmentService.listAssessments(req.auth!.companyId, {
    jobId: query.jobId,
    status: query.status,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
  res.status(200).json({
    assessments,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
});
