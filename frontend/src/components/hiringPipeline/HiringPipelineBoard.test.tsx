import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HiringPipelineBoard } from "@/components/hiringPipeline/HiringPipelineBoard";
import {
  buildHiringPipelineApplicationCard,
  buildHiringPipelineBoard,
  buildHiringPipelineBoardColumn,
  buildHiringPipelineNeedsAttentionApplication,
} from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as hiringPipelineBoardApi from "@/services/api/hiringPipelineBoard";

vi.mock("@/services/api/hiringPipelineBoard");

const JOB_ID = "job-a";

function renderBoard(onConfigurePipeline: () => void = () => {}) {
  return render(
    <MemoryRouter initialEntries={["/hiring-pipeline"]}>
      <Routes>
        <Route
          path="/hiring-pipeline"
          element={<HiringPipelineBoard jobId={JOB_ID} onConfigurePipeline={onConfigurePipeline} />}
        />
        <Route path="/applications/:applicationId" element={<div>Application Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("HiringPipelineBoard", () => {
  beforeEach(() => {
    vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockReset();
    vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockReset();
  });

  // ===== FETCH / LOADING / ERRORS =====
  describe("fetch, loading, and errors", () => {
    it("shows a loading skeleton before the board resolves", () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockReturnValue(new Promise(() => {}));
      renderBoard();
      expect(screen.queryByText(/No applicants/)).not.toBeInTheDocument();
    });

    it("shows a safe message and Try Again for a 500", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockRejectedValue(new ApiError("raw db error", 500));
      renderBoard();

      expect(await screen.findByText("The hiring pipeline could not be loaded.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
      expect(screen.queryByText("raw db error")).not.toBeInTheDocument();
    });

    it("shows a safe message for a 404 (job no longer available)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockRejectedValue(new ApiError("Job not found", 404));
      renderBoard();
      expect(await screen.findByText("This job is no longer available.")).toBeInTheDocument();
    });

    it("shows a safe message for a 413 (too many active applications)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockRejectedValue(new ApiError("payload too large", 413));
      renderBoard();
      expect(
        await screen.findByText("This pipeline contains too many active applications to load at once.")
      ).toBeInTheDocument();
    });

    it("retries the fetch when Try Again is clicked", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard)
        .mockRejectedValueOnce(new ApiError("fail", 500))
        .mockResolvedValueOnce(buildHiringPipelineBoard());
      renderBoard();

      await userEvent.click(await screen.findByRole("button", { name: "Try Again" }));
      expect(await screen.findByText("New Applicants")).toBeInTheDocument();
    });
  });

  // ===== COLUMNS =====
  describe("columns", () => {
    it("always renders New Applicants first, before dynamic stages", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [buildHiringPipelineBoardColumn({ id: "s1", name: "Application Review" })],
        })
      );
      renderBoard();

      const headings = await screen.findAllByRole("heading", { level: 3 });
      expect(headings.map((h) => h.textContent)).toEqual(["New Applicants", "Application Review"]);
    });

    it("shows the correct New Applicants count", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          unassigned: { count: 2, applications: [buildHiringPipelineApplicationCard(), buildHiringPipelineApplicationCard({ id: "a2" })] },
        })
      );
      renderBoard();

      await screen.findByText("New Applicants");
      const newApplicantsHeading = screen.getByRole("heading", { name: "New Applicants" });
      expect(newApplicantsHeading.parentElement?.textContent).toContain("2");
    });

    it("renders dynamic stages in the exact order returned by the API", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({ id: "s1", name: "Zebra Stage", position: 0 }),
            buildHiringPipelineBoardColumn({ id: "s2", name: "Alpha Stage", position: 1 }),
          ],
        })
      );
      renderBoard();

      const headings = await screen.findAllByRole("heading", { level: 3 });
      // Not alphabetized — "Zebra Stage" stays before "Alpha Stage" because
      // that's the order (position ASC) the API already returned.
      expect(headings.map((h) => h.textContent)).toEqual(["New Applicants", "Zebra Stage", "Alpha Stage"]);
    });

    it("never hard-codes a stage name — an arbitrary custom name renders as-is", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ stages: [buildHiringPipelineBoardColumn({ name: "CTO Culture Chat" })] })
      );
      renderBoard();
      expect(await screen.findByRole("heading", { name: "CTO Culture Chat" })).toBeInTheDocument();
    });

    it("renders the stage type badge", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ stages: [buildHiringPipelineBoardColumn({ name: "Technical Exam", type: "assessment" })] })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Technical Exam" });
      expect(screen.getByText("Assessment")).toBeInTheDocument();
    });

    it("shows the stage count", async () => {
      const card = buildHiringPipelineApplicationCard();
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ stages: [buildHiringPipelineBoardColumn({ name: "Application Review", count: 1, applications: [card] })] })
      );
      renderBoard();
      const heading = await screen.findByRole("heading", { name: "Application Review" });
      expect(heading.parentElement?.textContent).toContain("1");
    });

    it("renders a tasteful empty message for a stage with zero applicants", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ stages: [buildHiringPipelineBoardColumn({ name: "Final Interview", count: 0, applications: [] })] })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Final Interview" });
      expect(screen.getAllByText("No applicants in this stage.").length).toBeGreaterThan(0);
    });

    it("still shows New Applicants when the job has zero configured stages", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [],
          unassigned: { count: 1, applications: [buildHiringPipelineApplicationCard({ candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })] },
        })
      );
      renderBoard();

      expect(await screen.findByRole("heading", { name: "New Applicants" })).toBeInTheDocument();
      expect(screen.getByText("Sarah Ahmed")).toBeInTheDocument();
      expect(screen.getByText("No hiring stages are configured for this job yet.")).toBeInTheDocument();
    });

    it("calls onConfigurePipeline when Configure Pipeline is clicked", async () => {
      const onConfigurePipeline = vi.fn();
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(buildHiringPipelineBoard({ stages: [] }));
      renderBoard(onConfigurePipeline);

      await userEvent.click(await screen.findByRole("button", { name: "Configure Pipeline" }));
      expect(onConfigurePipeline).toHaveBeenCalledTimes(1);
    });
  });

  // ===== CARDS =====
  describe("candidate cards", () => {
    async function renderWithOneCard(overrides: Parameters<typeof buildHiringPipelineApplicationCard>[0] = {}) {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ unassigned: { count: 1, applications: [buildHiringPipelineApplicationCard(overrides)] }, stages: [] })
      );
      renderBoard();
      await screen.findByText("New Applicants");
    }

    it("renders the candidate name", async () => {
      await renderWithOneCard({ candidate: { id: "c1", full_name: "Omar Ali", email: "omar@example.test" } });
      expect(screen.getByText("Omar Ali")).toBeInTheDocument();
    });

    it("renders the candidate email", async () => {
      await renderWithOneCard({ candidate: { id: "c1", full_name: "Omar Ali", email: "omar@example.test" } });
      expect(screen.getByText("omar@example.test")).toBeInTheDocument();
    });

    it("renders the applied date", async () => {
      await renderWithOneCard({ applied_at: "2024-03-15T00:00:00.000Z" });
      expect(screen.getByText(/Applied/)).toBeInTheDocument();
    });

    it("renders the source when present", async () => {
      await renderWithOneCard({ source: "LinkedIn" });
      expect(screen.getByText("Source: LinkedIn")).toBeInTheDocument();
    });

    it("does not render a source line when absent", async () => {
      await renderWithOneCard({ source: undefined });
      expect(screen.queryByText(/^Source:/)).not.toBeInTheDocument();
    });

    it("View Application links to the correct Application detail route", async () => {
      await renderWithOneCard({ id: "application-42" });
      const links = screen.getAllByRole("link", { name: "View Application" });
      expect(links[0]).toHaveAttribute("href", "/applications/application-42");
    });

    it('shows "Skill Coverage X%" for a screened application', async () => {
      await renderWithOneCard({ screening: { has_screening: true, latest_score: 75 } });
      expect(screen.getByText("75% Skill Coverage")).toBeInTheDocument();
    });

    it('shows "Not screened" for an unscreened application', async () => {
      await renderWithOneCard({ screening: { has_screening: false } });
      expect(screen.getByText("Not screened")).toBeInTheDocument();
    });

    it("never shows a fake 0% for an unscreened application", async () => {
      await renderWithOneCard({ screening: { has_screening: false } });
      expect(screen.queryByText(/0% Skill Coverage/)).not.toBeInTheDocument();
    });

    it("renders cards in exactly the order returned by the API (oldest first, not re-sorted)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [],
          unassigned: {
            count: 2,
            applications: [
              buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Low Coverage", email: "low@test.com" }, screening: { has_screening: true, latest_score: 20 } }),
              buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "High Coverage", email: "high@test.com" }, screening: { has_screening: true, latest_score: 95 } }),
            ],
          },
        })
      );
      renderBoard();
      await screen.findByText("New Applicants");

      const names = screen.getAllByText(/Coverage$/, { selector: "p.font-medium" }).map((el) => el.textContent);
      // Server order (Low Coverage, then High Coverage) is preserved —
      // never re-ranked by screening score.
      expect(names).toEqual(["Low Coverage", "High Coverage"]);
    });
  });

  // ===== MOVE DIALOG =====
  describe("move dialog", () => {
    async function openMoveDialogFromStage() {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "app-1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
            buildHiringPipelineBoardColumn({ id: "step-tech", name: "Technical Exam", type: "assessment", position: 1 }),
            buildHiringPipelineBoardColumn({ id: "step-final", name: "Final Interview", type: "interview", position: 2 }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("button", { name: "Move Sarah Ahmed" }));
      await screen.findByRole("heading", { name: "Move applicant" });
    }

    it("Move opens the dialog", async () => {
      await openMoveDialogFromStage();
    });

    it("shows the current location", async () => {
      await openMoveDialogFromStage();
      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByText("Current")).toBeInTheDocument();
      expect(dialog.getByText("Application Review")).toBeInTheDocument();
    });

    it("populates target stages dynamically", async () => {
      await openMoveDialogFromStage();
      const select = screen.getByLabelText("Move to");
      expect(select).toContainHTML("Technical Exam");
      expect(select).toContainHTML("Final Interview");
    });

    it("excludes the current stage from the target list", async () => {
      await openMoveDialogFromStage();
      const select = screen.getByLabelText("Move to") as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).not.toContain("Application Review");
    });

    it('does not offer "New Applicants" as a target', async () => {
      await openMoveDialogFromStage();
      const select = screen.getByLabelText("Move to") as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).not.toContain("New Applicants");
    });

    it("allows a backward-movement target (an earlier stage)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({ id: "step-review", name: "Application Review", position: 0 }),
            buildHiringPipelineBoardColumn({
              id: "step-final",
              name: "Final Interview",
              type: "interview",
              position: 1,
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "app-1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Final Interview" });
      await userEvent.click(screen.getByRole("button", { name: "Move Sarah Ahmed" }));
      await screen.findByRole("heading", { name: "Move applicant" });

      const select = screen.getByLabelText("Move to") as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels).toContain("Application Review");
    });

    it("does not require a note", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockResolvedValue({
        application: { id: "app-1", status: "in_process", current_step_id: "step-tech" },
      });
      await openMoveDialogFromStage();

      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Technical Exam");
      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      await waitFor(() =>
        expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalledWith(
          "app-1",
          expect.objectContaining({ step_id: "step-tech" })
        )
      );
      const [, body] = vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mock.calls[0]!;
      expect(body.note).toBeUndefined();
    });

    it("enforces the note max length (1000)", async () => {
      await openMoveDialogFromStage();

      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Technical Exam");
      const textarea = screen.getByLabelText("Transition note (optional)");
      await userEvent.click(textarea);
      await userEvent.paste("a".repeat(1001));
      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      expect(await screen.findByText("Note must be 1000 characters or fewer")).toBeInTheDocument();
      expect(hiringPipelineBoardApi.moveApplicationToHiringStep).not.toHaveBeenCalled();
    });

    it("sends only step_id and note in the request body", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockResolvedValue({
        application: { id: "app-1", status: "in_process", current_step_id: "step-tech" },
      });
      await openMoveDialogFromStage();

      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Technical Exam");
      await userEvent.type(screen.getByLabelText("Transition note (optional)"), "Looks strong");
      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      await waitFor(() => expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalled());
      const [, body] = vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mock.calls[0]!;
      expect(Object.keys(body).sort()).toEqual(["note", "step_id"].sort());
    });

    it("never sends status/job/company/current-step fields", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockResolvedValue({
        application: { id: "app-1", status: "in_process", current_step_id: "step-tech" },
      });
      await openMoveDialogFromStage();

      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Technical Exam");
      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      await waitFor(() => expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalled());
      const [, body] = vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mock.calls[0]!;
      expect(body).not.toHaveProperty("status");
      expect(body).not.toHaveProperty("job_id");
      expect(body).not.toHaveProperty("company_id");
      expect(body).not.toHaveProperty("current_step_id");
    });
  });

  // ===== MOVE SUCCESS =====
  describe("move success", () => {
    it("calls the correct endpoint, closes the dialog, refetches, and renders the candidate in the destination with updated counts", async () => {
      const stageReview = buildHiringPipelineBoardColumn({
        id: "step-review",
        name: "Application Review",
        count: 1,
        applications: [buildHiringPipelineApplicationCard({ id: "app-1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
      });
      const stageTech = buildHiringPipelineBoardColumn({ id: "step-tech", name: "Technical Exam", type: "assessment", position: 1, count: 0, applications: [] });

      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard)
        .mockResolvedValueOnce(buildHiringPipelineBoard({ stages: [stageReview, stageTech] }))
        .mockResolvedValueOnce(
          buildHiringPipelineBoard({
            stages: [
              { ...stageReview, count: 0, applications: [] },
              {
                ...stageTech,
                count: 1,
                applications: [buildHiringPipelineApplicationCard({ id: "app-1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
              },
            ],
          })
        );
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockResolvedValue({
        application: { id: "app-1", status: "in_process", current_step_id: "step-tech" },
      });

      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("button", { name: "Move Sarah Ahmed" }));
      await screen.findByRole("heading", { name: "Move applicant" });

      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Technical Exam");
      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      await waitFor(() =>
        expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalledWith("app-1", { step_id: "step-tech" })
      );
      await waitFor(() => expect(screen.queryByRole("heading", { name: "Move applicant" })).not.toBeInTheDocument());
      await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledTimes(2));

      const techHeading = await screen.findByRole("heading", { name: "Technical Exam" });
      expect(techHeading.parentElement?.textContent).toContain("1");
      const reviewHeading = screen.getByRole("heading", { name: "Application Review" });
      expect(reviewHeading.parentElement?.textContent).toContain("0");
    });
  });

  // ===== MOVE FAILURE =====
  describe("move failure", () => {
    async function openMoveDialog() {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "app-1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
            buildHiringPipelineBoardColumn({ id: "step-tech", name: "Technical Exam", type: "assessment", position: 1 }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("button", { name: "Move Sarah Ahmed" }));
      await screen.findByRole("heading", { name: "Move applicant" });
      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Technical Exam");
    }

    it("does not locally relocate the card when the move fails", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockRejectedValue(new ApiError("conflict", 409));
      await openMoveDialog();

      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));
      await screen.findByText(/This application changed while you were working/);

      // The dialog is still open showing "Current: Application Review"
      // (the move never succeeded), proving the card wasn't
      // optimistically relocated.
      expect(within(screen.getByRole("dialog")).getByText("Application Review")).toBeInTheDocument();
    });

    it("shows a safe concurrency/state message for a 409", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockRejectedValue(new ApiError("raw mongo session error", 409));
      await openMoveDialog();

      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      expect(
        await screen.findByText("This application changed while you were working. Refresh the pipeline and try again.")
      ).toBeInTheDocument();
      expect(screen.queryByText(/raw mongo session error/)).not.toBeInTheDocument();
    });

    it("refetches the board after a 409", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockRejectedValue(new ApiError("conflict", 409));
      await openMoveDialog();

      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledTimes(2));
    });

    it("blocks a duplicate move while one is pending", async () => {
      let resolveMove: (value: { application: { id: string; status: string; current_step_id: string | null } }) => void = () => {};
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockReturnValue(
        new Promise((resolve) => {
          resolveMove = resolve;
        })
      );
      await openMoveDialog();

      const submitButton = screen.getByRole("button", { name: "Move Applicant" });
      await userEvent.click(submitButton);
      expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();

      resolveMove({ application: { id: "app-1", status: "in_process", current_step_id: "step-tech" } });
      await waitFor(() => expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalledTimes(1));
    });

    it("never shows raw backend error text for a 400", async () => {
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockRejectedValue(new ApiError("ZodError: invalid step_id", 400));
      await openMoveDialog();

      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      expect(await screen.findByText("Please check the movement details and try again.")).toBeInTheDocument();
      expect(screen.queryByText(/ZodError/)).not.toBeInTheDocument();
    });
  });

  // ===== NEEDS ATTENTION =====
  describe("needs attention", () => {
    it("hides the warning when there are no records", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(buildHiringPipelineBoard({ needs_attention: [] }));
      renderBoard();
      await screen.findByText("New Applicants");
      expect(screen.queryByText("Applications need attention")).not.toBeInTheDocument();
    });

    it("shows the warning when records exist", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ needs_attention: [buildHiringPipelineNeedsAttentionApplication()] })
      );
      renderBoard();
      expect(await screen.findByText("Applications need attention")).toBeInTheDocument();
    });

    it("shows only safe candidate fields", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          needs_attention: [
            buildHiringPipelineNeedsAttentionApplication({
              candidate: { id: "c1", full_name: "Inconsistent Ivan", email: "ivan@example.test" },
              status: "in_process",
            }),
          ],
        })
      );
      renderBoard();

      expect(await screen.findByText("Inconsistent Ivan")).toBeInTheDocument();
      expect(screen.getByText("ivan@example.test")).toBeInTheDocument();
      expect(screen.getByText("In Process")).toBeInTheDocument();
    });

    it("View Application works from needs_attention", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ needs_attention: [buildHiringPipelineNeedsAttentionApplication({ id: "app-needs-1" })] })
      );
      renderBoard();
      await screen.findByText("Applications need attention");

      const links = screen.getAllByRole("link", { name: "View Application" });
      expect(links.some((link) => link.getAttribute("href") === "/applications/app-needs-1")).toBe(true);
    });

    it("never displays the raw current_step_id", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          needs_attention: [buildHiringPipelineNeedsAttentionApplication({ current_step_id: "6aaf0000000000000000abcd" })],
        })
      );
      renderBoard();
      await screen.findByText("Applications need attention");
      expect(document.body.textContent).not.toContain("6aaf0000000000000000abcd");
    });

    it("offers no Move action from needs_attention", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ stages: [], needs_attention: [buildHiringPipelineNeedsAttentionApplication()] })
      );
      renderBoard();
      await screen.findByText("Applications need attention");

      // Only "View Application" — no "Move" button anywhere in the
      // needs-attention list itself.
      const warningSection = screen.getByText("Applications need attention").closest("li, div")!;
      expect(warningSection.parentElement?.querySelector("button")).toBeNull();
    });
  });

  // ===== CLOSED / EMPTY =====
  describe("closed job and empty board", () => {
    it("visibly identifies a closed Job", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ job: { id: JOB_ID, title: "Backend Developer", status: "closed" } })
      );
      renderBoard();
      expect(await screen.findByText("Closed")).toBeInTheDocument();
    });

    it("does not show a closed badge for an active Job", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ job: { id: JOB_ID, title: "Backend Developer", status: "active" } })
      );
      renderBoard();
      await screen.findByText("New Applicants");
      expect(screen.queryByText("Closed")).not.toBeInTheDocument();
    });

    it("explains that new applications are closed but existing pipeline processing can continue", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ job: { id: JOB_ID, title: "Backend Developer", status: "closed" } })
      );
      renderBoard();

      expect(
        await screen.findByText(
          "This job is closed to new applications. Existing applicants can still move through the hiring process."
        )
      ).toBeInTheDocument();
    });

    it("does not show that explanatory message for an active Job", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ job: { id: JOB_ID, title: "Backend Developer", status: "active" } })
      );
      renderBoard();
      await screen.findByText("New Applicants");
      expect(screen.queryByText(/closed to new applications/)).not.toBeInTheDocument();
    });

    it("keeps the Move button available for an existing applicant in a closed Job", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          job: { id: JOB_ID, title: "Backend Developer", status: "closed" },
          unassigned: {
            count: 1,
            applications: [buildHiringPipelineApplicationCard({ candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
          },
        })
      );
      renderBoard();

      const moveButton = await screen.findByRole("button", { name: "Move Sarah Ahmed" });
      expect(moveButton).toBeEnabled();
    });

    it("still calls the movement API normally for a closed Job", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          job: { id: JOB_ID, title: "Backend Developer", status: "closed" },
          stages: [
            buildHiringPipelineBoardColumn({ id: "step-review", name: "Application Review" }),
            buildHiringPipelineBoardColumn({ id: "step-tech", name: "Technical Exam", type: "assessment", position: 1 }),
          ],
          unassigned: {
            count: 1,
            applications: [buildHiringPipelineApplicationCard({ id: "app-1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
          },
        })
      );
      vi.mocked(hiringPipelineBoardApi.moveApplicationToHiringStep).mockResolvedValue({
        application: { id: "app-1", status: "in_process", current_step_id: "step-review" },
      });
      renderBoard();

      await userEvent.click(await screen.findByRole("button", { name: "Move Sarah Ahmed" }));
      await screen.findByRole("heading", { name: "Move applicant" });
      await userEvent.selectOptions(screen.getByLabelText("Move to"), "Application Review");
      await userEvent.click(screen.getByRole("button", { name: "Move Applicant" }));

      await waitFor(() =>
        expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalledWith("app-1", { step_id: "step-review" })
      );
    });

    it('never labels a closed Job\'s pipeline "read-only"', async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ job: { id: JOB_ID, title: "Backend Developer", status: "closed" } })
      );
      renderBoard();
      await screen.findByText("Closed");
      expect(document.body.textContent?.toLowerCase()).not.toContain("read-only");
    });

    it("renders all configured columns with zero counts when there are no applications", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          unassigned: { count: 0, applications: [] },
          stages: [buildHiringPipelineBoardColumn({ name: "Application Review", count: 0, applications: [] })],
        })
      );
      renderBoard();

      const newApplicantsHeading = await screen.findByRole("heading", { name: "New Applicants" });
      expect(newApplicantsHeading.parentElement?.textContent).toContain("0");
      const reviewHeading = screen.getByRole("heading", { name: "Application Review" });
      expect(reviewHeading.parentElement?.textContent).toContain("0");
    });

    it("never invents a fake applicant", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ unassigned: { count: 0, applications: [] }, stages: [] })
      );
      renderBoard();
      await screen.findByText("No hiring stages are configured for this job yet.");
      expect(screen.queryByRole("link", { name: "View Application" })).not.toBeInTheDocument();
    });

    it("never renders a hard-coded default pipeline (Review/Interview/Assessment) when stages is empty", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(buildHiringPipelineBoard({ stages: [] }));
      renderBoard();
      await screen.findByText("No hiring stages are configured for this job yet.");
      expect(screen.queryByRole("heading", { name: "Review" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Interview" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Assessment" })).not.toBeInTheDocument();
    });
  });

  // ===== SECURITY / PRODUCT RULES =====
  describe("security and product rules", () => {
    it("never triggers a move without an explicit HR click (no auto-assignment on load)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(buildHiringPipelineBoard());
      renderBoard();
      await screen.findByText("New Applicants");
      expect(hiringPipelineBoardApi.moveApplicationToHiringStep).not.toHaveBeenCalled();
    });

    it("never uses candidate-ranking or hiring-judgment language anywhere on the board", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          unassigned: { count: 1, applications: [buildHiringPipelineApplicationCard({ screening: { has_screening: true, latest_score: 63 } })] },
        })
      );
      renderBoard();
      await screen.findByText("New Applicants");

      const text = (document.body.textContent ?? "").toLowerCase();
      for (const phrase of [
        "candidate score",
        "ai score",
        "hiring score",
        "match quality",
        "suitable",
        "best candidate",
        "recommended",
        "hiring probability",
      ]) {
        expect(text).not.toContain(phrase);
      }
    });

    it("never mentions scheduling, Meet, assessment sending, or email as already working", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({ stages: [buildHiringPipelineBoardColumn({ type: "interview" })] })
      );
      renderBoard();
      await screen.findByText("New Applicants");

      const text = (document.body.textContent ?? "").toLowerCase();
      expect(text).not.toMatch(/google meet|schedule interview now|assessment sent|email sent/);
    });
  });
});
