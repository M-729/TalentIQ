import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { InterviewTimeFields, type InterviewTimeValues } from "@/components/interviews/InterviewTimeFields";
import { InterviewerMultiSelect } from "@/components/interviews/InterviewerMultiSelect";
import { useRescheduleInterview } from "@/hooks/useRescheduleInterview";
import { utcIsoToZonedDateTime, zonedDateTimeToUtcIso } from "@/lib/timezone";
import type { Interview, RescheduleInterviewInput } from "@/types/interview";

const MAX_DURATION_HOURS = 8;

export interface RescheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: Interview;
  onRescheduled: (interview: Interview) => void;
}

interface FormErrors {
  date?: string;
  startTime?: string;
  endTime?: string;
  interviewers?: string;
}

function buildTimeValues(interview: Interview): InterviewTimeValues {
  const start = utcIsoToZonedDateTime(interview.starts_at, interview.timezone);
  const end = utcIsoToZonedDateTime(interview.ends_at, interview.timezone);
  return { date: start.date, startTime: start.time, endTime: end.time, timezone: interview.timezone };
}

interface RescheduleFormProps {
  interview: Interview;
  isSubmitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (input: RescheduleInterviewInput) => void;
}

function RescheduleInterviewForm({ interview, isSubmitting, serverError, onCancel, onSubmit }: RescheduleFormProps) {
  const [time, setTime] = useState<InterviewTimeValues>(() => buildTimeValues(interview));
  const [interviewerIds, setInterviewerIds] = useState<string[]>(() => interview.interviewers.map((i) => i.id));
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!time.date) nextErrors.date = "Date is required";
    if (!time.startTime) nextErrors.startTime = "Start time is required";
    if (!time.endTime) nextErrors.endTime = "End time is required";

    if (time.date && time.startTime && time.endTime) {
      const startsAtMs = new Date(zonedDateTimeToUtcIso(time.date, time.startTime, time.timezone)).getTime();
      const endsAtMs = new Date(zonedDateTimeToUtcIso(time.date, time.endTime, time.timezone)).getTime();

      if (startsAtMs <= Date.now()) {
        nextErrors.startTime = "Start time must be in the future";
      } else if (endsAtMs <= startsAtMs) {
        nextErrors.endTime = "End time must be after the start time";
      } else if (endsAtMs - startsAtMs > MAX_DURATION_HOURS * 60 * 60 * 1000) {
        nextErrors.endTime = `Interview duration cannot exceed ${MAX_DURATION_HOURS} hours`;
      }
    }

    if (interviewerIds.length === 0) {
      nextErrors.interviewers = "At least one interviewer is required";
    }

    return nextErrors;
  }

  function handleSubmit() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    onSubmit({
      starts_at: zonedDateTimeToUtcIso(time.date, time.startTime, time.timezone),
      ends_at: zonedDateTimeToUtcIso(time.date, time.endTime, time.timezone),
      timezone: time.timezone,
      interviewer_user_ids: interviewerIds,
    });
  }

  return (
    <div className="space-y-4">
      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{serverError}</p>
        </div>
      )}

      <InterviewTimeFields values={time} onChange={setTime} disabled={isSubmitting} errors={errors} idPrefix="reschedule-interview" />

      <div className="space-y-1.5">
        <Label htmlFor="reschedule-interview-interviewers">
          Interviewer(s)<span className="text-destructive"> *</span>
        </Label>
        <InterviewerMultiSelect
          selectedIds={interviewerIds}
          onChange={setInterviewerIds}
          disabled={isSubmitting}
          error={errors.interviewers}
          describedById={errors.interviewers ? "reschedule-interview-interviewers-error" : undefined}
        />
        {errors.interviewers && (
          <p id="reschedule-interview-interviewers-error" role="alert" className="text-xs text-destructive">
            {errors.interviewers}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Local reschedule is always authoritative — see useRescheduleInterview's
// doc comment. The caller (InterviewDetailPage) is responsible for
// surfacing the returned interview's calendar.sync_status separately
// (e.g. a "Google Calendar needs attention" banner) rather than treating
// a sync failure as this dialog's own failure.
export function RescheduleInterviewDialog({ open, onOpenChange, interview, onRescheduled }: RescheduleInterviewDialogProps) {
  const { run, isSubmitting, error, clearError } = useRescheduleInterview();

  async function handleSubmit(input: RescheduleInterviewInput) {
    const updated = await run(interview.id, input);
    if (updated) {
      onOpenChange(false);
      onRescheduled(updated);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clearError();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule interview</DialogTitle>
        </DialogHeader>
        {open && (
          <RescheduleInterviewForm
            interview={interview}
            isSubmitting={isSubmitting}
            serverError={error}
            onCancel={() => onOpenChange(false)}
            onSubmit={(input) => void handleSubmit(input)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
