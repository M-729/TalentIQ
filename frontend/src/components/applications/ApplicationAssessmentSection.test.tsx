import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApplicationAssessmentSection } from "@/components/applications/ApplicationAssessmentSection";
import { buildApplicationDetail, buildAssessmentHistoryItem, buildAssessmentNotification } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";

vi.mock("@/services/api/applicationAssessments");

function renderSection(application = buildApplicationDetail({ current_step: { id: "step-1", name: "Technical Assessment", type: "assessment" } })) {
  return render(
    <MemoryRouter>
      <ApplicationAssessmentSection application={application} />
    </MemoryRouter>
  );
}

// Convenience: mock a single CURRENT assessment (the common case for the
// active-controls tests below) via the one history endpoint the section
// actually calls.
function mockCurrent(overrides: Parameters<typeof buildAssessmentHistoryItem>[0] = {}) {
  vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
    assessments: [buildAssessmentHistoryItem({ is_current: true, ...overrides })],
  });
}

describe("ApplicationAssessmentSection", () => {
  beforeEach(() => {
    vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockReset();
    vi.mocked(applicationAssessmentsApi.createAssessment).mockReset();
    vi.mocked(applicationAssessmentsApi.updateAssessmentLink).mockReset();
    vi.mocked(applicationAssessmentsApi.recordAssessmentResult).mockReset();
    vi.mocked(applicationAssessmentsApi.sendAssessmentInvitation).mockReset();
    vi.mocked(applicationAssessmentsApi.retryAssessmentNotification).mockReset();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockReset().mockResolvedValue({ notifications: [] });
  });

  // 1. current assessment stage + none -> Add Assessment
  it("does not render at all for a non-assessment current stage with no history", async () => {
    vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({ assessments: [] });
    render(
      <MemoryRouter>
        <ApplicationAssessmentSection
          application={buildApplicationDetail({ current_step: { id: "step-1", name: "Application Review", type: "review" } })}
        />
      </MemoryRouter>
    );
    await waitFor(() => expect(applicationAssessmentsApi.getAssessmentHistoryForApplication).toHaveBeenCalled());
    expect(screen.queryByText("External Assessment")).not.toBeInTheDocument();
    expect(screen.queryByText("Assessment History")).not.toBeInTheDocument();
  });

  it("still renders the section wrapper for an assessment-type stage", async () => {
    vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({ assessments: [] });
    renderSection();
    expect(await screen.findByText("External Assessment")).toBeInTheDocument();
  });

  // 2. current assessment stage + none -> Add Assessment
  it("shows Add Assessment when no assessment exists yet for the current stage", async () => {
    vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({ assessments: [] });
    renderSection();
    expect(await screen.findByRole("button", { name: "Add Assessment" })).toBeInTheDocument();
  });

  // 3. save form
  it("saves a new assessment via the Add Assessment form", async () => {
    vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({ assessments: [] });
    vi.mocked(applicationAssessmentsApi.createAssessment).mockResolvedValue({ assessment: buildAssessmentHistoryItem() });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Add Assessment" }));
    await userEvent.type(screen.getByLabelText("Assessment name"), "Backend Technical Test");
    await userEvent.type(screen.getByLabelText("External exam URL"), "https://external-platform.example/test/abc");
    await userEvent.click(screen.getByRole("button", { name: "Save Assessment" }));

    await waitFor(() =>
      expect(applicationAssessmentsApi.createAssessment).toHaveBeenCalledWith("application-1", {
        name: "Backend Technical Test",
        external_url: "https://external-platform.example/test/abc",
      })
    );
  });

  // 4. unsafe URL validation
  it("rejects an unsafe URL scheme client-side before submitting", async () => {
    vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({ assessments: [] });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Add Assessment" }));
    await userEvent.type(screen.getByLabelText("Assessment name"), "Backend Technical Test");
    await userEvent.type(screen.getByLabelText("External exam URL"), "javascript:alert(1)");
    await userEvent.click(screen.getByRole("button", { name: "Save Assessment" }));

    expect(await screen.findByText("Enter a valid http or https link.")).toBeInTheDocument();
    expect(applicationAssessmentsApi.createAssessment).not.toHaveBeenCalled();
  });

  // 2. current assessment stage + record -> active controls
  it("renders the current assessment's name with active controls", async () => {
    mockCurrent();
    renderSection();
    expect(await screen.findByText("Backend Technical Test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Result" })).toBeInTheDocument();
  });

  // 6. Open Assessment
  it("links Open Assessment to the exact persisted external_url", async () => {
    mockCurrent({ external_url: "https://external-platform.example/test/xyz" });
    renderSection();

    const link = await screen.findByRole("link", { name: "Open Assessment" });
    expect(link).toHaveAttribute("href", "https://external-platform.example/test/xyz");
    expect(link).toHaveAttribute("target", "_blank");
  });

  // 7. Copy Link
  it("copies the external_url when Copy Link is clicked", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    mockCurrent({ external_url: "https://external-platform.example/test/xyz" });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Copy Link" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://external-platform.example/test/xyz");
  });

  // 8. Send Assessment
  it('shows "Not sent" and a Send Assessment button when no invitation has been sent yet', async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({ notifications: [] });
    renderSection();

    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Assessment" })).toBeInTheDocument();
  });

  it("calls sendAssessmentInvitation when Send Assessment is clicked", async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({ notifications: [] });
    vi.mocked(applicationAssessmentsApi.sendAssessmentInvitation).mockResolvedValue({ notification: buildAssessmentNotification() });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Send Assessment" }));
    await waitFor(() => expect(applicationAssessmentsApi.sendAssessmentInvitation).toHaveBeenCalledWith("assessment-1"));
  });

  // 9. send pending prevents double click
  it("disables the send button while a send is pending", async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({ notifications: [] });
    vi.mocked(applicationAssessmentsApi.sendAssessmentInvitation).mockReturnValue(new Promise(() => {}));
    renderSection();

    const button = await screen.findByRole("button", { name: "Send Assessment" });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  // 10. failed email shows Retry
  it("shows Retry Email for a failed invitation", async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({
      notifications: [buildAssessmentNotification({ status: "failed", failure_code: "delivery_failed" })],
    });
    renderSection();

    expect(await screen.findByRole("button", { name: "Retry Email" })).toBeInTheDocument();
  });

  // 11. retry succeeds
  it("calls retryAssessmentNotification when Retry Email is clicked", async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({
      notifications: [buildAssessmentNotification({ id: "notif-1", status: "failed" })],
    });
    vi.mocked(applicationAssessmentsApi.retryAssessmentNotification).mockResolvedValue({ notification: buildAssessmentNotification({ id: "notif-1", status: "sent" }) });
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Retry Email" }));
    await waitFor(() => expect(applicationAssessmentsApi.retryAssessmentNotification).toHaveBeenCalledWith("assessment-1", "notif-1"));
  });

  // 12. successful send shows Sent
  it('shows "Sent {date}" for a successfully sent invitation', async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({
      notifications: [buildAssessmentNotification({ status: "sent", sent_at: "2026-09-22T10:00:00.000Z" })],
    });
    renderSection();

    expect(await screen.findByText(/Sent/)).toBeInTheDocument();
  });

  // 13. Send Again explicit behavior
  it("shows Send Again (not Send Assessment) once a previous invitation was sent", async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({
      notifications: [buildAssessmentNotification({ status: "sent" })],
    });
    renderSection();

    expect(await screen.findByRole("button", { name: "Send Again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Assessment" })).not.toBeInTheDocument();
  });

  it("shows a safe message (never a raw error) when sending fails", async () => {
    mockCurrent();
    vi.mocked(applicationAssessmentsApi.listAssessmentNotifications).mockResolvedValue({ notifications: [] });
    vi.mocked(applicationAssessmentsApi.sendAssessmentInvitation).mockRejectedValue(new ApiError("raw smtp stack", 500));
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Send Assessment" }));
    expect(await screen.findByText("Assessment email could not be sent.")).toBeInTheDocument();
    expect(screen.queryByText(/raw smtp stack/)).not.toBeInTheDocument();
  });

  // ===== read-only after a result is recorded =====
  describe("name/link editing locks once a result is recorded", () => {
    it("shows an Edit control while the assessment is still pending", async () => {
      mockCurrent({ status: "pending" });
      renderSection();
      expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    });

    it("opens the edit-link dialog pre-filled when Edit is clicked while pending", async () => {
      mockCurrent({ status: "pending", name: "Backend Technical Test" });
      renderSection();

      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      expect(await screen.findByRole("heading", { name: "Edit assessment link" })).toBeInTheDocument();
      expect(screen.getByLabelText("Assessment name")).toHaveValue("Backend Technical Test");
    });

    // 5. frontend does not expose edit control after passed
    it("does not show the Edit control once the assessment is passed", async () => {
      mockCurrent({ status: "passed", grade: 90 });
      renderSection();

      await screen.findByText("Backend Technical Test");
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.getByText("Locked after result")).toBeInTheDocument();
    });

    // 6. frontend does not expose edit control after failed
    it("does not show the Edit control once the assessment is failed", async () => {
      mockCurrent({ status: "failed" });
      renderSection();

      await screen.findByText("Backend Technical Test");
      expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.getByText("Locked after result")).toBeInTheDocument();
    });

    // 7. Open Assessment / Copy Link still work once locked
    it("still offers Open Assessment and Copy Link once the assessment is locked", async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      mockCurrent({ status: "passed", external_url: "https://external-platform.example/test/xyz" });
      renderSection();

      const link = await screen.findByRole("link", { name: "Open Assessment" });
      expect(link).toHaveAttribute("href", "https://external-platform.example/test/xyz");
      await userEvent.click(screen.getByRole("button", { name: "Copy Link" }));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://external-platform.example/test/xyz");
    });

    // 8. result-edit behavior unchanged — Record Result stays available once locked.
    it("still offers Record Result once the name/link are locked", async () => {
      mockCurrent({ status: "failed" });
      renderSection();

      expect(await screen.findByRole("button", { name: "Record Result" })).toBeInTheDocument();
    });
  });

  // ===== RESULT =====
  describe("recording a result", () => {
    it("opens the Record Result dialog", async () => {
      mockCurrent();
      renderSection();

      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));
      expect(await screen.findByRole("heading", { name: "Record result" })).toBeInTheDocument();
    });

    it("offers Pending/Passed/Failed as the only result options", async () => {
      mockCurrent();
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));

      const select = screen.getByLabelText(/Result/) as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.textContent);
      expect(options).toEqual(["Pending", "Passed", "Failed"]);
    });

    it("saves a Passed result with no grade", async () => {
      mockCurrent();
      vi.mocked(applicationAssessmentsApi.recordAssessmentResult).mockResolvedValue({
        assessment: buildAssessmentHistoryItem({ status: "passed" }),
      });
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));
      await userEvent.selectOptions(screen.getByLabelText(/Result/), "Passed");
      await userEvent.click(screen.getByRole("button", { name: "Save Result" }));

      await waitFor(() =>
        expect(applicationAssessmentsApi.recordAssessmentResult).toHaveBeenCalledWith("assessment-1", {
          status: "passed",
          grade: null,
          notes: null,
        })
      );
    });

    it("rejects a grade outside 0-100", async () => {
      mockCurrent();
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));
      await userEvent.selectOptions(screen.getByLabelText(/Result/), "Passed");
      await userEvent.type(screen.getByLabelText(/Grade/), "150");
      await userEvent.click(screen.getByRole("button", { name: "Save Result" }));

      expect(await screen.findByText("Grade must be a number between 0 and 100.")).toBeInTheDocument();
      expect(applicationAssessmentsApi.recordAssessmentResult).not.toHaveBeenCalled();
    });

    it("saves notes alongside the result", async () => {
      mockCurrent();
      vi.mocked(applicationAssessmentsApi.recordAssessmentResult).mockResolvedValue({
        assessment: buildAssessmentHistoryItem({ status: "passed", grade: 84, notes: "Strong API knowledge, weaker SQL section." }),
      });
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));
      await userEvent.selectOptions(screen.getByLabelText(/Result/), "Passed");
      await userEvent.type(screen.getByLabelText(/Grade/), "84");
      await userEvent.type(screen.getByLabelText(/Notes/), "Strong API knowledge, weaker SQL section.");
      await userEvent.click(screen.getByRole("button", { name: "Save Result" }));

      await waitFor(() =>
        expect(applicationAssessmentsApi.recordAssessmentResult).toHaveBeenCalledWith("assessment-1", {
          status: "passed",
          grade: 84,
          notes: "Strong API knowledge, weaker SQL section.",
        })
      );
    });

    it("shows the saved result on the section after saving", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication)
        .mockResolvedValueOnce({ assessments: [buildAssessmentHistoryItem({ status: "pending" })] })
        .mockResolvedValueOnce({ assessments: [buildAssessmentHistoryItem({ status: "passed", grade: 84 })] });
      vi.mocked(applicationAssessmentsApi.recordAssessmentResult).mockResolvedValue({
        assessment: buildAssessmentHistoryItem({ status: "passed", grade: 84 }),
      });
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));
      await userEvent.selectOptions(screen.getByLabelText(/Result/), "Passed");
      await userEvent.type(screen.getByLabelText(/Grade/), "84");
      await userEvent.click(screen.getByRole("button", { name: "Save Result" }));

      expect(await screen.findByText("Grade 84%")).toBeInTheDocument();
    });

    it("allows correcting an already-recorded result", async () => {
      mockCurrent({ status: "failed", grade: 40 });
      vi.mocked(applicationAssessmentsApi.recordAssessmentResult).mockResolvedValue({
        assessment: buildAssessmentHistoryItem({ status: "passed", grade: 85 }),
      });
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));

      const select = screen.getByLabelText(/Result/) as HTMLSelectElement;
      expect(select.value).toBe("failed");
      await userEvent.selectOptions(select, "Passed");
      await userEvent.click(screen.getByRole("button", { name: "Save Result" }));

      await waitFor(() =>
        expect(applicationAssessmentsApi.recordAssessmentResult).toHaveBeenCalledWith(
          "assessment-1",
          expect.objectContaining({ status: "passed" })
        )
      );
    });

    it("never calls any pipeline/stage-movement API when saving a result", async () => {
      mockCurrent();
      vi.mocked(applicationAssessmentsApi.recordAssessmentResult).mockResolvedValue({
        assessment: buildAssessmentHistoryItem({ status: "failed" }),
      });
      renderSection();
      await userEvent.click(await screen.findByRole("button", { name: "Record Result" }));
      await userEvent.selectOptions(screen.getByLabelText(/Result/), "Failed");
      await userEvent.click(screen.getByRole("button", { name: "Save Result" }));

      await waitFor(() => expect(applicationAssessmentsApi.recordAssessmentResult).toHaveBeenCalled());
      expect(applicationAssessmentsApi.createAssessment).not.toHaveBeenCalled();
      expect(applicationAssessmentsApi.sendAssessmentInvitation).not.toHaveBeenCalled();
    });
  });

  // ===== ASSESSMENT HISTORY =====
  describe("assessment history", () => {
    // 3. candidate moves from Assessment to Interview -> previous assessment remains visible
    it("still shows the previous assessment when the candidate has moved to a non-assessment stage", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [buildAssessmentHistoryItem({ is_current: false, name: "Backend Technical Test" })],
      });

      render(
        <MemoryRouter>
          <ApplicationAssessmentSection
            application={buildApplicationDetail({ current_step: { id: "step-2", name: "Technical Interview", type: "interview" } })}
          />
        </MemoryRouter>
      );

      expect(await screen.findByText("Assessment History")).toBeInTheDocument();
      expect(screen.getByText("Backend Technical Test")).toBeInTheDocument();
      // The active card (with Add Assessment / Record Result) never
      // renders for a non-assessment current stage, even with history present.
      expect(screen.queryByText("External Assessment")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Add Assessment" })).not.toBeInTheDocument();
    });

    // 4. historical Passed + grade remains visible
    it("keeps a historical Passed result and grade visible", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [buildAssessmentHistoryItem({ is_current: false, status: "passed", grade: 87 })],
      });
      render(
        <MemoryRouter>
          <ApplicationAssessmentSection
            application={buildApplicationDetail({ current_step: { id: "step-2", name: "Technical Interview", type: "interview" } })}
          />
        </MemoryRouter>
      );

      await screen.findByText("Assessment History");
      expect(screen.getByText("Passed")).toBeInTheDocument();
      expect(screen.getByText("Grade 87%")).toBeInTheDocument();
    });

    // 5. historical notes remain visible
    it("keeps historical notes visible", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [buildAssessmentHistoryItem({ is_current: false, notes: "Strong result" })],
      });
      render(
        <MemoryRouter>
          <ApplicationAssessmentSection
            application={buildApplicationDetail({ current_step: { id: "step-2", name: "Technical Interview", type: "interview" } })}
          />
        </MemoryRouter>
      );

      await screen.findByText("Assessment History");
      expect(screen.getByText("Strong result")).toBeInTheDocument();
    });

    // 6. historical assessment does not expose inappropriate active create controls
    it("never shows Add Assessment, Send, Retry, or Record Result on a historical entry", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [buildAssessmentHistoryItem({ is_current: false, status: "failed", email_status: "failed" })],
      });
      render(
        <MemoryRouter>
          <ApplicationAssessmentSection
            application={buildApplicationDetail({ current_step: { id: "step-2", name: "Technical Interview", type: "interview" } })}
          />
        </MemoryRouter>
      );

      await screen.findByText("Assessment History");
      expect(screen.queryByRole("button", { name: "Add Assessment" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Send Assessment|Send Again/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry Email" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Record Result" })).not.toBeInTheDocument();
      // Open/Copy remain available — safe, read-only, authenticated-HR-only actions.
      expect(screen.getByRole("link", { name: "Open Assessment" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy Link" })).toBeInTheDocument();
    });

    // 7. multiple historical assessment-stage records render deterministically
    it("renders multiple historical records in the order the backend returned them", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [
          buildAssessmentHistoryItem({ id: "assessment-2", is_current: false, name: "Second Assessment" }),
          buildAssessmentHistoryItem({ id: "assessment-1", is_current: false, name: "First Assessment" }),
        ],
      });
      render(
        <MemoryRouter>
          <ApplicationAssessmentSection
            application={buildApplicationDetail({ current_step: { id: "step-2", name: "Technical Interview", type: "interview" } })}
          />
        </MemoryRouter>
      );

      await screen.findByText("Assessment History");
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveTextContent("Second Assessment");
      expect(items[1]).toHaveTextContent("First Assessment");
    });

    it("shows both the active card and history together when both exist", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [
          buildAssessmentHistoryItem({ id: "assessment-current", is_current: true, name: "Current Assessment" }),
          buildAssessmentHistoryItem({ id: "assessment-old", is_current: false, name: "Old Assessment" }),
        ],
      });
      renderSection();

      expect(await screen.findByText("External Assessment")).toBeInTheDocument();
      expect(screen.getByText("Current Assessment")).toBeInTheDocument();
      expect(await screen.findByText("Assessment History")).toBeInTheDocument();
      expect(screen.getByText("Old Assessment")).toBeInTheDocument();
    });

    // 8. no N+1 — structural: exactly one request for the whole section
    // regardless of how much history exists.
    it("fetches assessment data with exactly one request regardless of history size", async () => {
      vi.mocked(applicationAssessmentsApi.getAssessmentHistoryForApplication).mockResolvedValue({
        assessments: [
          buildAssessmentHistoryItem({ id: "a1", is_current: false }),
          buildAssessmentHistoryItem({ id: "a2", is_current: false }),
          buildAssessmentHistoryItem({ id: "a3", is_current: true }),
        ],
      });
      renderSection();

      await screen.findByText("Assessment History");
      expect(applicationAssessmentsApi.getAssessmentHistoryForApplication).toHaveBeenCalledTimes(1);
    });
  });
});
