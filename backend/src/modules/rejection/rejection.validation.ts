import { z } from "zod";
import { applicationIdentifierString } from "../applications/applicationHr.validation";

export const applicationIdParamsSchema = z.object({
  applicationId: applicationIdentifierString("application id"),
});

// `.strict()` — status/rejected_at/rejected_by are all backend-derived and
// never accepted from the client (see rejection.service.ts's
// rejectApplication). `send_email` is the one HR choice this action takes
// (see this ticket's explicit "[ ] Send rejection email" checkbox);
// `internal_reason` is optional HR-only context, NEVER forwarded to the
// candidate email (see Application.model.ts's rejection_reason doc
// comment).
export const rejectApplicationSchema = z
  .object({
    send_email: z.boolean(),
    internal_reason: z.string().trim().max(2000, "Reason is too long").nullable().optional(),
  })
  .strict();
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;
