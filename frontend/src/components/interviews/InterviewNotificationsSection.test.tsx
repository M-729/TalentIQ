import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterviewNotificationsSection } from "@/components/interviews/InterviewNotificationsSection";
import { ApiError } from "@/services/api/client";
import * as interviewNotificationsApi from "@/services/api/interviewNotifications";
import type { InterviewNotification } from "@/types/interviewNotification";

vi.mock("@/services/api/interviewNotifications");

function buildNotification(overrides: Partial<InterviewNotification> = {}): InterviewNotification {
  return {
    id: "notification-1",
    category: "interview_scheduled",
    status: "sent",
    subject: "Interview scheduled — Backend Developer",
    recipient_email: "sarah@example.test",
    attempted_at: "2026-09-21T19:03:00.000Z",
    sent_at: "2026-09-21T19:03:00.000Z",
    failure_code: null,
    attempt_count: 1,
    created_at: "2026-09-21T19:02:00.000Z",
    ...overrides,
  };
}

describe("InterviewNotificationsSection", () => {
  beforeEach(() => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockReset();
    vi.mocked(interviewNotificationsApi.retryInterviewNotification).mockReset();
  });

  it("renders notification history", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification()],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    expect(await screen.findByText("Scheduled notification")).toBeInTheDocument();
  });

  it("renders a sent notification's state", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification({ status: "sent" })],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    expect(await screen.findByText("Sent")).toBeInTheDocument();
  });

  it("renders a failed notification's state", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification({ status: "failed", failure_code: "smtp_unavailable", sent_at: null })],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    expect(await screen.findByText("Failed")).toBeInTheDocument();
  });

  it("renders a pending notification's state", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification({ status: "pending", sent_at: null, attempted_at: null })],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    expect(await screen.findByText("Sending…")).toBeInTheDocument();
  });

  it("shows Retry Email only for a failed notification", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [
        buildNotification({ id: "n-sent", status: "sent" }),
        buildNotification({ id: "n-failed", status: "failed", failure_code: "delivery_failed", sent_at: null }),
      ],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    await screen.findAllByText("Scheduled notification");
    expect(screen.getAllByRole("button", { name: "Retry Email" })).toHaveLength(1);
  });

  it("does not show Retry Email for a sent notification", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification({ status: "sent" })],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    await screen.findByText("Sent");
    expect(screen.queryByRole("button", { name: "Retry Email" })).not.toBeInTheDocument();
  });

  it("a successful retry refetches and updates the displayed state", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications)
      .mockResolvedValueOnce({ notifications: [buildNotification({ status: "failed", failure_code: "smtp_unavailable", sent_at: null })] })
      .mockResolvedValueOnce({ notifications: [buildNotification({ status: "sent" })] });
    vi.mocked(interviewNotificationsApi.retryInterviewNotification).mockResolvedValue({ notification: buildNotification({ status: "sent" }) });

    render(<InterviewNotificationsSection interviewId="interview-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry Email" }));

    await waitFor(() => expect(interviewNotificationsApi.retryInterviewNotification).toHaveBeenCalledWith("notification-1"));
    expect(await screen.findByText("Sent")).toBeInTheDocument();
    expect(interviewNotificationsApi.listInterviewNotifications).toHaveBeenCalledTimes(2);
  });

  it("shows a safe message when retry itself fails, never a raw provider error", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification({ status: "failed", failure_code: "smtp_unavailable", sent_at: null })],
    });
    vi.mocked(interviewNotificationsApi.retryInterviewNotification).mockRejectedValue(
      new ApiError("raw nodemailer ECONNREFUSED 127.0.0.1:587 detail", 502)
    );

    render(<InterviewNotificationsSection interviewId="interview-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry Email" }));

    expect(await screen.findByText("The email could not be resent. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });

  it("never renders a raw failure_code/provider string anywhere", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({
      notifications: [buildNotification({ status: "failed", failure_code: "authentication_failed", sent_at: null })],
    });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    await screen.findByText("Failed");
    expect(screen.queryByText(/authentication_failed/)).not.toBeInTheDocument();
  });

  it("shows the empty state when there is no notification history", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockResolvedValue({ notifications: [] });
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    expect(await screen.findByText("No candidate notifications yet.")).toBeInTheDocument();
  });

  it("shows a safe error and Retry on a history load failure", async () => {
    vi.mocked(interviewNotificationsApi.listInterviewNotifications).mockRejectedValue(new ApiError("raw db error", 500));
    render(<InterviewNotificationsSection interviewId="interview-1" />);

    expect(await screen.findByText("Notification history could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db error/)).not.toBeInTheDocument();
  });
});
