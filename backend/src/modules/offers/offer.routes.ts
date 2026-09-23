import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createOfferHandler,
  getCurrentOfferHandler,
  listOfferNotificationsHandler,
  listOffersHandler,
  markApplicationHiredHandler,
  markOfferAcceptedHandler,
  markOfferDeclinedHandler,
  retryOfferNotificationHandler,
  sendOfferHandler,
  updateOfferHandler,
  withdrawOfferHandler,
} from "./offer.controller";
import {
  applicationIdParamsSchema,
  createOfferSchema,
  listOffersQuerySchema,
  notificationIdParamsSchema,
  offerActionBodySchema,
  offerIdParamsSchema,
  updateOfferSchema,
} from "./offer.validation";

// Mounted at /api/v1/applications/:applicationId/offer — mergeParams is
// required because :applicationId is defined on the parent mount path in
// app.ts, not on any route declared in this router (same pattern as
// applicationAssessmentCreateRouter).
export const offerCreateRouter = Router({ mergeParams: true });
offerCreateRouter.use(requireAuth, requireRole("HR", "ADMIN"));

offerCreateRouter.post("/", validate({ params: applicationIdParamsSchema, body: createOfferSchema }), createOfferHandler);
offerCreateRouter.get("/", validate({ params: applicationIdParamsSchema }), getCurrentOfferHandler);

// Mounted at /api/v1/offers — an Offer is addressed directly by its own
// id, matching applicationAssessmentRouter's own "addressed by id, not
// nested" precedent.
export const offerRouter = Router();
offerRouter.use(requireAuth, requireRole("HR", "ADMIN"));

offerRouter.get("/", validate({ query: listOffersQuerySchema }), listOffersHandler);

offerRouter.patch("/:offerId", validate({ params: offerIdParamsSchema, body: updateOfferSchema }), updateOfferHandler);
offerRouter.post("/:offerId/send", validate({ params: offerIdParamsSchema, body: offerActionBodySchema }), sendOfferHandler);
offerRouter.post("/:offerId/accept", validate({ params: offerIdParamsSchema, body: offerActionBodySchema }), markOfferAcceptedHandler);
offerRouter.post("/:offerId/decline", validate({ params: offerIdParamsSchema, body: offerActionBodySchema }), markOfferDeclinedHandler);
offerRouter.post("/:offerId/withdraw", validate({ params: offerIdParamsSchema, body: offerActionBodySchema }), withdrawOfferHandler);
offerRouter.post("/:offerId/hire", validate({ params: offerIdParamsSchema, body: offerActionBodySchema }), markApplicationHiredHandler);
offerRouter.get("/:offerId/notifications", validate({ params: offerIdParamsSchema }), listOfferNotificationsHandler);
offerRouter.post(
  "/:offerId/notifications/:notificationId/retry",
  validate({ params: notificationIdParamsSchema, body: offerActionBodySchema }),
  retryOfferNotificationHandler
);
