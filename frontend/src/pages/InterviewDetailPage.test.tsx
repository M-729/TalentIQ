import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InterviewDetailPage } from "@/pages/InterviewDetailPage";
import { buildInterview } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as interviewsApi from "@/services/api/interviews";
import * as googleCalendarApi from "@/services/api/googleCalendarIntegration";
import * as usersApi from "@/services/api/users";
import * as interviewNotificationsApi from "@/services/api/interviewNotifications";
import * as interviewFeedbackApi from "@/services/api/interviewFeedback";
import { formatDateTime } from "@/lib/formatDate";
import type { InterviewDetail } from "@/types/interview";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/googleCalendarIntegration");
vi.mock("@/services/api/users");
vi.mock("@/services/api/interviewNotifications");
vi.mock("@/services/api/interviewFeedback");

function buildDetail(overrides: Partial<InterviewDetail> = {}): InterviewDetail {
  return {
    ...buildInterview(),
    candidate: { id: "candidate-1", name: "Sarah Ahmed", email: "sarah@example.test" },
    job: { id: "job-1", title: "Backend Developer" },
    ...overrides,
  };
}

function renderPage(interviewId = "interview-1") {
  return render(
    <MemoryRouter initialEntries={[`/interviews/${interviewId}`]}>
      <Routes>
        <Route path="/interviews/:interviewId" element={<InterviewDetailPage />} />
        <Route path="/interviews" element={<div>Interviews List Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewDetailPage", () => {
  beforeEach(() => {
    vi.mocked(interviewsApi.getInterview).mockReset();
    vi.mocked(interviewsApi.rescheduleInterview).mockReset();
    vi.mocked(interviewsApi.cancelInterview).mockReset();
    vi.mocked(interviewsApi.createGoogleCalendarEvent).mockReset();
    vi.mocked(interviewsApi.syncGoogleCalendarEvent).mockReset();
    vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockReset().mockResolvedValue({ connected: false });
    vi.mocked(usersApi.listInterviewerCandidates).mockReset().mockResolvedValue({
      users: [{ id: "user-1", name: "Alex Interviewer", email: "alex@example.test" }],
    });
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockReset().mockResolvedValue({ notifications: [] });
    vi.mocked(interviewsApi.completeInterview).mockReset();
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockReset().mockResolvedValue({
      interviewers: [],
      viewer: { assigned: false, can_edit: false, feedback: null },
    });
  });

  it("renders candidate, job, stage, and schedule details", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail() });
    renderPage();

    expect(await screen.findByText("Sarah Ahmed")).toBeInTheDocument();
    expect(screen.getByText("Backend Developer")).toBeInTheDocument();
    expect(screen.getAllByText("Technical Interview").length).toBeGreaterThan(0);
    expect(screen.getByText("Asia/Beirut")).toBeInTheDocument();
  });

  it("shows Reschedule, Cancel, and Mark as Completed actions only for a scheduled interview", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({
      interview: buildDetail({ status: "scheduled", ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
    });
    renderPage();

    expect(await screen.findByRole("button", { name: "Reschedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as Completed" })).toBeInTheDocument();
  });

  it("hides Reschedule, Cancel, and Mark as Completed for a cancelled interview (read-only history)", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({
      interview: buildDetail({ status: "cancelled", cancellation: { cancelled_at: "2024-01-02T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: "No longer needed" } }),
    });
    renderPage();

    await screen.findByText("Cancelled", { selector: "span" });
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Completed" })).not.toBeInTheDocument();
    expect(screen.getByText("No longer needed")).toBeInTheDocument();
  });

  it("hides Reschedule, Cancel, and Mark as Completed for a completed interview (read-only)", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "completed" }) });
    renderPage();

    await screen.findByText("Completed", { selector: "span" });
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as Completed" })).not.toBeInTheDocument();
  });

  // ===== RESCHEDULE =====
  describe("reschedule", () => {
    // The reschedule form pre-fills date/time from the CURRENT interview
    // and validates (client-side, mirroring the backend) that the
    // submitted start time is in the future — so the fixture interview
    // must itself be scheduled in the future for "Save changes" to submit
    // without any field edits.
    function futureIso(hoursFromNow: number): string {
      return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
    }

    it("reflects a successful local reschedule (new date/time shown)", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ starts_at: futureIso(24), ends_at: futureIso(25) }),
      });
      const rescheduled = buildDetail({ starts_at: "2024-03-01T10:00:00.000Z", ends_at: "2024-03-01T11:00:00.000Z" });
      vi.mocked(interviewsApi.rescheduleInterview).mockResolvedValue({ interview: rescheduled });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
      await screen.findByRole("heading", { name: "Reschedule interview" });
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(interviewsApi.rescheduleInterview).toHaveBeenCalled());
      expect(await screen.findByText(formatDateTime("2024-03-01T10:00:00.000Z"))).toBeInTheDocument();
    });

    it("does not show the reschedule as failed when the backend's best-effort Google sync fails", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          starts_at: futureIso(24),
          ends_at: futureIso(25),
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/a", last_synced_at: null },
        }),
      });
      // The backend's reschedule response: local reschedule succeeded
      // (200, new times persisted), but calendar.sync_status is "failed" —
      // this must NEVER be shown as the reschedule itself failing.
      const rescheduledWithSyncFailure = buildDetail({
        starts_at: "2024-03-01T10:00:00.000Z",
        ends_at: "2024-03-01T11:00:00.000Z",
        calendar: { provider: "google", connected: true, sync_status: "failed", meeting_url: null, last_synced_at: null },
      });
      vi.mocked(interviewsApi.rescheduleInterview).mockResolvedValue({ interview: rescheduledWithSyncFailure });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
      await screen.findByRole("heading", { name: "Reschedule interview" });
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      // The new time is reflected — the local reschedule is treated as a
      // success, not blocked/rolled back by the dialog.
      expect(await screen.findByText(formatDateTime("2024-03-01T10:00:00.000Z"))).toBeInTheDocument();
      // No generic "could not be rescheduled" failure text anywhere.
      expect(screen.queryByText(/could not be rescheduled/i)).not.toBeInTheDocument();
      // The calendar section instead surfaces the sync issue distinctly.
      expect(screen.getByText("Sync issue")).toBeInTheDocument();
    });
  });

  // ===== CANCEL =====
  describe("cancel", () => {
    it("requires confirmation before cancelling", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail() });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
      expect(await screen.findByRole("heading", { name: "Cancel interview" })).toBeInTheDocument();
      expect(interviewsApi.cancelInterview).not.toHaveBeenCalled();
    });

    it("preserves the cancelled state after confirming", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled" }) });
      vi.mocked(interviewsApi.cancelInterview).mockResolvedValue({
        interview: buildDetail({ status: "cancelled", cancellation: { cancelled_at: "2024-01-05T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: null } }),
      });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
      await screen.findByRole("heading", { name: "Cancel interview" });
      await userEvent.click(screen.getByRole("button", { name: "Cancel interview" }));

      await waitFor(() => expect(interviewsApi.cancelInterview).toHaveBeenCalled());
      expect(await screen.findByText("Cancelled", { selector: "span" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    });

    it("does not undo the cancelled UI state when the backend's best-effort Google sync fails", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          status: "scheduled",
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/a", last_synced_at: null },
        }),
      });
      vi.mocked(interviewsApi.cancelInterview).mockResolvedValue({
        interview: buildDetail({
          status: "cancelled",
          cancellation: { cancelled_at: "2024-01-05T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: null },
          calendar: { provider: "google", connected: true, sync_status: "failed", meeting_url: null, last_synced_at: null },
        }),
      });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
      await screen.findByRole("heading", { name: "Cancel interview" });
      await userEvent.click(screen.getByRole("button", { name: "Cancel interview" }));

      expect(await screen.findByText("Cancelled", { selector: "span" })).toBeInTheDocument();
      expect(screen.queryByText(/could not be cancelled/i)).not.toBeInTheDocument();
      expect(screen.getByText("Sync issue")).toBeInTheDocument();
    });

    it("still shows historical notification (sent/failed) events for a cancelled interview", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          status: "cancelled",
          cancellation: { cancelled_at: "2024-01-05T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: null },
        }),
      });
      vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
        notifications: [
          {
            id: "n-1",
            category: "interview_scheduled",
            status: "sent",
            subject: "Interview scheduled — Backend Developer",
            recipient_email: "sarah@example.test",
            attempted_at: "2026-09-21T19:03:00.000Z",
            sent_at: "2026-09-21T19:03:00.000Z",
            failure_code: null,
            attempt_count: 1,
            created_at: "2026-09-21T19:02:00.000Z",
          },
          {
            id: "n-2",
            category: "interview_cancelled",
            status: "failed",
            subject: "Interview cancelled — Backend Developer",
            recipient_email: "sarah@example.test",
            attempted_at: "2026-09-22T10:00:00.000Z",
            sent_at: null,
            failure_code: "smtp_unavailable",
            attempt_count: 1,
            created_at: "2026-09-22T09:59:00.000Z",
          },
        ],
      });
      renderPage();

      await screen.findByText("Cancelled", { selector: "span" });
      expect(await screen.findByText("Scheduled notification")).toBeInTheDocument();
      expect(await screen.findByText("Cancelled notification")).toBeInTheDocument();
      expect(screen.getByText("Sent")).toBeInTheDocument();
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  // ===== COMPLETE =====
  describe("complete", () => {
    function futureEndsAt(): string {
      return new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    it("requires confirmation before completing", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled", ends_at: futureEndsAt() }) });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Mark as Completed" }));
      expect(await screen.findByRole("heading", { name: "Mark interview as completed?" })).toBeInTheDocument();
      expect(interviewsApi.completeInterview).not.toHaveBeenCalled();
    });

    it("disables the confirm button while the request is pending, preventing a double submit", async () => {
      let resolveFn: (value: { interview: InterviewDetail }) => void = () => {};
      const pending = new Promise<{ interview: InterviewDetail }>((resolve) => {
        resolveFn = resolve;
      });
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled", ends_at: futureEndsAt() }) });
      vi.mocked(interviewsApi.completeInterview).mockReturnValue(pending);
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Mark as Completed" }));
      await screen.findByRole("heading", { name: "Mark interview as completed?" });
      const confirmButton = screen.getAllByRole("button", { name: "Mark as Completed" }).slice(-1)[0]!;
      await userEvent.click(confirmButton);

      const pendingButton = await screen.findByRole("button", { name: "Marking as completed…" });
      expect(pendingButton).toBeDisabled();
      expect(interviewsApi.completeInterview).toHaveBeenCalledTimes(1);

      resolveFn({ interview: buildDetail({ status: "completed", completion: { completed_at: "2026-09-22T10:00:00.000Z", completed_by: { id: "u1", name: "Hana HR" } } }) });
    });

    it("updates the UI to Completed after a successful completion", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled", ends_at: futureEndsAt() }) });
      vi.mocked(interviewsApi.completeInterview).mockResolvedValue({
        interview: buildDetail({
          status: "completed",
          completion: { completed_at: "2026-09-22T10:00:00.000Z", completed_by: { id: "u1", name: "Hana HR" } },
        }),
      });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Mark as Completed" }));
      await screen.findByRole("heading", { name: "Mark interview as completed?" });
      const confirmButton = screen.getAllByRole("button", { name: "Mark as Completed" }).slice(-1)[0]!;
      await userEvent.click(confirmButton);

      await waitFor(() => expect(interviewsApi.completeInterview).toHaveBeenCalled());
      expect(await screen.findByText("Completed", { selector: "span" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Mark as Completed" })).not.toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "Completion" })).toBeInTheDocument();
    });

    it("shows a time-ended reminder for a still-scheduled interview whose end time has passed", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", ends_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
      });
      renderPage();

      expect(await screen.findByText("Scheduled interview time has ended.")).toBeInTheDocument();
    });

    it("does not show the time-ended reminder for a still-future scheduled interview", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", ends_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }),
      });
      renderPage();

      await screen.findByRole("button", { name: "Reschedule" });
      expect(screen.queryByText("Scheduled interview time has ended.")).not.toBeInTheDocument();
    });
  });

  // ===== FEEDBACK =====
  describe("feedback section", () => {
    it("shows the Interview Feedback section only once the interview is completed", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "completed" }) });
      renderPage();

      expect(await screen.findByRole("heading", { name: "Interview Feedback" })).toBeInTheDocument();
    });

    it("does not show the Interview Feedback section for a scheduled interview", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled" }) });
      renderPage();

      await screen.findByRole("button", { name: "Reschedule" });
      expect(screen.queryByRole("heading", { name: "Interview Feedback" })).not.toBeInTheDocument();
    });

    it("does not show the Interview Feedback section for a cancelled interview", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "cancelled", cancellation: { cancelled_at: "2024-01-02T00:00:00.000Z", cancelled_by: null, reason: null } }),
      });
      renderPage();

      await screen.findByText("Cancelled", { selector: "span" });
      expect(screen.queryByRole("heading", { name: "Interview Feedback" })).not.toBeInTheDocument();
    });
  });

  // ===== CALENDAR ACTIONS =====
  describe("Google Calendar actions", () => {
    it("shows Add to Google Calendar only when connected and ready, and never auto-creates an event on page open", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ calendar: null }) });
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: true, calendar_permission_granted: true });
      renderPage();

      expect(await screen.findByRole("button", { name: "Add to Google Calendar" })).toBeInTheDocument();
      expect(interviewsApi.createGoogleCalendarEvent).not.toHaveBeenCalled();
    });

    it("shows a Settings link instead of Add to Google Calendar when not connected", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ calendar: null }) });
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: false });
      renderPage();

      expect(await screen.findByRole("link", { name: "Go to Settings" })).toHaveAttribute("href", "/settings/integrations");
      expect(screen.queryByRole("button", { name: "Add to Google Calendar" })).not.toBeInTheDocument();
    });

    it("shows Sync Calendar for a pending or failed sync, and Join Google Meet once a meeting_url exists", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ calendar: { provider: "google", connected: true, sync_status: "pending", meeting_url: null, last_synced_at: null } }),
      });
      renderPage();

      expect(await screen.findByRole("button", { name: "Sync Calendar" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
    });

    it("shows Join Google Meet once meeting_url is present", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/xyz", last_synced_at: null } }),
      });
      renderPage();

      const link = await screen.findByRole("link", { name: /Join Google Meet/ });
      expect(link).toHaveAttribute("href", "https://meet.google.com/xyz");
    });

    it("never shows Join Google Meet for a cancelled interview, even though meeting_url is preserved in history", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          status: "cancelled",
          cancellation: { cancelled_at: "2024-01-05T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: null },
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/xyz", last_synced_at: null },
        }),
      });
      renderPage();

      await screen.findByText("Cancelled", { selector: "span" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
    });

    it("never shows Join Google Meet for a completed interview, even though meeting_url is preserved in history", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          status: "completed",
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/xyz", last_synced_at: null },
        }),
      });
      renderPage();

      await screen.findByText("Completed", { selector: "span" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
    });
  });

  // ===== COPY MEET LINK =====
  describe("Copy Meet Link", () => {
    beforeEach(() => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    });

    const SYNCED_WITH_MEET = {
      provider: "google",
      connected: true,
      sync_status: "synced" as const,
      meeting_url: "https://meet.google.com/xyz",
      last_synced_at: null,
    };

    // 1 & 2. scheduled + meeting_url -> Join Meet and Copy Meet Link both shown
    it("shows both Join Google Meet and Copy Meet Link for a scheduled interview with a meeting_url", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();

      expect(await screen.findByRole("link", { name: /Join Google Meet/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy Meet Link" })).toBeInTheDocument();
    });

    // 3. no meeting_url -> Copy Meet Link absent
    it("hides Copy Meet Link when there is no meeting_url", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: { ...SYNCED_WITH_MEET, meeting_url: null } }),
      });
      renderPage();

      await screen.findByText("Synced");
      expect(screen.queryByRole("button", { name: "Copy Meet Link" })).not.toBeInTheDocument();
    });

    // 4. Copy Meet Link writes exactly the persisted meeting_url
    it("copies exactly the persisted meeting_url, never a reconstructed one", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Copy Meet Link" }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://meet.google.com/xyz");
    });

    // 5. successful copy produces feedback
    it('shows "Meet link copied" feedback after a successful copy', async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Copy Meet Link" }));

      expect(await screen.findByRole("button", { name: "Meet link copied" })).toBeInTheDocument();
    });

    // 6. clipboard failure produces safe feedback
    it("shows a safe failure message when the clipboard write fails, without exposing the raw error", async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("permission denied")) } });
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();

      await userEvent.click(await screen.findByRole("button", { name: "Copy Meet Link" }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/Could not copy the Meet link/);
      expect(alert.textContent).not.toMatch(/permission denied/);
    });

    // 7 & 8. completed Interview -> no active Join Meet / Copy Meet action
    it("hides both Join Google Meet and Copy Meet Link for a completed interview, even though meeting_url is preserved", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "completed", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();

      await screen.findByText("Completed", { selector: "span" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Copy Meet Link" })).not.toBeInTheDocument();
    });

    // 9 & 10. cancelled Interview -> no active Join Meet / Copy Meet action
    it("hides both Join Google Meet and Copy Meet Link for a cancelled interview, even though meeting_url is preserved", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          status: "cancelled",
          cancellation: { cancelled_at: "2024-01-05T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: null },
          calendar: SYNCED_WITH_MEET,
        }),
      });
      renderPage();

      await screen.findByText("Cancelled", { selector: "span" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Copy Meet Link" })).not.toBeInTheDocument();
    });

    // 11. unsynced eligible interview -> Add to Calendar shown per existing logic
    it("still shows Add to Google Calendar (not replaced) when there is no calendar event yet", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled", calendar: null }) });
      vi.mocked(googleCalendarApi.getGoogleCalendarStatus).mockResolvedValue({ connected: true, calendar_permission_granted: true });
      renderPage();

      expect(await screen.findByRole("button", { name: "Add to Google Calendar" })).toBeInTheDocument();
    });

    // 12. synced Interview does not show a duplicate Add to Calendar
    it("never shows Add to Google Calendar once a calendar event already exists (synced)", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();

      await screen.findByRole("button", { name: "Copy Meet Link" });
      expect(screen.queryByRole("button", { name: "Add to Google Calendar" })).not.toBeInTheDocument();
    });

    // 13. calendar sync failure does not hide Join/Copy Meet
    it("keeps Join Google Meet and Copy Meet Link available alongside a Calendar sync failure", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({
          status: "scheduled",
          calendar: { provider: "google", connected: true, sync_status: "failed", meeting_url: "https://meet.google.com/xyz", last_synced_at: null },
        }),
      });
      renderPage();

      expect(await screen.findByRole("button", { name: "Sync Calendar" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Join Google Meet/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy Meet Link" })).toBeInTheDocument();
    });

    // 14. action buttons are keyboard-accessible
    it("makes Join Google Meet and Copy Meet Link reachable via Tab", async () => {
      vi.mocked(interviewsApi.getInterview).mockResolvedValue({
        interview: buildDetail({ status: "scheduled", calendar: SYNCED_WITH_MEET }),
      });
      renderPage();
      await screen.findByRole("button", { name: "Copy Meet Link" });

      const joinLink = screen.getByRole("link", { name: /Join Google Meet/ });
      const copyButton = screen.getByRole("button", { name: "Copy Meet Link" });

      joinLink.focus();
      expect(joinLink).toHaveFocus();
      await userEvent.tab();
      expect(copyButton).toHaveFocus();
    });
  });

  // ===== ERROR / NOT FOUND =====
  describe("loading and errors", () => {
    it("shows a not-found state for a 404", async () => {
      vi.mocked(interviewsApi.getInterview).mockRejectedValue(new ApiError("Interview not found", 404));
      renderPage();
      expect(await screen.findByText("This interview is unavailable.")).toBeInTheDocument();
    });

    it("shows a safe error message, never a raw backend message, for a 500", async () => {
      vi.mocked(interviewsApi.getInterview).mockRejectedValue(new ApiError("raw stack trace detail", 500));
      renderPage();
      expect(await screen.findByText("This interview could not be loaded. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText(/raw stack trace detail/)).not.toBeInTheDocument();
    });
  });
});
