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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
}

export const env = parsed.data;
export type Env = typeof env;
