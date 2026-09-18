import { z } from "zod";

// Empty-string optional URL fields are common from a plain HTML form
// (an untouched input submits "", not undefined) — normalize that to
// undefined before validating so an empty field isn't rejected as "not a
// valid URL", while a genuinely provided value is still format-checked.
const optionalUrl = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().url("Must be a valid URL").optional()
);

const optionalText = z.string().trim().optional();

export const submitApplicationSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  phone: optionalText,
  location: optionalText,
  linkedin_url: optionalUrl,
  portfolio_url: optionalUrl,
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
