import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many attempts, please try again later" } },
});

// Public, unauthenticated endpoints have no per-user identity to throttle
// by, so IP-based limiting is the only practical abuse guard. More
// generous than auth's since legitimate candidate/job-board traffic is
// expected to be higher-volume than login attempts.
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many requests, please try again later" } },
});
