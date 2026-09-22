import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // Optional (not required to boot the app) so the rest of the backend
  // stays fully runnable — including the full test suite, via a mocked
  // storage service — without R2 being configured yet. CV upload itself
  // fails with a clear error if attempted while unset; see
  // services/storage/r2CvStorage.service.ts. No endpoint/region variable
  // is needed: R2's S3-compatible endpoint is derived from the account id,
  // and its region is always "auto".
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // Optional, same rationale as R2 above — the backend (and the full test
  // suite, which mocks the email service entirely) runs fine without these.
  // Sending an email without them configured fails clearly inside
  // smtpEmail.service.ts rather than silently doing nothing.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  // z.coerce.boolean() would treat the literal string "false" as truthy
  // (any non-empty string coerces to true) — an explicit string comparison
  // is used instead so SMTP_SECURE=false actually means false.
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("TalentIQ"),
  EMAIL_FROM_ADDRESS: z.string().optional(),

  // Optional, same rationale as R2/SMTP above — the backend (and the full
  // test suite, which mocks the AI service entirely) runs fine without
  // this. Attempting an AI generation while unset fails clearly inside
  // groqAi.service.ts. GROQ_MODEL has a real default (not just an empty
  // optional) so changing models later is a config change, not a code
  // change, without requiring every environment to set it explicitly.
  // Groq deprecates/retires hosted models over time (llama-3.3-70b-versatile,
  // this project's original default, was live-verified to now 404) — check
  // console.groq.com/docs/models for the current catalog if this ever needs
  // to change again.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("openai/gpt-oss-120b"),

  // Screenings trigger a real (paid) Groq call, so the explicit "run a new
  // screening" route is rate-limited per authenticated user — see
  // rateLimit.middleware.ts's aiScreeningRateLimiter. 20/hour is a
  // reasonable, development-safe default; production can tune it without a
  // code change.
  AI_SCREENING_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(20),

  // How long an AIScreeningRun may sit in "processing" before it's treated
  // as stale/interrupted (e.g. a backend crash/restart mid-screening) and
  // becomes safely retryable — see screeningRun.service.ts's isRunStale.
  // The single centralized source of this duration; never hard-code it
  // elsewhere. 15 minutes comfortably exceeds a real screening's normal
  // duration (CV extraction + one Groq call, seconds) while still
  // recovering promptly after a crash.
  AI_SCREENING_PROCESSING_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(15),

  // Google Calendar/Meet interview integration — optional, same rationale
  // as R2/SMTP/GROQ above: the backend (and the full test suite, which
  // mocks the Google provider entirely) runs fine without these.
  // Attempting an actual OAuth connect/callback or a Calendar API call
  // while unset fails clearly inside googleCalendarOAuth.service.ts /
  // googleCalendar.service.ts rather than silently doing nothing.
  // GOOGLE_CLIENT_SECRET and GOOGLE_TOKEN_ENCRYPTION_KEY are real secrets
  // — never fill them in .env.example, only in a local, gitignored .env.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  // Base64-encoded 32-byte (AES-256) key used to encrypt Google refresh
  // tokens at rest — see security/googleTokenEncryption.ts. Generate one
  // with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // Where the OAuth callback redirects the browser after success/failure
  // (e.g. /settings/integrations?googleCalendar=connected) — not a
  // secret, safe to default for local development.
  FRONTEND_URL: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

export const env = parsed.data;
export type Env = typeof env;
