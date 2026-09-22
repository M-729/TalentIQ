import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApplicationInterviewsSection } from "@/components/applications/ApplicationInterviewsSection";
import { buildApplicationDetail, buildInterview } from "@/test/fixtures";
import * as interviewsApi from "@/services/api/interviews";
import * as usersApi from "@/services/api/users";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/users");

function renderSection(application = buildApplicationDetail()) {
  return render(
    <MemoryRouter>
      <ApplicationInterviewsSection application={application} />
    </MemoryRouter>
  );
}

describe("ApplicationInterviewsSection", () => {
  beforeEach(() => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockReset();
    vi.mocked(usersApi.listInterviewerCandidates).mockReset().mockResolvedValue({ users: [] });
  });

  it("renders interview history for the application", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
      interviews: [buildInterview({ title: "Backend Technical Interview" })],
    });
    renderSection();

    expect(await screen.findByText("Backend Technical Interview")).toBeInTheDocument();
  });

  it("shows the empty state when no interviews have been scheduled", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({ interviews: [] });
    renderSection();

    expect(await screen.findByText("No interviews have been scheduled for this application.")).toBeInTheDocument();
  });

  it("shows Schedule Interview when the application is in_process and the current stage is an interview stage", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({ interviews: [] });
    renderSection(
      buildApplicationDetail({ status: "in_process", current_step: { id: "step-1", name: "Technical Interview", type: "interview" } })
    );

    expect(await screen.findByRole("button", { name: "Schedule Interview" })).toBeInTheDocument();
  });

  it("does not show Schedule Interview for a non-interview current stage", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({ interviews: [] });
    renderSection(
      buildApplicationDetail({ status: "in_process", current_step: { id: "step-1", name: "Application Review", type: "review" } })
    );

    await screen.findByText("No interviews have been scheduled for this application.");
    expect(screen.queryByRole("button", { name: "Schedule Interview" })).not.toBeInTheDocument();
  });

  it("does not show Schedule Interview when the application has no current stage", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({ interviews: [] });
    renderSection(buildApplicationDetail({ status: "applied", current_step: null }));

    await screen.findByText("No interviews have been scheduled for this application.");
    expect(screen.queryByRole("button", { name: "Schedule Interview" })).not.toBeInTheDocument();
  });

  it("does not show Schedule Interview when the application status is not in_process", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({ interviews: [] });
    renderSection(
      buildApplicationDetail({ status: "hired", current_step: { id: "step-1", name: "Technical Interview", type: "interview" } })
    );

    await screen.findByText("No interviews have been scheduled for this application.");
    expect(screen.queryByRole("button", { name: "Schedule Interview" })).not.toBeInTheDocument();
  });

  it("hides Schedule Interview and shows the existing interview instead when an active one already exists for the current stage", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
      interviews: [
        buildInterview({
          id: "existing-1",
          title: "Already Scheduled Interview",
          status: "scheduled",
          stage: { id: "step-1", name: "Technical Interview", type: "interview" },
        }),
      ],
    });
    renderSection(
      buildApplicationDetail({ status: "in_process", current_step: { id: "step-1", name: "Technical Interview", type: "interview" } })
    );

    expect(await screen.findByText("Already Scheduled Interview")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule Interview" })).not.toBeInTheDocument();
  });

  it("still shows Schedule Interview when a PAST interview for this stage is cancelled (not blocking a new one)", async () => {
    vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
      interviews: [
        buildInterview({
          id: "cancelled-1",
          status: "cancelled",
          stage: { id: "step-1", name: "Technical Interview", type: "interview" },
        }),
      ],
    });
    renderSection(
      buildApplicationDetail({ status: "in_process", current_step: { id: "step-1", name: "Technical Interview", type: "interview" } })
    );

    expect(await screen.findByRole("button", { name: "Schedule Interview" })).toBeInTheDocument();
  });

  // ===== JOIN MEET VISIBILITY =====
  describe("Join Google Meet visibility", () => {
    const SYNCED_CALENDAR_WITH_MEET = {
      provider: "google",
      connected: true,
      sync_status: "synced" as const,
      meeting_url: "https://meet.google.com/abc-defg-hij",
      last_synced_at: null,
    };

    it("shows Join Google Meet for a scheduled interview with a meeting_url", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "scheduled", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      expect(await screen.findByRole("link", { name: /Join Google Meet/ })).toBeInTheDocument();
    });

    it("hides Join Google Meet for a scheduled interview with no meeting_url", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "scheduled", calendar: { ...SYNCED_CALENDAR_WITH_MEET, meeting_url: null } })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
    });

    it("hides Join Google Meet for a cancelled interview, even though meeting_url is preserved in history", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "cancelled", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
    });

    it("hides Join Google Meet for a completed interview, even though meeting_url is preserved in history", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "completed", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
    });

    it("shows Copy Meet Link alongside Join Google Meet for a scheduled interview with a meeting_url", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "scheduled", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      expect(await screen.findByRole("button", { name: "Copy Meet Link" })).toBeInTheDocument();
    });

    it("copies the persisted meeting_url when Copy Meet Link is clicked", async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "scheduled", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      await userEvent.click(await screen.findByRole("button", { name: "Copy Meet Link" }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://meet.google.com/abc-defg-hij");
    });

    it("hides Copy Meet Link for a scheduled interview with no meeting_url", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "scheduled", calendar: { ...SYNCED_CALENDAR_WITH_MEET, meeting_url: null } })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByRole("button", { name: "Copy Meet Link" })).not.toBeInTheDocument();
    });

    it("hides Copy Meet Link for a completed interview, even though meeting_url is preserved in history", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "completed", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByRole("button", { name: "Copy Meet Link" })).not.toBeInTheDocument();
    });

    it("hides Copy Meet Link for a cancelled interview, even though meeting_url is preserved in history", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "cancelled", calendar: SYNCED_CALENDAR_WITH_MEET })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByRole("button", { name: "Copy Meet Link" })).not.toBeInTheDocument();
    });
  });

  // ===== COMPACT NOTIFICATION STATE =====
  describe("compact candidate notification status", () => {
    it('shows "Email sent" for a sent notification', async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ latest_notification: { category: "interview_scheduled", status: "sent" } })],
      });
      renderSection();

      expect(await screen.findByText("Email sent")).toBeInTheDocument();
    });

    it('shows "Email needs attention" for a failed notification', async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ latest_notification: { category: "interview_scheduled", status: "failed" } })],
      });
      renderSection();

      expect(await screen.findByText("Email needs attention")).toBeInTheDocument();
    });

    it("shows no notification status line when none has ever been attempted", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ latest_notification: null })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByText(/^Email /)).not.toBeInTheDocument();
    });
  });

  // ===== FEEDBACK PROGRESS (compact) =====
  describe("feedback progress", () => {
    // 27. completed Interview shows feedback count
    it("shows a partial feedback progress count for a completed interview", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "completed", feedback_progress: { submitted: 1, total: 2 } })],
      });
      renderSection();

      expect(await screen.findByText("Feedback 1 of 2 submitted")).toBeInTheDocument();
    });

    it('shows "Feedback complete" once every assigned interviewer has submitted', async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "completed", feedback_progress: { submitted: 2, total: 2 } })],
      });
      renderSection();

      expect(await screen.findByText("Feedback complete")).toBeInTheDocument();
    });

    it("never renders full feedback content on the Application page, only the compact count", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "completed", feedback_progress: { submitted: 1, total: 2 } })],
      });
      renderSection();

      await screen.findByText("Feedback 1 of 2 submitted");
      expect(screen.queryByText(/Strong Yes|Summary|Strengths|Concerns/)).not.toBeInTheDocument();
    });

    it("shows no feedback progress line for a scheduled interview", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ status: "scheduled", feedback_progress: null })],
      });
      renderSection();

      await screen.findByRole("link", { name: "Technical Interview" });
      expect(screen.queryByText(/^Feedback /)).not.toBeInTheDocument();
    });

    // 28. no N+1 feedback fetch per Interview row
    it("never fetches feedback separately — progress comes from the already-batched Interview DTO", async () => {
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [
          buildInterview({ id: "i-1", status: "completed", feedback_progress: { submitted: 1, total: 2 } }),
          buildInterview({ id: "i-2", status: "completed", feedback_progress: { submitted: 2, total: 2 } }),
        ],
      });
      renderSection();

      expect(await screen.findByText("Feedback 1 of 2 submitted")).toBeInTheDocument();
      expect(interviewsApi.listApplicationInterviews).toHaveBeenCalledTimes(1);
    });
  });
});
