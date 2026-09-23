import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env";
import { isDBConnected } from "./config/db";
import { authRouter } from "./modules/auth/auth.routes";
import { jobRouter } from "./modules/jobs/job.routes";
import { publicJobRouter } from "./modules/publicJobs/publicJob.routes";
import { applicationHrRouter } from "./modules/applications/applicationHr.routes";
import { screeningRouter } from "./modules/screenings/screening.routes";
import { hiringStepRouter } from "./modules/hiringPipeline/hiringStep.routes";
import { hiringPipelineBoardRouter } from "./modules/hiringPipeline/hiringPipelineBoard.routes";
import { stageTransitionRouter } from "./modules/stageTransitions/stageTransition.routes";
import { interviewDetailRouter, interviewRouter } from "./modules/interviews/interview.routes";
import { interviewNotificationRetryRouter } from "./modules/interviews/interviewNotificationRetry.routes";
import { applicationAssessmentCreateRouter, applicationAssessmentRouter } from "./modules/assessments/applicationAssessment.routes";
import { rejectionRouter } from "./modules/rejection/rejection.routes";
import { offerCreateRouter, offerRouter } from "./modules/offers/offer.routes";
import { offerResponseRouter } from "./modules/offerResponse/offerResponse.routes";
import { googleCalendarOAuthRouter } from "./modules/integrations/googleCalendar/googleCalendarOAuth.routes";
import { userRouter } from "./modules/users/user.routes";
import { teamRouter } from "./modules/team/team.routes";
import { companyInvitationResponseRouter } from "./modules/companyInvitationResponse/companyInvitationResponse.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { emailActivityRouter } from "./modules/emailActivity/emailActivity.routes";
import { hiringAnalyticsRouter } from "./modules/hiringAnalytics/hiringAnalytics.routes";
import { notFoundHandler } from "./middleware/notFound.middleware";
import { errorHandler } from "./middleware/error.middleware";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.get("/health", (_req, res) => {
    const dbConnected = isDBConnected();
    res.status(dbConnected ? 200 : 503).json({
      status: dbConnected ? "ok" : "degraded",
      db: dbConnected ? "connected" : "disconnected",
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/jobs", jobRouter);
  app.use("/api/v1/public/jobs", publicJobRouter);
  app.use("/api/v1/applications", applicationHrRouter);
  app.use("/api/v1/applications/:applicationId/screenings", screeningRouter);
  app.use("/api/v1/jobs/:jobId/hiring-steps", hiringStepRouter);
  app.use("/api/v1/jobs/:jobId/hiring-pipeline", hiringPipelineBoardRouter);
  app.use("/api/v1/applications/:applicationId", stageTransitionRouter);
  app.use("/api/v1/applications/:applicationId/interviews", interviewRouter);
  app.use("/api/v1/interviews", interviewDetailRouter);
  app.use("/api/v1/interview-notifications", interviewNotificationRetryRouter);
  app.use("/api/v1/applications/:applicationId/assessment", applicationAssessmentCreateRouter);
  app.use("/api/v1/application-assessments", applicationAssessmentRouter);
  app.use("/api/v1/applications/:applicationId/reject", rejectionRouter);
  app.use("/api/v1/applications/:applicationId/offer", offerCreateRouter);
  app.use("/api/v1/offers", offerRouter);
  app.use("/api/v1/public/offer-response", offerResponseRouter);
  app.use("/api/v1/integrations/google-calendar", googleCalendarOAuthRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/team", teamRouter);
  app.use("/api/v1/public/company-invitations", companyInvitationResponseRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/email-activity", emailActivityRouter);
  app.use("/api/v1/hiring-analytics", hiringAnalyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
