import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// express-rate-limit's default store is in-memory and keyed by IP, so its
// counters persist across test cases run in the same process (Jest with
// --runInBand reuses one process for the whole suite). Without this, a
// test file that legitimately exercises a rate-limited route more times
// than its limit allows starts getting spurious 429s instead of the
// responses it's actually testing. Rate limiting itself is an operational
// concern, not something functional tests should incidentally trip over.
const skipInTest = () => env.NODE_ENV === "test";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
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
  skip: skipInTest,
  message: { error: { message: "Too many requests, please try again later" } },
});

// Stricter than publicRateLimiter: this gates a write that creates
// persistent records (Candidate/Application) and processes PII, so it
// warrants tighter abuse protection than a simple public read.
export const applicationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: "Too many applications submitted, please try again later" } },
});
