import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ScheduleInterviewDialog } from "@/components/interviews/ScheduleInterviewDialog";
import { buildInterview } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as interviewsApi from "@/services/api/interviews";
import * as googleCalendarApi from "@/services/api/googleCalendarIntegration";
import * as usersApi from "@/services/api/users";
import type { Interview } from "@/types/interview";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/googleCalendarIntegration");
vi.mock("@/services/api/users");

const INTERVIEWER = { id: "user-1", name: "Alex Interviewer", email: "alex@example.test" };

function futureDateParts(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const date = d.toISOString().slice(0, 10);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

// The checkbox starts disabled until useGoogleCalendarStatus's own
// independent fetch resolves (never gated on the interviewer-list load
// fillValidForm waits on) — wait for it to become enabled before clicking,
// so this can't flake under slower/full-suite load.
async function checkAddToCalendar() {
  const checkbox = await screen.findByRole("checkbox", { name: "Add to Google Calendar & create Google Meet" });
  await waitFor(() => expect(checkbox).toBeEnabled());
  await userEvent.click(checkbox);
}

async function fillValidForm() {
  const start = futureDateParts(48);
  const end = futureDateParts(49);
  await userEvent.type(screen.getByLabelText(/^Date/), start.date);
  await userEvent.type(screen.getByLabelText(/^Start time/), start.time);
  await userEvent.type(screen.getByLabelText(/^End time/), end.time);
  await userEvent.click(screen.getByText(INTERVIEWER.name));
}

describe("ScheduleInterviewDialog", () => {
  beforeEach(() => {
    vi.mocked(interviewsApi.scheduleInterview).mockReset();
    vi.mocked(interviewsApi.createGoogleCalendarEvent).mockReset();
    vi.mocked(usersApi.listInterviewerCandidates).mockReset().mockResolvedValue({ users: [INTERVIEWER] });
    // Connected + ready by default in most tests — the "Add to Google
    // Calendar" checkbox stays OFF regardless (opt-in, never auto-checked),
    // so this alone must never cause createGoogleCalendarEvent to be
    // called; the dedicated "Optional Google Calendar" describe block below
    // overrides this per test to cover the not-connected/not-permitted cases.
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus)
      .mockReset()
      .mockResolvedValue({ connected: true, calendar_permission_granted: true });
  });

  function renderDialog(onScheduled = vi.fn(), onOpenChange = vi.fn()) {
    render(
      <MemoryRouter>
        <ScheduleInterviewDialog
          open
          onOpenChange={onOpenChange}
          applicationId="application-1"
          defaultTitle="Technical Interview"
          onScheduled={onScheduled}
        />
      </MemoryRouter>
    );
    return { onScheduled, onOpenChange };
  }

  it("defaults the title field to the current stage name", async () => {
    renderDialog();
    const titleInput = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(titleInput.placeholder).toBe("Technical Interview");
  });

  it("requires at least one interviewer", async () => {
    renderDialog();
    await screen.findByLabelText(/^Date/);

    const start = futureDateParts(48);
    const end = futureDateParts(49);
    await userEvent.type(screen.getByLabelText(/^Date/), start.date);
    await userEvent.type(screen.getByLabelText(/^Start time/), start.time);
    await userEvent.type(screen.getByLabelText(/^End time/), end.time);
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    expect(await screen.findByText("At least one interviewer is required")).toBeInTheDocument();
    expect(interviewsApi.scheduleInterview).not.toHaveBeenCalled();
  });

  it("sends a valid request DTO with ISO starts_at/ends_at, timezone, and selected interviewer ids", async () => {
    vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview() });
    renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    await waitFor(() => expect(interviewsApi.scheduleInterview).toHaveBeenCalled());
    const [applicationId, body] = vi.mocked(interviewsApi.scheduleInterview).mock.calls[0]!;
    expect(applicationId).toBe("application-1");
    expect(body.interviewer_user_ids).toEqual(["user-1"]);
    expect(() => new Date(body.starts_at).toISOString()).not.toThrow();
    expect(body.starts_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(body.ends_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(typeof body.timezone).toBe("string");
    expect(body.timezone.length).toBeGreaterThan(0);
  });

  it("calls onScheduled and closes on success", async () => {
    const interview = buildInterview({ id: "new-interview-1" });
    vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview });
    const { onScheduled } = renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    await waitFor(() => expect(onScheduled).toHaveBeenCalledWith(interview));
  });

  it("shows a safe message for a duplicate/existing-interview conflict (409), never the raw backend message", async () => {
    vi.mocked(interviewsApi.scheduleInterview).mockRejectedValue(new ApiError("E11000 duplicate key error", 409));
    renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    expect(
      await screen.findByText(
        "An interview is already scheduled for this stage, or this application is not currently eligible for scheduling."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/E11000/)).not.toBeInTheDocument();
  });

  it("shows a safe message for a generic server error, never the raw backend message", async () => {
    vi.mocked(interviewsApi.scheduleInterview).mockRejectedValue(new ApiError("TypeError: cannot read x of undefined", 500));
    renderDialog();
    await screen.findByLabelText(/^Date/);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

    expect(await screen.findByText("The interview could not be scheduled. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });

  // ===== OPTIONAL GOOGLE CALENDAR =====
  describe("optional Google Calendar checkbox", () => {
    // 1. shows the optional Calendar control
    it("shows the optional Add to Google Calendar checkbox with helper text", async () => {
      renderDialog();
      await screen.findByLabelText(/^Date/);

      const checkbox = screen.getByRole("checkbox", { name: "Add to Google Calendar & create Google Meet" });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
      expect(screen.getByText("Creates a Google Calendar event and Meet link after the interview is scheduled.")).toBeInTheDocument();
    });

    // 10. connected/ready -> control enabled
    it("enables the checkbox when Google is connected and the Calendar permission is granted", async () => {
      renderDialog();
      await screen.findByLabelText(/^Date/);
      // The checkbox starts disabled until useGoogleCalendarStatus's own
      // independent fetch resolves (it isn't gated on the interviewer
      // list load the "Date" field depends on) — wait for that instead of
      // asserting immediately.
      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: "Add to Google Calendar & create Google Meet" })).toBeEnabled()
      );
    });

    // 8. disconnected Google -> control unavailable/explanatory state
    it("disables the checkbox and shows a Settings link when Google is not connected", async () => {
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: false });
      renderDialog();
      await screen.findByLabelText(/^Date/);

      expect(await screen.findByRole("checkbox", { name: "Add to Google Calendar & create Google Meet" })).toBeDisabled();
      expect(screen.getByText(/Connect Google Calendar in Settings/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Go to Settings" })).toHaveAttribute("href", "/settings/integrations");
    });

    // 9. missing required Calendar permission -> control unavailable appropriately
    it("disables the checkbox when connected but the Calendar permission was not granted", async () => {
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: true, calendar_permission_granted: false });
      renderDialog();
      await screen.findByLabelText(/^Date/);

      expect(await screen.findByRole("checkbox", { name: "Add to Google Calendar & create Google Meet" })).toBeDisabled();
      expect(screen.getByText(/Connect Google Calendar in Settings/)).toBeInTheDocument();
    });

    // 2. unchecked -> schedule API called, Calendar API not called
    it("calls only the schedule API (never Calendar) when the checkbox is left unchecked", async () => {
      vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview({ id: "new-interview-1" }) });
      renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      await waitFor(() => expect(interviewsApi.scheduleInterview).toHaveBeenCalledTimes(1));
      expect(interviewsApi.createGoogleCalendarEvent).not.toHaveBeenCalled();
    });

    // 3 & 4. checked -> schedule succeeds then Calendar creation called with
    // the new interview's id, only after the local schedule resolved.
    it("calls Calendar creation with the newly scheduled interview's id only after local scheduling succeeds", async () => {
      vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview({ id: "new-interview-1" }) });
      vi.mocked(interviewsApi.createGoogleCalendarEvent).mockResolvedValue({
        interview: buildInterview({ id: "new-interview-1", calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/abc-defg-hij", last_synced_at: null } }),
      });
      renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await checkAddToCalendar();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      await waitFor(() => expect(interviewsApi.scheduleInterview).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(interviewsApi.createGoogleCalendarEvent).toHaveBeenCalledWith("new-interview-1"));

      const scheduleOrder = vi.mocked(interviewsApi.scheduleInterview).mock.invocationCallOrder[0]!;
      const calendarOrder = vi.mocked(interviewsApi.createGoogleCalendarEvent).mock.invocationCallOrder[0]!;
      expect(scheduleOrder).toBeLessThan(calendarOrder);
    });

    it("passes the fully Calendar-synced interview (with the real meeting_url) to onScheduled when both steps succeed", async () => {
      const syncedInterview = buildInterview({
        id: "new-interview-1",
        calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/abc-defg-hij", last_synced_at: null },
      });
      vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview({ id: "new-interview-1" }) });
      vi.mocked(interviewsApi.createGoogleCalendarEvent).mockResolvedValue({ interview: syncedInterview });
      const { onScheduled } = renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await checkAddToCalendar();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      await waitFor(() => expect(onScheduled).toHaveBeenCalledWith(syncedInterview));
    });

    // 5. local schedule failure -> Calendar API never called
    it("never calls the Calendar API when local scheduling itself fails, even if checked", async () => {
      vi.mocked(interviewsApi.scheduleInterview).mockRejectedValue(new ApiError("boom", 500));
      renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await checkAddToCalendar();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      expect(await screen.findByText("The interview could not be scheduled. Please try again.")).toBeInTheDocument();
      expect(interviewsApi.createGoogleCalendarEvent).not.toHaveBeenCalled();
    });

    // 6. Calendar failure -> Interview remains created / no duplicate scheduling retry
    it("does not re-call the schedule API when only the Calendar step fails", async () => {
      vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview({ id: "new-interview-1" }) });
      vi.mocked(interviewsApi.createGoogleCalendarEvent).mockRejectedValue(new ApiError("Google is down", 502));
      renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await checkAddToCalendar();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      await screen.findByRole("alert");
      expect(interviewsApi.scheduleInterview).toHaveBeenCalledTimes(1);
    });

    // 7. Calendar failure shows safe recoverable message
    it("shows a safe recoverable message (never the raw backend error) when the Calendar step fails, and keeps the Interview", async () => {
      const interview = buildInterview({ id: "new-interview-1" });
      vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview });
      vi.mocked(interviewsApi.createGoogleCalendarEvent).mockRejectedValue(new ApiError("raw google provider stack trace", 502));
      const { onScheduled, onOpenChange } = renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await checkAddToCalendar();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/Interview scheduled/);
      expect(alert.textContent).toMatch(/Google Calendar could not complete this request/);
      expect(alert.textContent).not.toMatch(/raw google provider stack trace/);

      // The dialog stays open to show the notice — the Interview was not
      // reported to the caller yet, and it is definitely not rolled back.
      expect(onScheduled).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalledWith(false);

      // Dismissing the notice is what finally tells the caller the
      // Interview exists (so its list/board refetch picks up the real,
      // already-persisted "sync failed" Calendar state from the server).
      await userEvent.click(screen.getByRole("button", { name: "Got it" }));
      expect(onScheduled).toHaveBeenCalledWith(interview);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // 11. rapid repeated submit -> one Interview creation
    it("only schedules the interview once even if Schedule Interview is clicked repeatedly", async () => {
      let resolveSchedule: (value: { interview: Interview }) => void = () => {};
      vi.mocked(interviewsApi.scheduleInterview).mockReturnValue(
        new Promise((resolve) => {
          resolveSchedule = resolve;
        })
      );
      renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();

      const submitButton = screen.getByRole("button", { name: "Schedule Interview" });
      await userEvent.click(submitButton);
      expect(screen.getByRole("button", { name: "Scheduling…" })).toBeDisabled();
      await userEvent.click(screen.getByRole("button", { name: "Scheduling…" }));

      resolveSchedule({ interview: buildInterview({ id: "new-interview-1" }) });
      await waitFor(() => expect(interviewsApi.scheduleInterview).toHaveBeenCalledTimes(1));
    });

    // 12. checked flow -> one Calendar creation
    it("only creates one Calendar event even under a rapid repeated submit", async () => {
      vi.mocked(interviewsApi.scheduleInterview).mockResolvedValue({ interview: buildInterview({ id: "new-interview-1" }) });
      let resolveCalendar: (value: { interview: Interview }) => void = () => {};
      vi.mocked(interviewsApi.createGoogleCalendarEvent).mockReturnValue(
        new Promise((resolve) => {
          resolveCalendar = resolve;
        })
      );
      renderDialog();
      await screen.findByLabelText(/^Date/);
      await fillValidForm();
      await checkAddToCalendar();
      await userEvent.click(screen.getByRole("button", { name: "Schedule Interview" }));

      await waitFor(() => expect(interviewsApi.createGoogleCalendarEvent).toHaveBeenCalledTimes(1));
      // The button stays disabled throughout the Calendar step too — the
      // combined operation, not just the first request, blocks a second
      // submit.
      expect(screen.getByRole("button", { name: "Scheduling…" })).toBeDisabled();

      resolveCalendar({
        interview: buildInterview({ id: "new-interview-1", calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/x", last_synced_at: null } }),
      });
      await waitFor(() => expect(interviewsApi.scheduleInterview).toHaveBeenCalledTimes(1));
      expect(interviewsApi.createGoogleCalendarEvent).toHaveBeenCalledTimes(1);
    });
  });
});
