import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { PipelineSetupPanel } from "@/components/hiringPipeline/PipelineSetupPanel";
import { buildHiringStep } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as hiringStepsApi from "@/services/api/hiringSteps";

// Extracted from the old HiringPipelinePage.test.tsx (Hiring Pipeline
// Board UI ticket): PipelineSetupPanel is now one of two tabs inside
// HiringPipelinePage rather than the page's only content, so its own
// behavior is tested directly against the panel (jobId as a prop), not
// through page-level job selection/tab-switching — decoupling this
// coverage from the workspace shell's structure.
vi.mock("@/services/api/hiringSteps");

const JOB_ID = "job-a";

function renderPanel() {
  return render(
    <MemoryRouter>
      <PipelineSetupPanel jobId={JOB_ID} />
    </MemoryRouter>
  );
}

describe("PipelineSetupPanel", () => {
  beforeEach(() => {
    vi.mocked(hiringStepsApi.getHiringSteps).mockReset();
    vi.mocked(hiringStepsApi.createHiringStep).mockReset();
    vi.mocked(hiringStepsApi.updateHiringStep).mockReset();
    vi.mocked(hiringStepsApi.deleteHiringStep).mockReset();
    vi.mocked(hiringStepsApi.reorderHiringSteps).mockReset();
  });

  // ===== FETCH =====
  describe("fetch", () => {
    it("fetches this job's stages on mount", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [] });
      renderPanel();
      await waitFor(() => expect(hiringStepsApi.getHiringSteps).toHaveBeenCalledWith(JOB_ID, expect.anything()));
    });
  });

  // ===== EMPTY PIPELINE =====
  describe("empty pipeline", () => {
    it('shows "No hiring stages yet" for a job with zero stages', async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [] });
      renderPanel();
      expect(await screen.findByText("No hiring stages yet")).toBeInTheDocument();
    });

    it("Add First Stage opens the create form", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [] });
      renderPanel();

      await userEvent.click(await screen.findByRole("button", { name: "Add First Stage" }));
      expect(await screen.findByRole("heading", { name: "Add hiring stage" })).toBeInTheDocument();
    });
  });

  // ===== CREATE =====
  describe("create stage", () => {
    async function openCreateDialogWithOneStage() {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [buildHiringStep()] });
      renderPanel();
      await userEvent.click(await screen.findByRole("button", { name: "Add Stage" }));
      expect(await screen.findByRole("heading", { name: "Add hiring stage" })).toBeInTheDocument();
    }

    it("Add Stage opens a dialog", async () => {
      await openCreateDialogWithOneStage();
    });

    it("requires name and type before submitting", async () => {
      await openCreateDialogWithOneStage();
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      expect(await screen.findByText("Stage name is required")).toBeInTheDocument();
      expect(hiringStepsApi.createHiringStep).not.toHaveBeenCalled();
    });

    it("accepts a free, custom stage name", async () => {
      vi.mocked(hiringStepsApi.createHiringStep).mockResolvedValue({
        step: buildHiringStep({ id: "step-2", name: "Reference Check", type: "other" }),
      });
      await openCreateDialogWithOneStage();

      await userEvent.type(screen.getByLabelText("Stage name", { exact: false }), "Reference Check");
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      await waitFor(() =>
        expect(hiringStepsApi.createHiringStep).toHaveBeenCalledWith(
          JOB_ID,
          expect.objectContaining({ name: "Reference Check" })
        )
      );
    });

    it("lets HR choose the stage type", async () => {
      vi.mocked(hiringStepsApi.createHiringStep).mockResolvedValue({
        step: buildHiringStep({ id: "step-2", name: "Coding Challenge", type: "assessment" }),
      });
      await openCreateDialogWithOneStage();

      await userEvent.type(screen.getByLabelText("Stage name", { exact: false }), "Coding Challenge");
      await userEvent.selectOptions(screen.getByLabelText("Stage type", { exact: false }), "Assessment");
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      await waitFor(() =>
        expect(hiringStepsApi.createHiringStep).toHaveBeenCalledWith(
          JOB_ID,
          expect.objectContaining({ type: "assessment" })
        )
      );
    });

    it("sends only name/type/description — nothing client-controlled like position, job, or company", async () => {
      vi.mocked(hiringStepsApi.createHiringStep).mockResolvedValue({
        step: buildHiringStep({ id: "step-2", name: "Portfolio Review" }),
      });
      await openCreateDialogWithOneStage();

      await userEvent.type(screen.getByLabelText("Stage name", { exact: false }), "Portfolio Review");
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      await waitFor(() => expect(hiringStepsApi.createHiringStep).toHaveBeenCalled());
      const [, payload] = vi.mocked(hiringStepsApi.createHiringStep).mock.calls[0]!;
      expect(Object.keys(payload).sort()).toEqual(["name", "type"].sort());
    });

    it("refreshes the pipeline after a successful create", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps)
        .mockResolvedValueOnce({ steps: [buildHiringStep()] })
        .mockResolvedValueOnce({
          steps: [buildHiringStep(), buildHiringStep({ id: "step-2", name: "Interview", type: "interview", position: 1 })],
        });
      vi.mocked(hiringStepsApi.createHiringStep).mockResolvedValue({
        step: buildHiringStep({ id: "step-2", name: "Interview", type: "interview", position: 1 }),
      });
      await openCreateDialogWithOneStage();

      await userEvent.type(screen.getByLabelText("Stage name", { exact: false }), "Interview");
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      expect(await screen.findByRole("heading", { name: "Interview" })).toBeInTheDocument();
      expect(hiringStepsApi.getHiringSteps).toHaveBeenCalledTimes(2);
    });

    it("shows a safe message for a duplicate stage name (409)", async () => {
      vi.mocked(hiringStepsApi.createHiringStep).mockRejectedValue(new ApiError("some raw backend text", 409));
      await openCreateDialogWithOneStage();

      await userEvent.type(screen.getByLabelText("Stage name", { exact: false }), "Application Review");
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      expect(await screen.findByText("A stage with this name already exists for this job.")).toBeInTheDocument();
      expect(screen.queryByText("some raw backend text")).not.toBeInTheDocument();
    });
  });

  // ===== EDIT =====
  describe("edit stage", () => {
    async function openEditDialog() {
      const step = buildHiringStep({ name: "Technical Exam", type: "assessment", description: "Coding test" });
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [step] });
      renderPanel();
      await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
      await screen.findByRole("heading", { name: "Edit hiring stage" });
      return step;
    }

    it("opens prefilled with the stage's current values", async () => {
      await openEditDialog();
      expect(screen.getByLabelText("Stage name", { exact: false })).toHaveValue("Technical Exam");
      expect(screen.getByLabelText("Stage type", { exact: false })).toHaveValue("assessment");
      expect(screen.getByLabelText("Description (optional)")).toHaveValue("Coding test");
    });

    it("renames a stage", async () => {
      const step = await openEditDialog();
      vi.mocked(hiringStepsApi.updateHiringStep).mockResolvedValue({ step: { ...step, name: "Backend Coding Challenge" } });

      const nameInput = screen.getByLabelText("Stage name", { exact: false });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Backend Coding Challenge");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(hiringStepsApi.updateHiringStep).toHaveBeenCalledWith(
          JOB_ID,
          step.public_id!,
          expect.objectContaining({ name: "Backend Coding Challenge" })
        )
      );
    });

    it("changes the stage type", async () => {
      const step = await openEditDialog();
      vi.mocked(hiringStepsApi.updateHiringStep).mockResolvedValue({ step: { ...step, type: "interview" } });

      await userEvent.selectOptions(screen.getByLabelText("Stage type", { exact: false }), "Interview");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(hiringStepsApi.updateHiringStep).toHaveBeenCalledWith(
          JOB_ID,
          step.public_id!,
          expect.objectContaining({ type: "interview" })
        )
      );
    });

    it("changes the description", async () => {
      const step = await openEditDialog();
      vi.mocked(hiringStepsApi.updateHiringStep).mockResolvedValue({ step: { ...step, description: "Updated" } });

      const descriptionInput = screen.getByLabelText("Description (optional)");
      await userEvent.clear(descriptionInput);
      await userEvent.type(descriptionInput, "Updated");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() =>
        expect(hiringStepsApi.updateHiringStep).toHaveBeenCalledWith(
          JOB_ID,
          step.public_id!,
          expect.objectContaining({ description: "Updated" })
        )
      );
    });

    it("has no position field in the edit form", async () => {
      await openEditDialog();
      expect(screen.queryByLabelText(/position/i)).not.toBeInTheDocument();
    });

    it("refreshes state after a successful edit", async () => {
      const step = await openEditDialog();
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValueOnce({
        steps: [{ ...step, name: "Renamed Stage" }],
      });
      vi.mocked(hiringStepsApi.updateHiringStep).mockResolvedValue({ step: { ...step, name: "Renamed Stage" } });

      const nameInput = screen.getByLabelText("Stage name", { exact: false });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Renamed Stage");
      await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Renamed Stage")).toBeInTheDocument();
    });
  });

  // ===== REORDER =====
  describe("reorder", () => {
    const stepA = buildHiringStep({ id: "step-a", name: "Review", type: "review", position: 0 });
    const stepB = buildHiringStep({ id: "step-b", name: "Interview", type: "interview", position: 1 });
    const stepC = buildHiringStep({ id: "step-c", name: "Assessment", type: "assessment", position: 2 });

    async function renderWithThreeStages() {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [stepA, stepB, stepC] });
      renderPanel();
      await screen.findByRole("heading", { name: "Review" });
    }

    it("disables Move Up on the first stage", async () => {
      await renderWithThreeStages();
      expect(screen.getByRole("button", { name: "Move Review up" })).toBeDisabled();
    });

    it("disables Move Down on the last stage", async () => {
      await renderWithThreeStages();
      expect(screen.getByRole("button", { name: "Move Assessment down" })).toBeDisabled();
    });

    it("sends the complete reordered id array on Move Down", async () => {
      vi.mocked(hiringStepsApi.reorderHiringSteps).mockResolvedValue({ steps: [stepB, stepA, stepC] });
      await renderWithThreeStages();

      await userEvent.click(screen.getByRole("button", { name: "Move Review down" }));

      await waitFor(() =>
        expect(hiringStepsApi.reorderHiringSteps).toHaveBeenCalledWith(JOB_ID, ["step-b", "step-a", "step-c"])
      );
    });

    it("sends the correct order on Move Up", async () => {
      vi.mocked(hiringStepsApi.reorderHiringSteps).mockResolvedValue({ steps: [stepA, stepC, stepB] });
      await renderWithThreeStages();

      await userEvent.click(screen.getByRole("button", { name: "Move Assessment up" }));

      await waitFor(() =>
        expect(hiringStepsApi.reorderHiringSteps).toHaveBeenCalledWith(JOB_ID, ["step-a", "step-c", "step-b"])
      );
    });

    it("renders the new sequence after a successful reorder", async () => {
      vi.mocked(hiringStepsApi.reorderHiringSteps).mockResolvedValue({
        steps: [{ ...stepC, position: 0 }, { ...stepA, position: 1 }, { ...stepB, position: 2 }],
      });
      await renderWithThreeStages();

      await userEvent.click(screen.getByRole("button", { name: "Move Assessment up" }));
      await userEvent.click(screen.getByRole("button", { name: "Move Assessment up" }));

      await waitFor(() => {
        const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
        expect(headings).toEqual(["Assessment", "Review", "Interview"]);
      });
    });

    it("does not leave the UI in an incorrect order after a failed reorder", async () => {
      vi.mocked(hiringStepsApi.reorderHiringSteps).mockRejectedValue(new ApiError("failure", 500));
      await renderWithThreeStages();

      await userEvent.click(screen.getByRole("button", { name: "Move Review down" }));

      await waitFor(() => expect(hiringStepsApi.reorderHiringSteps).toHaveBeenCalled());
      const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
      expect(headings).toEqual(["Review", "Interview", "Assessment"]);
    });

    it("disables reorder controls while a request is in flight", async () => {
      let resolveReorder: (value: { steps: typeof stepA[] }) => void = () => {};
      vi.mocked(hiringStepsApi.reorderHiringSteps).mockReturnValue(
        new Promise((resolve) => {
          resolveReorder = resolve;
        })
      );
      await renderWithThreeStages();

      await userEvent.click(screen.getByRole("button", { name: "Move Review down" }));

      expect(screen.getByRole("button", { name: "Move Interview up" })).toBeDisabled();
      resolveReorder({ steps: [stepA, stepB, stepC] });
      await waitFor(() => expect(screen.getByRole("button", { name: "Move Interview up" })).not.toBeDisabled());
    });
  });

  // ===== DELETE =====
  describe("delete stage", () => {
    async function openDeleteDialog(step = buildHiringStep({ name: "Application Review" })) {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [step] });
      renderPanel();
      await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
      await screen.findByRole("heading", { name: "Delete hiring stage?" });
      return step;
    }

    it("requires confirmation before deleting", async () => {
      await openDeleteDialog();
      expect(hiringStepsApi.deleteHiringStep).not.toHaveBeenCalled();
    });

    it("does nothing when the user cancels", async () => {
      await openDeleteDialog();
      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(hiringStepsApi.deleteHiringStep).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "Delete hiring stage?" })).not.toBeInTheDocument();
    });

    it("refreshes the pipeline after a successful delete", async () => {
      const step = await openDeleteDialog();
      vi.mocked(hiringStepsApi.deleteHiringStep).mockResolvedValue(undefined);
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValueOnce({ steps: [] });

      await userEvent.click(screen.getByRole("button", { name: "Delete stage" }));

      await waitFor(() => expect(hiringStepsApi.deleteHiringStep).toHaveBeenCalledWith(JOB_ID, step.public_id!));
      expect(await screen.findByText("No hiring stages yet")).toBeInTheDocument();
    });

    it("shows a safe explanatory message when the stage is in use (409)", async () => {
      await openDeleteDialog();
      vi.mocked(hiringStepsApi.deleteHiringStep).mockRejectedValue(new ApiError("raw backend text", 409));

      await userEvent.click(screen.getByRole("button", { name: "Delete stage" }));

      expect(
        await screen.findByText(
          "This stage can't be deleted because one or more applications are currently in it. Move those applicants to another stage first."
        )
      ).toBeInTheDocument();
      expect(screen.queryByText("raw backend text")).not.toBeInTheDocument();
    });

    it("leaves the stage visible after a failed delete", async () => {
      await openDeleteDialog();
      vi.mocked(hiringStepsApi.deleteHiringStep).mockRejectedValue(new ApiError("raw backend text", 409));

      await userEvent.click(screen.getByRole("button", { name: "Delete stage" }));
      await screen.findByText(/can't be deleted/);

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByText("Application Review")).toBeInTheDocument();
    });

    it("never calls any application-moving API when a delete is blocked", async () => {
      await openDeleteDialog();
      vi.mocked(hiringStepsApi.deleteHiringStep).mockRejectedValue(new ApiError("raw backend text", 409));

      await userEvent.click(screen.getByRole("button", { name: "Delete stage" }));
      await screen.findByText(/can't be deleted/);

      expect(hiringStepsApi.updateHiringStep).not.toHaveBeenCalled();
      expect(hiringStepsApi.reorderHiringSteps).not.toHaveBeenCalled();
    });
  });

  // ===== TYPES =====
  describe("stage type badges and help", () => {
    it("renders a Review badge", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [buildHiringStep({ type: "review" })] });
      renderPanel();
      expect(await screen.findAllByText("Review")).not.toHaveLength(0);
    });

    it("renders an Interview badge", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({
        steps: [buildHiringStep({ type: "interview", name: "Final Interview" })],
      });
      renderPanel();
      expect(await screen.findAllByText("Interview")).not.toHaveLength(0);
    });

    it("renders an Assessment badge", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({
        steps: [buildHiringStep({ type: "assessment", name: "Coding Test" })],
      });
      renderPanel();
      expect(await screen.findAllByText("Assessment")).not.toHaveLength(0);
    });

    it("renders an Other badge", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({
        steps: [buildHiringStep({ type: "other", name: "Reference Check" })],
      });
      renderPanel();
      expect(await screen.findAllByText("Other")).not.toHaveLength(0);
    });

    it("explains stage type without claiming scheduling/assessment integrations already exist", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [] });
      renderPanel();

      await screen.findByText("No hiring stages yet");
      const text = document.body.textContent ?? "";
      expect(text).toContain("will be available later");
      expect(text).not.toMatch(/schedule.{0,20}interview now|meet link|assessment sent/i);
    });
  });

  // ===== SECURITY / LANGUAGE =====
  describe("security and language", () => {
    it("accepts an arbitrary, non-hard-coded stage name", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [] });
      vi.mocked(hiringStepsApi.createHiringStep).mockResolvedValue({
        step: buildHiringStep({ id: "custom-1", name: "CTO Culture Chat", type: "other" }),
      });
      renderPanel();

      await userEvent.click(await screen.findByRole("button", { name: "Add First Stage" }));
      await userEvent.type(screen.getByLabelText("Stage name", { exact: false }), "CTO Culture Chat");
      await userEvent.click(screen.getByRole("button", { name: "Add Stage" }));

      await waitFor(() =>
        expect(hiringStepsApi.createHiringStep).toHaveBeenCalledWith(
          JOB_ID,
          expect.objectContaining({ name: "CTO Culture Chat" })
        )
      );
    });

    it("never uses candidate/hiring-judgment language anywhere on the panel", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({
        steps: [buildHiringStep({ description: "Standard review" })],
      });
      renderPanel();
      await screen.findByText("Application Review");

      const text = (document.body.textContent ?? "").toLowerCase();
      for (const phrase of ["ai score", "candidate score", "hiring probability", "chance of hire", "suitability", "recommendation"]) {
        expect(text).not.toContain(phrase);
      }
    });

    it("never displays raw backend/internal error text", async () => {
      vi.mocked(hiringStepsApi.getHiringSteps).mockRejectedValue(new ApiError("MongoServerError: E11000 duplicate key", 500));
      renderPanel();

      expect(await screen.findByText("The hiring pipeline could not be updated. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText(/MongoServerError/)).not.toBeInTheDocument();
    });

    it("never renders secret/auth-shaped fields even if present in the API response", async () => {
      const poisoned = { ...buildHiringStep(), password_hash: "should-never-render", refresh_token: "should-never-render-either" };
      vi.mocked(hiringStepsApi.getHiringSteps).mockResolvedValue({ steps: [poisoned as unknown as ReturnType<typeof buildHiringStep>] });
      renderPanel();
      await screen.findByText("Application Review");

      expect(document.body.textContent).not.toContain("should-never-render");
      expect(document.body.textContent).not.toContain("should-never-render-either");
    });
  });
});
