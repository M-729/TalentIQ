import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterviewFeedbackSection } from "@/components/interviews/InterviewFeedbackSection";
import { ApiError } from "@/services/api/client";
import * as interviewFeedbackApi from "@/services/api/interviewFeedback";
import type { InterviewFeedback, InterviewFeedbackList, InterviewFeedbackRosterEntry } from "@/types/interviewFeedback";

vi.mock("@/services/api/interviewFeedback");

function buildFeedback(overrides: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    id: "feedback-1",
    interviewer: { id: "user-1", name: "Alice Interviewer", email: "alice@example.test" },
    status: "submitted",
    recommendation: "strong_yes",
    summary: "Excellent technical depth.",
    strengths: "Great communicator",
    concerns: "None",
    private_notes: "Would hire immediately",
    submitted_at: "2026-09-22T10:00:00.000Z",
    created_at: "2026-09-22T09:00:00.000Z",
    updated_at: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

function buildRosterEntry(overrides: Partial<InterviewFeedbackRosterEntry> = {}): InterviewFeedbackRosterEntry {
  return {
    interviewer: { id: "user-1", name: "Alice Interviewer", email: "alice@example.test" },
    status: "not_started",
    feedback: null,
    ...overrides,
  };
}

function buildList(overrides: Partial<InterviewFeedbackList> = {}): InterviewFeedbackList {
  return {
    interviewers: [],
    viewer: { assigned: false, can_edit: false, feedback: null },
    ...overrides,
  };
}

describe("InterviewFeedbackSection", () => {
  beforeEach(() => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockReset();
    vi.mocked(interviewFeedbackApi.saveOwnFeedbackDraft).mockReset();
    vi.mocked(interviewFeedbackApi.submitOwnFeedback).mockReset();
  });

  // 23. multiple interviewers render independent statuses
  it("renders each assigned interviewer with their own status", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({
        interviewers: [
          buildRosterEntry({ interviewer: { id: "user-1", name: "Alice Interviewer", email: "alice@example.test" }, status: "submitted", feedback: buildFeedback() }),
          buildRosterEntry({ interviewer: { id: "user-2", name: "Bob Interviewer", email: "bob@example.test" }, status: "not_started", feedback: null }),
        ],
      })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByText("Alice Interviewer")).toBeInTheDocument();
    expect(screen.getByText("Bob Interviewer")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Awaiting feedback")).toBeInTheDocument();
  });

  // 25. submitted feedback rendered / 26. recommendation labels correct
  it("renders full content for a submitted entry, with a professional recommendation label", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({ interviewers: [buildRosterEntry({ status: "submitted", feedback: buildFeedback({ recommendation: "strong_yes" }) })] })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByText("Strong Yes")).toBeInTheDocument();
    expect(screen.getByText("Excellent technical depth.")).toBeInTheDocument();
    expect(screen.getByText("Great communicator")).toBeInTheDocument();
    expect(screen.getByText("Would hire immediately")).toBeInTheDocument();
  });

  // 24. another User's draft is not rendered
  it("never renders another interviewer's draft content", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({
        interviewers: [buildRosterEntry({ status: "draft", feedback: null })],
        viewer: { assigned: false, can_edit: false, feedback: null },
      })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByText("Awaiting feedback")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Feedback" })).not.toBeInTheDocument();
  });

  // 14. assigned User sees Add Feedback
  it("shows Add Feedback for an assigned interviewer with no feedback yet", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({ interviewers: [buildRosterEntry()], viewer: { assigned: true, can_edit: true, feedback: null } })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByRole("button", { name: "Add Feedback" })).toBeInTheDocument();
  });

  // 15. unassigned User does not
  it("hides the feedback action for a non-assigned viewer", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({ interviewers: [buildRosterEntry({ status: "submitted", feedback: buildFeedback() })], viewer: { assigned: false, can_edit: false, feedback: null } })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    await screen.findByText("Alice Interviewer");
    expect(screen.queryByRole("button", { name: /Feedback/ })).not.toBeInTheDocument();
  });

  // 16. draft -> Continue Feedback
  it("shows Continue Feedback for a viewer with an existing draft", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({
        interviewers: [buildRosterEntry({ status: "draft" })],
        viewer: { assigned: true, can_edit: true, feedback: buildFeedback({ status: "draft", recommendation: null, submitted_at: null }) },
      })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByRole("button", { name: "Continue Feedback" })).toBeInTheDocument();
  });

  // 17. submitted -> View Submitted Feedback
  it("shows View Submitted Feedback for a viewer who already submitted", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(
      buildList({
        interviewers: [buildRosterEntry({ status: "submitted", feedback: buildFeedback() })],
        viewer: { assigned: true, can_edit: false, feedback: buildFeedback() },
      })
    );
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByRole("button", { name: "View Submitted Feedback" })).toBeInTheDocument();
  });

  // 30. safe errors only
  it("shows a safe error message, never a raw backend message, when loading fails", async () => {
    vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockRejectedValue(new ApiError("raw db error detail", 500));
    render(<InterviewFeedbackSection interviewId="interview-1" />);

    expect(await screen.findByText("Feedback could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db error detail/)).not.toBeInTheDocument();
  });

  // ===== FORM: draft/submit/validation =====
  describe("feedback form", () => {
    async function openForm(list: InterviewFeedbackList) {
      vi.mocked(interviewFeedbackApi.listInterviewFeedback).mockResolvedValue(list);
      render(<InterviewFeedbackSection interviewId="interview-1" />);
      await userEvent.click(await screen.findByRole("button", { name: /Feedback/ }));
      await screen.findByRole("dialog");
    }

    // 18. Save Draft works / 19. partial draft preserved
    it("saves a draft with only some fields filled in", async () => {
      await openForm(buildList({ interviewers: [buildRosterEntry()], viewer: { assigned: true, can_edit: true, feedback: null } }));
      vi.mocked(interviewFeedbackApi.saveOwnFeedbackDraft).mockResolvedValue({
        feedback: buildFeedback({ status: "draft", recommendation: null, summary: "Partial notes", strengths: "", submitted_at: null }),
      });

      await userEvent.type(screen.getByLabelText(/^Summary/), "Partial notes");
      await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));

      await waitFor(() => expect(interviewFeedbackApi.saveOwnFeedbackDraft).toHaveBeenCalled());
      const [, body] = vi.mocked(interviewFeedbackApi.saveOwnFeedbackDraft).mock.calls[0]!;
      expect(body.summary).toBe("Partial notes");
    });

    // 20. Submit validates recommendation
    it("requires a recommendation before allowing submit", async () => {
      await openForm(buildList({ interviewers: [buildRosterEntry()], viewer: { assigned: true, can_edit: true, feedback: null } }));

      await userEvent.type(screen.getByLabelText(/^Summary/), "Has a summary but no recommendation");
      await userEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));

      expect(await screen.findByText("An overall recommendation is required")).toBeInTheDocument();
      expect(interviewFeedbackApi.submitOwnFeedback).not.toHaveBeenCalled();
    });

    // 21. Submit validates summary
    it("requires a summary before allowing submit", async () => {
      await openForm(buildList({ interviewers: [buildRosterEntry()], viewer: { assigned: true, can_edit: true, feedback: null } }));

      await userEvent.selectOptions(screen.getByLabelText(/^Overall Recommendation/), "yes");
      await userEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));

      expect(await screen.findByText("A summary is required")).toBeInTheDocument();
      expect(interviewFeedbackApi.submitOwnFeedback).not.toHaveBeenCalled();
    });

    it("shows a confirmation step before actually submitting", async () => {
      await openForm(buildList({ interviewers: [buildRosterEntry()], viewer: { assigned: true, can_edit: true, feedback: null } }));

      await userEvent.selectOptions(screen.getByLabelText(/^Overall Recommendation/), "yes");
      await userEvent.type(screen.getByLabelText(/^Summary/), "Solid candidate");
      await userEvent.click(screen.getByRole("button", { name: "Submit Feedback" }));

      expect(await screen.findByText(/Submit feedback\?/)).toBeInTheDocument();
      expect(interviewFeedbackApi.submitOwnFeedback).not.toHaveBeenCalled();
    });

    // 22. submitted feedback becomes read-only
    it("shows submitted feedback as read-only, with no editable fields", async () => {
      await openForm(
        buildList({
          interviewers: [buildRosterEntry({ status: "submitted", feedback: buildFeedback() })],
          viewer: { assigned: true, can_edit: false, feedback: buildFeedback() },
        })
      );

      expect(screen.getAllByText("Excellent technical depth.").length).toBeGreaterThan(0);
      expect(screen.queryByLabelText(/^Summary/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save Draft" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Submit Feedback" })).not.toBeInTheDocument();
    });

    // 31. failed Save Draft preserves form input
    it("preserves form input after a failed Save Draft", async () => {
      await openForm(buildList({ interviewers: [buildRosterEntry()], viewer: { assigned: true, can_edit: true, feedback: null } }));
      vi.mocked(interviewFeedbackApi.saveOwnFeedbackDraft).mockRejectedValue(new ApiError("raw server error", 500));

      await userEvent.type(screen.getByLabelText(/^Summary/), "Don't lose this");
      await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));

      await waitFor(() => expect(interviewFeedbackApi.saveOwnFeedbackDraft).toHaveBeenCalled());
      expect(screen.getByLabelText(/^Summary/)).toHaveValue("Don't lose this");
      expect(screen.getByText("The draft could not be saved. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText(/raw server error/)).not.toBeInTheDocument();
    });
  });
});
