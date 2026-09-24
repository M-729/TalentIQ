import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InterviewTimeFields, type InterviewTimeValues } from "@/components/interviews/InterviewTimeFields";
import { InterviewerMultiSelect } from "@/components/interviews/InterviewerMultiSelect";
import { useGoogleCalendarEventActions } from "@/hooks/useGoogleCalendarEventActions";
import { useGoogleCalendarStatus } from "@/hooks/useGoogleCalendarStatus";
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
  /** Whether the authenticated user's Google connection is active AND has the Calendar permission granted — mirrors InterviewCalendarActions' own isReady check exactly. */
  isCalendarReady: boolean;
  onCancel: () => void;
  onSubmit: (input: ScheduleInterviewInput, addToCalendar: boolean) => void;
}

// A separate inner component, mounted only while the dialog is open, so
// its local form state resets cleanly on every open — same pattern as
// MoveApplicationDialog's MoveApplicationForm / HiringStepFormDialog's
// HiringStepForm.
function ScheduleInterviewForm({ defaultTitle, isSubmitting, serverError, isCalendarReady, onCancel, onSubmit }: ScheduleFormProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [time, setTime] = useState<InterviewTimeValues>(buildTimeValues);
  const [interviewerIds, setInterviewerIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  // Optional and OFF by default — this dialog only ever calls Google
  // Calendar because HR explicitly opted in here, never because a
  // meeting_url or an interview-type stage exists (see this ticket's
  // explicit "do not auto-add" rule).
  const [addToCalendar, setAddToCalendar] = useState(false);

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

    onSubmit(
      {
        title: title.trim() || undefined,
        starts_at: zonedDateTimeToUtcIso(time.date, time.startTime, time.timezone),
        ends_at: zonedDateTimeToUtcIso(time.date, time.endTime, time.timezone),
        timezone: time.timezone,
        interviewer_user_ids: interviewerIds,
      },
      addToCalendar && isCalendarReady
    );
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

      {/* Optional, explicit, and off by default — Calendar/Meet is never
          created just because this dialog opens or an interview-type
          stage exists (see this ticket). Disabled (never a silently
          broken checked option) when Google isn't connected or lacks the
          Calendar permission, same readiness rule InterviewCalendarActions
          already uses. */}
      <div className="flex items-start gap-2">
        <Checkbox
          id="schedule-interview-add-to-calendar"
          checked={addToCalendar}
          onChange={(e) => setAddToCalendar(e.target.checked)}
          disabled={isSubmitting || !isCalendarReady}
          className="mt-0.5"
        />
        <div className="space-y-0.5">
          <Label
            htmlFor="schedule-interview-add-to-calendar"
            className={!isCalendarReady ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          >
            Add to Google Calendar &amp; create Google Meet
          </Label>
          <p className="text-xs text-muted-foreground">
            {isCalendarReady ? (
              "Creates a Google Calendar event and Meet link after the interview is scheduled."
            ) : (
              <>
                Connect Google Calendar in Settings to create a Meet link.{" "}
                <Link to="/settings/integrations" className="font-medium text-primary underline underline-offset-2">
                  Go to Settings
                </Link>
              </>
            )}
          </p>
        </div>
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
//
// The optional "Add to Google Calendar & create Google Meet" checkbox
// (see ScheduleInterviewForm) runs as a strict SECOND step, only after the
// local Interview is already successfully persisted — this dialog never
// calls Google before that, and never rolls back / deletes the Interview
// if Google fails afterward. It reuses the exact same
// createEvent/useGoogleCalendarEventActions action "Add to Google
// Calendar" already uses elsewhere (InterviewCalendarActions) — no second
// Calendar implementation, no manually-constructed Meet URL.
export function ScheduleInterviewDialog({ open, onOpenChange, applicationId, defaultTitle, onScheduled }: ScheduleInterviewDialogProps) {
  const { run, isSubmitting: isScheduling, error: scheduleError, clearError: clearScheduleError } = useScheduleInterview();
  const { status } = useGoogleCalendarStatus();
  const {
    createEvent,
    isSubmitting: isCreatingCalendarEvent,
    error: calendarError,
    clearError: clearCalendarError,
  } = useGoogleCalendarEventActions();
  // Set only when the local Interview was created successfully but the
  // opted-in Calendar step then failed — the dialog stays open just long
  // enough to show that safely, since the Interview itself is already a
  // done deal and the parent must still be told about it (see handleClose
  // below). Never set for the "unchecked" or "calendar succeeded" paths,
  // which close immediately exactly as this dialog always has.
  const [calendarFailureNotice, setCalendarFailureNotice] = useState<Interview | null>(null);

  const isCalendarReady = !!status?.connected && !!status.calendar_permission_granted;
  const isSubmitting = isScheduling || isCreatingCalendarEvent;

  async function handleSubmit(input: ScheduleInterviewInput, addToCalendar: boolean) {
    const interview = await run(applicationId, input);
    // Local scheduling failed — scheduleError is already set and the form
    // stays open showing it, same as before this ticket. Google is never
    // even attempted.
    if (!interview) return;

    if (!addToCalendar) {
      onOpenChange(false);
      onScheduled(interview);
      return;
    }

    const updated = await createEvent(interview.id);
    if (updated) {
      onOpenChange(false);
      onScheduled(updated);
    } else {
      // Google failed (a real Calendar/Meet failure, safely mapped by
      // getCalendarActionErrorMessage) — the Interview itself is NOT
      // rolled back. calendarError already holds a safe message; the
      // existing Sync Calendar retry action remains available once the
      // caller's refetch/navigation shows this Interview again.
      setCalendarFailureNotice(interview);
    }
  }

  function handleCloseAfterCalendarFailure() {
    if (!calendarFailureNotice) return;
    const interview = calendarFailureNotice;
    setCalendarFailureNotice(null);
    onOpenChange(false);
    onScheduled(interview);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          clearScheduleError();
          clearCalendarError();
          setCalendarFailureNotice(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription className="sr-only">Schedule an interview for this candidate.</DialogDescription>
        </DialogHeader>
        {open && calendarFailureNotice && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">
                Interview scheduled. The Google Calendar event could not be created — {calendarError} You can retry from Interview
                Detail.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleCloseAfterCalendarFailure}>
                Got it
              </Button>
            </DialogFooter>
          </div>
        )}
        {open && !calendarFailureNotice && (
          <ScheduleInterviewForm
            defaultTitle={defaultTitle}
            isSubmitting={isSubmitting}
            serverError={scheduleError}
            isCalendarReady={isCalendarReady}
            onCancel={() => onOpenChange(false)}
            onSubmit={(input, addToCalendar) => void handleSubmit(input, addToCalendar)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
