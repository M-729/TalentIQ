import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as offerService from "./offer.service";
import * as offerEmailService from "./offerEmail.service";
import { serializeOffer, serializeOfferNotification, type OfferDTO } from "./offer.serializer";
import { serializeApplicationDetail } from "../applications/applicationHr.serializer";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { HiringStep } from "../../models/HiringStep.model";
import { User } from "../../models/User.model";
import type { OfferDoc } from "../../models/Offer.model";
import { getLatestScreeningSummaries } from "../applications/applicationHr.service";
import type { CreateOfferInput, ListOffersQuery, UpdateOfferInput } from "./offer.validation";

// Resolves the responder's display name only when there IS one to resolve
// — responded_by_user_id is null both before any response and for every
// candidate response, so this skips the User lookup entirely in both of
// those (by far the most common) cases.
async function serializeOfferWithResponder(offer: OfferDoc): Promise<OfferDTO> {
  const respondedByName = offer.responded_by_user_id ? (await User.findById(offer.responded_by_user_id).select("name"))?.name ?? null : null;
  return serializeOffer(offer, respondedByName);
}

export const createOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.createOffer(req.auth!.companyId, req.auth!.userId, req.params.applicationId!, req.body as CreateOfferInput);
  res.status(201).json({ offer: await serializeOfferWithResponder(offer) });
});

// null (not 404) when the Application simply has no live offer yet — a
// normal state, matching getAssessmentForApplicationHandler's precedent.
export const getCurrentOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.getCurrentOfferForApplication(req.auth!.companyId, req.params.applicationId!);
  res.status(200).json({ offer: offer ? await serializeOfferWithResponder(offer) : null });
});

export const updateOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.updateOffer(req.auth!.companyId, req.auth!.userId, req.params.offerId!, req.body as UpdateOfferInput);
  res.status(200).json({ offer: await serializeOfferWithResponder(offer) });
});

export const withdrawOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.withdrawOffer(req.auth!.companyId, req.auth!.userId, req.params.offerId!);
  res.status(200).json({ offer: await serializeOfferWithResponder(offer) });
});

export const markOfferAcceptedHandler = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.markOfferAccepted(req.auth!.companyId, req.auth!.userId, req.params.offerId!);
  res.status(200).json({ offer: await serializeOfferWithResponder(offer) });
});

export const markOfferDeclinedHandler = asyncHandler(async (req: Request, res: Response) => {
  const offer = await offerService.markOfferDeclined(req.auth!.companyId, req.auth!.userId, req.params.offerId!);
  res.status(200).json({ offer: await serializeOfferWithResponder(offer) });
});

// Returns the updated Application (the same ApplicationDetailDTO shape
// every other Application mutation in this codebase responds with) so the
// frontend can update the Final Decision section without a second request.
export const markApplicationHiredHandler = asyncHandler(async (req: Request, res: Response) => {
  const { application, offer } = await offerService.markApplicationHired(req.auth!.companyId, req.auth!.userId, req.params.offerId!);

  const [candidate, job, screeningSummaries, currentStep] = await Promise.all([
    Candidate.findById(application.candidate_id),
    Job.findById(application.job_id),
    getLatestScreeningSummaries([application.id]),
    application.current_step_id ? HiringStep.findById(application.current_step_id).select("name type") : null,
  ]);

  res.status(200).json({
    application: serializeApplicationDetail(application, candidate!, job!, screeningSummaries.get(application.id), currentStep),
    offer: await serializeOfferWithResponder(offer),
  });
});

export const sendOfferHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await offerEmailService.sendOffer(req.auth!.companyId, req.auth!.userId, req.params.offerId!);
  res.status(201).json({ notification: serializeOfferNotification(notification) });
});

export const listOfferNotificationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await offerEmailService.listNotificationsForOffer(req.auth!.companyId, req.params.offerId!);
  res.status(200).json({ notifications: notifications.map(serializeOfferNotification) });
});

export const retryOfferNotificationHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await offerEmailService.retryOfferNotification(req.auth!.companyId, req.params.offerId!, req.params.notificationId!);
  res.status(200).json({ notification: serializeOfferNotification(notification) });
});

export const listOffersHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListOffersQuery;
  const { offers, total } = await offerService.listOffers(req.auth!.companyId, {
    jobId: query.jobId,
    status: query.status,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
  res.status(200).json({
    offers,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
});
