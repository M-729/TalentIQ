import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InterviewTimeFields, type InterviewTimeValues } from "@/components/interviews/InterviewTimeFields";
import { InterviewerMultiSelect } from "@/components/interviews/InterviewerMultiSelect";
import { useScheduleInterview } from "@/hooks/useScheduleInterview";
import { getBrowserTimeZone, zonedDateTimeToUtcIso } from "@/lib/timezone";
import type { Interview, ScheduleInterviewInput } from "@/types/interview";

const MAX_DURATION_HOURS = 8;

export interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  /** The current interview-type HiringStep's name — used as the title's default, per this ticket's explicit requirement. */
  defaultTitle: string;
  onScheduled: (interview: Interview) => void;
}

interface FormErrors {
  date?: string;
  startTime?: string;
  endTime?: string;
  interviewers?: string;
}

function buildTimeValues(): InterviewTimeValues {
  return { date: "", startTime: "", endTime: "", timezone: getBrowserTimeZone() };
}

interface ScheduleFormProps {
  defaultTitle: string;
  isSubmitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (input: ScheduleInterviewInput) => void;
}

// A separate inner component, mounted only while the dialog is open, so
// its local form state resets cleanly on every open — same pattern as
// MoveApplicationDialog's MoveApplicationForm / HiringStepFormDialog's
// HiringStepForm.
function ScheduleInterviewForm({ defaultTitle, isSubmitting, serverError, onCancel, onSubmit }: ScheduleFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [time, setTime] = useState<InterviewTimeValues>(buildTimeValues);
  const [interviewerIds, setInterviewerIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!time.date) nextErrors.date = "Date is required";
    if (!time.startTime) nextErrors.startTime = "Start time is required";
    if (!time.endTime) nextErrors.endTime = "End time is required";

    if (time.date && time.startTime && time.endTime) {
      const startsAtIso = zonedDateTimeToUtcIso(time.date, time.startTime, time.timezone);
      const endsAtIso = zonedDateTimeToUtcIso(time.date, time.endTime, time.timezone);
      const startsAtMs = new Date(startsAtIso).getTime();
      const endsAtMs = new Date(endsAtIso).getTime();

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
      title: title.trim() || undefined,
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

      <div className="space-y-1.5">
        <Label htmlFor="schedule-interview-title">Title</Label>
        <Input
          id="schedule-interview-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitle}
          disabled={isSubmitting}
        />
      </div>

      <InterviewTimeFields values={time} onChange={setTime} disabled={isSubmitting} errors={errors} idPrefix="schedule-interview" />

      <div className="space-y-1.5">
        <Label htmlFor="schedule-interview-interviewers">
          Interviewer(s)<span className="text-destructive"> *</span>
        </Label>
        <InterviewerMultiSelect
          selectedIds={interviewerIds}
          onChange={setInterviewerIds}
          disabled={isSubmitting}
          error={errors.interviewers}
          describedById={errors.interviewers ? "schedule-interview-interviewers-error" : undefined}
        />
        {errors.interviewers && (
          <p id="schedule-interview-interviewers-error" role="alert" className="text-xs text-destructive">
            {errors.interviewers}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Scheduling…" : "Schedule Interview"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Scheduling is always an explicit HR action performed here — nothing
// about entering an interview-type stage ever opens or submits this
// dialog automatically (see the callers: ApplicationInterviewsSection,
// the pipeline board's contextual action).
export function ScheduleInterviewDialog({ open, onOpenChange, applicationId, defaultTitle, onScheduled }: ScheduleInterviewDialogProps) {
  const { run, isSubmitting, error, clearError } = useScheduleInterview();

  async function handleSubmit(input: ScheduleInterviewInput) {
    const interview = await run(applicationId, input);
    if (interview) {
      onOpenChange(false);
      onScheduled(interview);
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
          <DialogTitle>Schedule interview</DialogTitle>
        </DialogHeader>
        {open && (
          <ScheduleInterviewForm
            defaultTitle={defaultTitle}
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
