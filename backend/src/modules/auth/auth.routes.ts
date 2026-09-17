import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { authRateLimiter } from "../../middleware/rateLimit.middleware";
import { loginSchema } from "./auth.validation";
import { loginHandler, logoutHandler, meHandler, refreshHandler } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", authRateLimiter, validate({ body: loginSchema }), loginHandler);
authRouter.post("/refresh", authRateLimiter, refreshHandler);
// Not gated behind requireAuth: logout must work even if the access token has
// already expired. It's authorized instead by possession of the httpOnly
// refresh-token cookie, which is all it actually revokes.
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", requireAuth, meHandler);
