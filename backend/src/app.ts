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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
