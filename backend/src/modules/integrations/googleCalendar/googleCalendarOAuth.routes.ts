import { Router } from "express";
import { requireAuth } from "../../../middleware/auth.middleware";
import { requireRole } from "../../../middleware/role.middleware";
import { connectHandler, callbackHandler, statusHandler, disconnectHandler } from "./googleCalendarOAuth.controller";

// Mounted at /api/v1/integrations/google-calendar.
export const googleCalendarOAuthRouter = Router();

googleCalendarOAuthRouter.get("/connect", requireAuth, requireRole("HR", "ADMIN"), connectHandler);

// Deliberately NO requireAuth/requireRole — this route is reached by a
// raw browser redirect from Google, which cannot carry this app's Bearer
// Authorization header. See googleCalendarOAuth.controller.ts's
// callbackHandler doc comment for how it authorizes itself instead (by
// consuming a one-time state record an authenticated /connect call
// created).
googleCalendarOAuthRouter.get("/callback", callbackHandler);

googleCalendarOAuthRouter.get("/status", requireAuth, requireRole("HR", "ADMIN"), statusHandler);
googleCalendarOAuthRouter.delete("/", requireAuth, requireRole("HR", "ADMIN"), disconnectHandler);
