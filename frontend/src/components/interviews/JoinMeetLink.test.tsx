import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { canJoinMeet, JoinMeetLink } from "@/components/interviews/JoinMeetLink";
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
