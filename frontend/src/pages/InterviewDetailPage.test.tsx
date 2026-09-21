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
import { formatDateTime } from "@/lib/formatDate";
import type { InterviewDetail } from "@/types/interview";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/googleCalendarIntegration");
vi.mock("@/services/api/users");
vi.mock("@/services/api/interviewNotifications");

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
  });

  it("renders candidate, job, stage, and schedule details", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail() });
    renderPage();

    expect(await screen.findByText("Sarah Ahmed")).toBeInTheDocument();
    expect(screen.getByText("Backend Developer")).toBeInTheDocument();
    expect(screen.getAllByText("Technical Interview").length).toBeGreaterThan(0);
    expect(screen.getByText("Asia/Beirut")).toBeInTheDocument();
  });

  it("shows Reschedule and Cancel actions only for a scheduled interview", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "scheduled" }) });
    renderPage();

    expect(await screen.findByRole("button", { name: "Reschedule" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("hides Reschedule and Cancel for a cancelled interview (read-only history)", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({
      interview: buildDetail({ status: "cancelled", cancellation: { cancelled_at: "2024-01-02T00:00:00.000Z", cancelled_by: { id: "u1", name: "Hana HR" }, reason: "No longer needed" } }),
    });
    renderPage();

    await screen.findByText("Cancelled", { selector: "span" });
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByText("No longer needed")).toBeInTheDocument();
  });

  it("hides Reschedule and Cancel for a completed interview (read-only)", async () => {
    vi.mocked(interviewsApi.getInterview).mockResolvedValue({ interview: buildDetail({ status: "completed" }) });
    renderPage();

    await screen.findByText("Completed", { selector: "span" });
    expect(screen.queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
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
