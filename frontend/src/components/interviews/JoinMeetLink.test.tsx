import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyMeetLinkButton, canJoinMeet, JoinMeetLink } from "@/components/interviews/JoinMeetLink";
import type { InterviewCalendar, InterviewStatus } from "@/types/interview";

const SYNCED_CALENDAR: InterviewCalendar = {
  provider: "google",
  connected: true,
  sync_status: "synced",
  meeting_url: "https://meet.google.com/abc-defg-hij",
  last_synced_at: null,
};

function withStatusAndCalendar(status: InterviewStatus, calendar: InterviewCalendar | null) {
  return { status, calendar };
}

describe("canJoinMeet", () => {
  it("is true when scheduled and meeting_url exists", () => {
    expect(canJoinMeet(withStatusAndCalendar("scheduled", SYNCED_CALENDAR))).toBe(true);
  });

  it("is false when scheduled but there is no meeting_url", () => {
    expect(canJoinMeet(withStatusAndCalendar("scheduled", { ...SYNCED_CALENDAR, meeting_url: null }))).toBe(false);
  });

  it("is false when scheduled but there is no calendar integration at all", () => {
    expect(canJoinMeet(withStatusAndCalendar("scheduled", null))).toBe(false);
  });

  it("is false when cancelled even though meeting_url exists (preserved in history)", () => {
    expect(canJoinMeet(withStatusAndCalendar("cancelled", SYNCED_CALENDAR))).toBe(false);
  });

  it("is false when completed even though meeting_url exists (preserved in history)", () => {
    expect(canJoinMeet(withStatusAndCalendar("completed", SYNCED_CALENDAR))).toBe(false);
  });
});

describe("JoinMeetLink", () => {
  it("renders a link to exactly the given URL, opened in a new tab safely", () => {
    render(<JoinMeetLink url="https://meet.google.com/abc-defg-hij" />);
    const link = screen.getByRole("link", { name: /Join Google Meet/ });
    expect(link).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});

describe("CopyMeetLinkButton", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("is keyboard-accessible with a meaningful accessible name", () => {
    render(<CopyMeetLinkButton url="https://meet.google.com/abc-defg-hij" />);
    const button = screen.getByRole("button", { name: "Copy Meet Link" });
    button.focus();
    expect(button).toHaveFocus();
  });

  it("copies exactly the given persisted URL to the clipboard, never a reconstructed one", async () => {
    render(<CopyMeetLinkButton url="https://meet.google.com/abc-defg-hij" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy Meet Link" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://meet.google.com/abc-defg-hij");
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });

  it('shows "Meet link copied" feedback on the button after a successful copy', async () => {
    render(<CopyMeetLinkButton url="https://meet.google.com/abc-defg-hij" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy Meet Link" }));

    expect(await screen.findByRole("button", { name: "Meet link copied" })).toBeInTheDocument();
  });

  it("shows a safe accessible failure message when the clipboard write rejects, without exposing the raw error", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError: permission denied")) },
    });
    render(<CopyMeetLinkButton url="https://meet.google.com/abc-defg-hij" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy Meet Link" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Could not copy the Meet link\. Please copy it manually/);
    expect(alert.textContent).not.toMatch(/NotAllowedError|permission denied/);
  });

  it("keeps the URL visible/selectable in the failure message so it can still be copied manually", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<CopyMeetLinkButton url="https://meet.google.com/abc-defg-hij" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy Meet Link" }));

    expect(await screen.findByText("https://meet.google.com/abc-defg-hij")).toBeInTheDocument();
  });

  it("does not leave a stale failure message after a later successful copy", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyMeetLinkButton url="https://meet.google.com/abc-defg-hij" />);

    const button = screen.getByRole("button", { name: "Copy Meet Link" });
    await userEvent.click(button);
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Copy Meet Link" }));

    expect(await screen.findByRole("button", { name: "Meet link copied" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
