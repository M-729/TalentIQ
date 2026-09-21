import { z } from "zod";
import { Types } from "mongoose";
import { isValidIanaTimeZone } from "../../utils/timezone";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const applicationIdParamsSchema = z.object({
  applicationId: objectIdString("application id"),
});

export const interviewIdParamsSchema = z.object({
  interviewId: objectIdString("interview id"),
});

const MAX_DURATION_MS = 8 * 60 * 60 * 1000;

const title = z.string().trim().min(1, "Title cannot be empty").max(150, "Title is too long").optional();
const timezone = z
  .string()
  .trim()
  .refine(isValidIanaTimeZone, { message: "Invalid IANA timezone (e.g. Asia/Beirut, Europe/Berlin)" });
const interviewerUserIds = z
  .array(objectIdString("interviewer id"))
  .min(1, "At least one interviewer is required");

/**
 * Cross-field time-range validation shared by schedule and reschedule
 * (both accept starts_at/ends_at with identical rules): starts_at must be
 * in the future, ends_at must be strictly after starts_at, and the
 * duration is capped at a sane maximum so a malformed/malicious payload
 * can't create a week-long "interview" block. Field-level `.datetime()`
 * below already guarantees both are well-formed ISO strings before this
 * runs, so `new Date(...)` here can't produce `Invalid Date`.
 */
function validateTimeRange(data: { starts_at: string; ends_at: string }, ctx: z.RefinementCtx): void {
  const startsAt = new Date(data.starts_at);
  const endsAt = new Date(data.ends_at);

  if (startsAt.getTime() <= Date.now()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "starts_at must be in the future", path: ["starts_at"] });
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ends_at must be after starts_at", path: ["ends_at"] });
    return;
  }

  if (endsAt.getTime() - startsAt.getTime() > MAX_DURATION_MS) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Interview duration cannot exceed 8 hours", path: ["ends_at"] });
  }
}

// `.strict()` — application_id/job_id/hiring_step_id/stage_snapshot/
// status/scheduled_by/company_id/timestamps/calendar fields are all
// backend-derived; rejecting an unknown field outright matches the same
// deliberate divergence hiringStep.validation.ts and
// stageTransition.validation.ts already use for identical reasons.
export const scheduleInterviewSchema = z
  .object({
    title,
    starts_at: z.string().datetime({ message: "Invalid starts_at" }),
    ends_at: z.string().datetime({ message: "Invalid ends_at" }),
    timezone,
    interviewer_user_ids: interviewerUserIds,
  })
  .strict()
  .superRefine(validateTimeRange);

// Title is deliberately absent — reschedule changes timing/interviewers
// only, never title (kept as its own focused concern rather than
// coupling unrelated edits to one route). interviewer_user_ids is
// optional: rescheduling without touching interviewers is a normal case.
export const rescheduleInterviewSchema = z
  .object({
    starts_at: z.string().datetime({ message: "Invalid starts_at" }),
    ends_at: z.string().datetime({ message: "Invalid ends_at" }),
    timezone,
    interviewer_user_ids: interviewerUserIds.optional(),
  })
  .strict()
  .superRefine(validateTimeRange);

export const cancelInterviewSchema = z
  .object({
    reason: z.string().trim().max(1000, "Reason is too long").optional(),
  })
  .strict();

export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;
export type RescheduleInterviewInput = z.infer<typeof rescheduleInterviewSchema>;
export type CancelInterviewInput = z.infer<typeof cancelInterviewSchema>;
