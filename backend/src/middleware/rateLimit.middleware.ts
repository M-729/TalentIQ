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

// The public Offer response lookup (GET-equivalent, read-only — see
// offerResponse.routes.ts) is a plausible target for token-guessing, so it
// gets its own limiter rather than sharing publicRateLimiter's more
// generous allowance meant for ordinary Careers browsing.
export const offerResponseLookupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: "Too many requests, please try again later" } },
});

// Stricter still — this is the actual mutating "respond" action. Generous
// enough to tolerate a genuine rapid double-click/retry, tight enough to
// meaningfully slow down token-guessing against the respond endpoint.
export const offerResponseRespondRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: "Too many requests, please try again later" } },
});

// Same rationale/shape as offerResponseLookupRateLimiter above, applied to
// the public Company Invitation lookup (see companyInvitationResponse
// .routes.ts) — a plausible target for token-guessing.
export const companyInvitationLookupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: "Too many requests, please try again later" } },
});

// Same rationale/shape as offerResponseRespondRateLimiter above, applied
// to the public Company Invitation accept endpoint — the actual mutating
// (account-creating) action.
export const companyInvitationAcceptRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: { message: "Too many requests, please try again later" } },
});

// Applied only to the explicit "run a new AI screening" route (a real,
// paid Groq call) — never to the latest/history read routes, which are
// plain database reads and share no limiter with this one. This route is
// authenticated, so it's limited per user (not per IP, which an office of
// HR users could otherwise share and throttle each other on); requireAuth
// runs before this in every route it's attached to, so req.auth is always
// populated by the time keyGenerator reads it, but req.ip is kept as a
// defensive fallback rather than assuming that can never change.
export const aiScreeningRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.AI_SCREENING_RATE_LIMIT_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? "unknown",
  message: { error: { message: "Too many AI screenings requested, please try again later" } },
});
