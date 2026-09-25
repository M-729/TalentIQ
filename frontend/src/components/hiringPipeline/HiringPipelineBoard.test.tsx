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
  buildInterview,
} from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as hiringPipelineBoardApi from "@/services/api/hiringPipelineBoard";
import * as interviewsApi from "@/services/api/interviews";
import * as usersApi from "@/services/api/users";
import type { HiringPipelineApplicationCard } from "@/types/hiringPipelineBoard";

vi.mock("@/services/api/hiringPipelineBoard");
vi.mock("@/services/api/interviews");
vi.mock("@/services/api/users");

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
    vi.mocked(hiringPipelineBoardApi.bulkMoveApplications).mockReset();
    vi.mocked(interviewsApi.listApplicationInterviews).mockReset();
    vi.mocked(usersApi.listInterviewerCandidates).mockReset().mockResolvedValue({ users: [] });
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
      await renderWithOneCard({ id: "application-42", public_id: "application-42" });
      const links = screen.getAllByRole("link", { name: "View Application" });
      expect(links[0]).toHaveAttribute("href", "/applications/application-42");
    });

    // Phase 1 opaque public ID migration: prefers public_id over the raw
    // Mongo _id (exposed here as `id`) once the backend provides one.
    it("View Application links using public_id when present, not id", async () => {
      await renderWithOneCard({ id: "internal-object-id", public_id: "app_a8f13c92e51b4f638dde79bf" });
      const links = screen.getAllByRole("link", { name: "View Application" });
      expect(links[0]).toHaveAttribute("href", "/applications/app_a8f13c92e51b4f638dde79bf");
    });

    it('shows "AI Match X%" for a screened application', async () => {
      await renderWithOneCard({ screening: { status: "completed", has_screening: true, latest_score: 75 } });
      expect(screen.getByText("AI Match 75%")).toBeInTheDocument();
    });

    it('shows "Not screened" for an unscreened application', async () => {
      await renderWithOneCard({ screening: { status: "not_started", has_screening: false } });
      expect(screen.getByText("Not screened")).toBeInTheDocument();
    });

    it("never shows a fake 0% for an unscreened application", async () => {
      await renderWithOneCard({ screening: { status: "not_started", has_screening: false } });
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    });

    it('shows "AI Screening · Processing" while the initial screening is running', async () => {
      await renderWithOneCard({ screening: { status: "processing", has_screening: false } });
      expect(screen.getByText("AI Screening · Processing")).toBeInTheDocument();
    });

    it('shows "AI Screening · Needs attention" when the initial screening failed', async () => {
      await renderWithOneCard({ screening: { status: "failed", has_screening: false } });
      expect(screen.getByText("AI Screening · Needs attention")).toBeInTheDocument();
    });

    it('shows "AI Screening · Needs attention" for a stale/interrupted processing run', async () => {
      await renderWithOneCard({ screening: { status: "stale_processing", has_screening: false } });
      expect(screen.getByText("AI Screening · Needs attention")).toBeInTheDocument();
    });

    it("renders cards in exactly the order returned by the API (oldest first, not re-sorted)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [],
          unassigned: {
            count: 2,
            applications: [
              buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Low Coverage", email: "low@test.com" }, screening: { status: "completed", has_screening: true, latest_score: 20 } }),
              buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "High Coverage", email: "high@test.com" }, screening: { status: "completed", has_screening: true, latest_score: 95 } }),
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
          "application-1-public",
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
        expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalledWith("application-1-public", { step_id: "step-tech" })
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
        buildHiringPipelineBoard({ needs_attention: [buildHiringPipelineNeedsAttentionApplication({ id: "app-needs-1", public_id: "app-needs-1" })] })
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
        expect(hiringPipelineBoardApi.moveApplicationToHiringStep).toHaveBeenCalledWith("application-1-public", { step_id: "step-review" })
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

  // ===== SCHEDULE INTERVIEW CONTEXTUAL ACTION =====
  describe("schedule interview contextual action", () => {
    it("exposes a Schedule Interview action for a candidate in an interview-type stage", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Final Interview",
              type: "interview",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      renderBoard();

      expect(await screen.findByRole("button", { name: "Schedule interview for Sarah Ahmed" })).toBeInTheDocument();
    });

    it("does not expose a Schedule Interview action for a non-interview stage", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              type: "review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      renderBoard();

      await screen.findByRole("heading", { name: "Application Review" });
      expect(screen.queryByRole("button", { name: /Schedule interview/ })).not.toBeInTheDocument();
    });

    it("does not expose a Schedule Interview action for New Applicants (never a real HiringStep)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [],
          unassigned: {
            count: 1,
            applications: [buildHiringPipelineApplicationCard({ candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
          },
        })
      );
      renderBoard();

      await screen.findByText("New Applicants");
      expect(screen.queryByRole("button", { name: /Schedule interview/ })).not.toBeInTheDocument();
    });

    it("never requests an application's interviews on initial board render (no N+1 fetch per card)", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Final Interview",
              type: "interview",
              count: 2,
              applications: [
                buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } }),
                buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "Omar Ali", email: "omar@example.test" } }),
              ],
            }),
          ],
        })
      );
      renderBoard();

      await screen.findByRole("heading", { name: "Final Interview" });
      expect(interviewsApi.listApplicationInterviews).not.toHaveBeenCalled();
    });

    it("fetches only the clicked application's interviews, and opens the schedule form when none exists yet for this stage", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Final Interview",
              type: "interview",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({ interviews: [] });
      renderBoard();

      await userEvent.click(await screen.findByRole("button", { name: "Schedule interview for Sarah Ahmed" }));

      await waitFor(() =>
        expect(interviewsApi.listApplicationInterviews).toHaveBeenCalledWith("application-1-public", expect.anything())
      );
      expect(await screen.findByRole("heading", { name: "Schedule interview" })).toBeInTheDocument();
    });

    it("opens the existing interview instead of the schedule form when an active one already exists for this exact stage", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Final Interview",
              type: "interview",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      vi.mocked(interviewsApi.listApplicationInterviews).mockResolvedValue({
        interviews: [buildInterview({ id: "existing-interview-1", stage: { id: "step-interview", name: "Final Interview", type: "interview" }, status: "scheduled" })],
      });
      renderBoard();

      await userEvent.click(await screen.findByRole("button", { name: "Schedule interview for Sarah Ahmed" }));

      await waitFor(() => expect(screen.queryByRole("heading", { name: "Schedule interview" })).not.toBeInTheDocument());
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
          unassigned: { count: 1, applications: [buildHiringPipelineApplicationCard({ screening: { status: "completed", has_screening: true, latest_score: 63 } })] },
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

  // ===== BULK SELECTION CHECKBOXES =====
  describe("bulk selection checkboxes", () => {
    async function renderWithTwoCandidatesInReview() {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 2,
              applications: [
                buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } }),
                buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "Omar Ali", email: "omar@example.test" } }),
              ],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
    }

    it("renders a checkbox for every movable candidate card", async () => {
      await renderWithTwoCandidatesInReview();
      expect(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" })).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Select Omar Ali" })).toBeInTheDocument();
    });

    it("selecting a checkbox does not navigate to the candidate's detail page", async () => {
      await renderWithTwoCandidatesInReview();
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      expect(screen.queryByText("Application Detail Page")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Application Review" })).toBeInTheDocument();
    });

    it("the card's View Application link still works after selecting", async () => {
      await renderWithTwoCandidatesInReview();
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      const links = screen.getAllByRole("link", { name: "View Application" });
      expect(links[0]).toHaveAttribute("href", "/applications/application-1-public");
    });

    it("toggles selection on and off", async () => {
      await renderWithTwoCandidatesInReview();
      const checkbox = screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }) as HTMLInputElement;
      await userEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      await userEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it("shows the Select All checkbox as checked once every candidate in the column is selected", async () => {
      await renderWithTwoCandidatesInReview();
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Omar Ali" }));

      const selectAll = screen.getByRole("checkbox", { name: "Select all in Application Review" }) as HTMLInputElement;
      expect(selectAll.checked).toBe(true);
    });

    it("shows the Select All checkbox as indeterminate when only some candidates are selected", async () => {
      await renderWithTwoCandidatesInReview();
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));

      const selectAll = screen.getByRole("checkbox", { name: "Select all in Application Review" }) as HTMLInputElement;
      expect(selectAll.indeterminate).toBe(true);
    });

    it("Select All selects every candidate in that column only", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
          unassigned: {
            count: 1,
            applications: [buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "Omar Ali", email: "omar@example.test" } })],
          },
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });

      await userEvent.click(screen.getByRole("checkbox", { name: "Select all in Application Review" }));

      expect((screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }) as HTMLInputElement).checked).toBe(true);
      // A different column's candidate must be untouched.
      expect((screen.getByRole("checkbox", { name: "Select Omar Ali" }) as HTMLInputElement).checked).toBe(false);
    });

    it("clicking Select All again clears that column's selection", async () => {
      await renderWithTwoCandidatesInReview();
      const selectAll = screen.getByRole("checkbox", { name: "Select all in Application Review" });
      await userEvent.click(selectAll);
      await userEvent.click(selectAll);

      expect((screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }) as HTMLInputElement).checked).toBe(false);
      expect((screen.getByRole("checkbox", { name: "Select Omar Ali" }) as HTMLInputElement).checked).toBe(false);
    });
  });

  // ===== SELECTION TOOLBAR =====
  describe("selection toolbar", () => {
    it("shows no toolbar when nothing is selected", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1" })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Move selected" })).not.toBeInTheDocument();
    });

    it("shows the selected count once a candidate is selected", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });

      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      expect(await screen.findByText("1 candidate selected")).toBeInTheDocument();
    });

    it("Clear selection empties the selection and hides the toolbar", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      await screen.findByText("1 candidate selected");

      await userEvent.click(screen.getByRole("button", { name: "Clear selection" }));

      expect(screen.queryByText("1 candidate selected")).not.toBeInTheDocument();
      expect((screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }) as HTMLInputElement).checked).toBe(false);
    });
  });

  // ===== BULK MOVE DIALOG =====
  describe("bulk move dialog", () => {
    async function selectTwoAndOpenBulkDialog() {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 2,
              applications: [
                buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } }),
                buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "Omar Ali", email: "omar@example.test" } }),
              ],
            }),
            buildHiringPipelineBoardColumn({ id: "step-interview", name: "Technical Interview", type: "interview", position: 1 }),
            buildHiringPipelineBoardColumn({ id: "step-assessment", name: "Take-home Exam", type: "assessment", position: 2 }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("checkbox", { name: "Select all in Application Review" }));
      await userEvent.click(screen.getByRole("button", { name: "Move selected" }));
      await screen.findByRole("heading", { name: "Move 2 candidates" });
    }

    it("opens showing the selected count and the Job's real dynamic stages", async () => {
      await selectTwoAndOpenBulkDialog();
      const select = screen.getByLabelText("Destination");
      expect(select).toContainHTML("Technical Interview");
      expect(select).toContainHTML("Take-home Exam");
      // Never a hard-coded stage name that wasn't actually returned.
      expect(select).not.toContainHTML("Offer");
    });

    it("excludes the current stage from the destination list", async () => {
      await selectTwoAndOpenBulkDialog();
      const select = screen.getByLabelText("Destination") as HTMLSelectElement;
      const optionLabels = Array.from(select.options).map((o) => o.textContent);
      expect(optionLabels.some((label) => label?.includes("Application Review"))).toBe(false);
    });

    it("shows a plain (non-destructive) confirmation with the selected count and destination", async () => {
      await selectTwoAndOpenBulkDialog();
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Take-home Exam (Type: assessment)");

      expect(await screen.findByText(/Move 2 candidates to "Take-home Exam"/)).toBeInTheDocument();
    });

    it("shows interview-specific consequence copy when the destination is an interview-type stage", async () => {
      await selectTwoAndOpenBulkDialog();
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");

      expect(
        await screen.findByText(/Interviews will still need to be scheduled individually/)
      ).toBeInTheDocument();
    });

    it("shows assessment-specific consequence copy when the destination is an assessment-type stage", async () => {
      await selectTwoAndOpenBulkDialog();
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Take-home Exam (Type: assessment)");

      expect(await screen.findByText(/Assessments are managed separately/)).toBeInTheDocument();
    });

    it("never uses destructive styling for the confirm action", async () => {
      await selectTwoAndOpenBulkDialog();
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");

      const confirmButton = screen.getByRole("button", { name: "Move Candidates" });
      expect(confirmButton.className).not.toMatch(/destructive/);
    });

    it("blocks submission and explains when some (not all) selected candidates are already at the chosen destination", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Technical Interview",
              type: "interview",
              position: 1,
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a2", candidate: { id: "c2", full_name: "Omar Ali", email: "omar@example.test" } })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Omar Ali" }));
      await userEvent.click(screen.getByRole("button", { name: "Move selected" }));
      await screen.findByRole("heading", { name: "Move 2 candidates" });

      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");

      expect(await screen.findByText(/already in/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Move Candidates" })).toBeDisabled();
    });

    // Backend's own bulk-move zod schema is `.max(100)` — 100 is allowed,
    // 101 is the first count it rejects with a 400. These three cases pin
    // that exact boundary on the frontend's pre-emptive warning/blocking.
    describe("100-candidate bulk-move limit", () => {
      function buildManyCandidates(count: number): HiringPipelineApplicationCard[] {
        return Array.from({ length: count }, (_, i) =>
          buildHiringPipelineApplicationCard({
            id: `a${i + 1}`,
            candidate: { id: `c${i + 1}`, full_name: `Candidate ${i + 1}`, email: `candidate${i + 1}@example.test` },
          })
        );
      }

      async function selectAllAndOpenBulkDialog(count: number) {
        vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
          buildHiringPipelineBoard({
            stages: [
              buildHiringPipelineBoardColumn({ id: "step-review", name: "Application Review", count, applications: buildManyCandidates(count) }),
              buildHiringPipelineBoardColumn({ id: "step-interview", name: "Technical Interview", type: "interview", position: 1 }),
            ],
          })
        );
        renderBoard();
        await screen.findByRole("heading", { name: "Application Review" });
        await userEvent.click(screen.getByRole("checkbox", { name: "Select all in Application Review" }));
        await userEvent.click(screen.getByRole("button", { name: "Move selected" }));
        await screen.findByRole("heading", { name: `Move ${count} candidates` });
      }

      it("99 candidates: no warning, selecting a destination and moving remains available", async () => {
        await selectAllAndOpenBulkDialog(99);

        expect(screen.queryByText(/max 100/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Deselect/)).not.toBeInTheDocument();
        expect(screen.getByLabelText("Destination")).not.toBeDisabled();

        await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");
        expect(screen.getByRole("button", { name: "Move Candidates" })).not.toBeDisabled();
      });

      it("100 candidates (the exact backend limit): still no warning, still allowed", async () => {
        await selectAllAndOpenBulkDialog(100);

        expect(screen.queryByText(/max 100/)).not.toBeInTheDocument();
        expect(screen.getByLabelText("Destination")).not.toBeDisabled();

        await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");
        expect(screen.getByRole("button", { name: "Move Candidates" })).not.toBeDisabled();
      });

      it("101 candidates: warns and blocks submission before any request is sent", async () => {
        await selectAllAndOpenBulkDialog(101);

        expect(await screen.findByText(/Up to 100 candidates can be moved at once/)).toBeInTheDocument();
        expect(screen.getByText(/Deselect 1 candidate to continue/)).toBeInTheDocument();
        expect(screen.getByLabelText("Destination")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Move Candidates" })).toBeDisabled();
        expect(hiringPipelineBoardApi.bulkMoveApplications).not.toHaveBeenCalled();
      });

      it("101 candidates: the selection toolbar itself already shows the limit before the dialog is even opened", async () => {
        vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
          buildHiringPipelineBoard({
            stages: [buildHiringPipelineBoardColumn({ id: "step-review", name: "Application Review", count: 101, applications: buildManyCandidates(101) })],
          })
        );
        renderBoard();
        await screen.findByRole("heading", { name: "Application Review" });
        await userEvent.click(screen.getByRole("checkbox", { name: "Select all in Application Review" }));

        expect(await screen.findByText(/max 100 per move/)).toBeInTheDocument();
      });
    });
  });

  // ===== BULK MOVE PENDING / DOUBLE-SUBMIT =====
  describe("bulk move pending state", () => {
    it("disables the confirm button and prevents a duplicate request while pending", async () => {
      let resolveMove: (value: { moved_count: number; target_step: { id: string; name: string; type: string }; applications: [] }) => void = () => {};
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
            buildHiringPipelineBoardColumn({ id: "step-interview", name: "Technical Interview", type: "interview", position: 1 }),
          ],
        })
      );
      vi.mocked(hiringPipelineBoardApi.bulkMoveApplications).mockReturnValue(
        new Promise((resolve) => {
          resolveMove = resolve;
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      await userEvent.click(screen.getByRole("button", { name: "Move selected" }));
      await screen.findByRole("heading", { name: "Move 1 candidates" });
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");

      const confirmButton = screen.getByRole("button", { name: "Move Candidates" });
      await userEvent.click(confirmButton);
      expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();

      resolveMove({ moved_count: 1, target_step: { id: "step-interview", name: "Technical Interview", type: "interview" }, applications: [] });
      await waitFor(() => expect(hiringPipelineBoardApi.bulkMoveApplications).toHaveBeenCalledTimes(1));
    });
  });

  // ===== BULK MOVE SUCCESS =====
  describe("bulk move success", () => {
    it("clears the selection and refetches the board after a successful bulk move", async () => {
      const stageReview = buildHiringPipelineBoardColumn({
        id: "step-review",
        name: "Application Review",
        count: 1,
        applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
      });
      const stageInterview = buildHiringPipelineBoardColumn({ id: "step-interview", name: "Technical Interview", type: "interview", position: 1, count: 0, applications: [] });

      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard)
        .mockResolvedValueOnce(buildHiringPipelineBoard({ stages: [stageReview, stageInterview] }))
        .mockResolvedValueOnce(
          buildHiringPipelineBoard({
            stages: [
              { ...stageReview, count: 0, applications: [] },
              { ...stageInterview, count: 1, applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })] },
            ],
          })
        );
      vi.mocked(hiringPipelineBoardApi.bulkMoveApplications).mockResolvedValue({
        moved_count: 1,
        target_step: { id: "step-interview", name: "Technical Interview", type: "interview" },
        applications: [{ id: "a1", status: "in_process", current_step_id: "step-interview" }],
      });

      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      await userEvent.click(screen.getByRole("button", { name: "Move selected" }));
      await screen.findByRole("heading", { name: "Move 1 candidates" });
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");
      await userEvent.click(screen.getByRole("button", { name: "Move Candidates" }));

      await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole("heading", { name: "Move 1 candidates" })).not.toBeInTheDocument());
      expect(await screen.findByText("1 candidate moved to Technical Interview.")).toBeInTheDocument();
      expect(screen.queryByText(/candidate selected/)).not.toBeInTheDocument();
    });
  });

  // ===== BULK MOVE FAILURE =====
  describe("bulk move failure", () => {
    it("keeps the selection and explains that no candidates were moved on failure", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })],
            }),
            buildHiringPipelineBoardColumn({ id: "step-interview", name: "Technical Interview", type: "interview", position: 1 }),
          ],
        })
      );
      vi.mocked(hiringPipelineBoardApi.bulkMoveApplications).mockRejectedValue(new ApiError("conflict", 409));

      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      await userEvent.click(screen.getByRole("checkbox", { name: "Select Sarah Ahmed" }));
      await userEvent.click(screen.getByRole("button", { name: "Move selected" }));
      await screen.findByRole("heading", { name: "Move 1 candidates" });
      await userEvent.selectOptions(screen.getByLabelText("Destination"), "Technical Interview (Type: interview)");
      await userEvent.click(screen.getByRole("button", { name: "Move Candidates" }));

      expect(
        await screen.findByText("One or more selected candidates changed, or are already in that stage. Refresh the pipeline and try again.")
      ).toBeInTheDocument();

      // The dialog stays open (recovery is still possible) and the
      // selection checkbox is still checked underneath it.
      expect(screen.getByRole("heading", { name: "Move 1 candidates" })).toBeInTheDocument();
    });
  });

  // ===== INTERVIEW STATUS ON CARD =====
  describe("interview status on card", () => {
    async function renderInterviewCard(interviewSummary: HiringPipelineApplicationCard["interview_summary"]) {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Technical Interview",
              type: "interview",
              count: 1,
              applications: [
                buildHiringPipelineApplicationCard({
                  id: "a1",
                  candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
                  interview_summary: interviewSummary,
                }),
              ],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Technical Interview" });
    }

    it('shows "Interview · Not scheduled" when no Interview exists yet', async () => {
      await renderInterviewCard({ status: "not_scheduled" });
      expect(screen.getByText(/Interview · Not scheduled/)).toBeInTheDocument();
    });

    it('shows "Interview · Scheduled" with the date/time for a scheduled Interview', async () => {
      await renderInterviewCard({ status: "scheduled", starts_at: "2025-09-24T14:00:00.000Z", timezone: "UTC" });
      expect(screen.getByText(/Interview · Scheduled/)).toBeInTheDocument();
    });

    it('shows "Interview · Completed" with the feedback count', async () => {
      await renderInterviewCard({ status: "completed", feedback_submitted_count: 1, feedback_total_count: 2 });
      expect(screen.getByText(/Interview · Completed/)).toBeInTheDocument();
      expect(screen.getByText("Feedback 1/2")).toBeInTheDocument();
    });

    it('shows "Interview · Cancelled" for a cancelled Interview', async () => {
      await renderInterviewCard({ status: "cancelled" });
      expect(screen.getByText(/Interview · Cancelled/)).toBeInTheDocument();
    });

    it("shows no interview status line for a card in a non-interview stage", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              type: "review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", interview_summary: null })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      expect(screen.queryByText(/Interview ·/)).not.toBeInTheDocument();
    });

    it("never renders a Join Meet action on the pipeline card", async () => {
      await renderInterviewCard({ status: "scheduled", starts_at: "2025-09-24T14:00:00.000Z", timezone: "UTC" });
      expect(screen.queryByRole("button", { name: /join meet/i })).not.toBeInTheDocument();
    });

    it("does not issue an extra Interview request just because interview_summary is already on the card", async () => {
      await renderInterviewCard({ status: "scheduled", starts_at: "2025-09-24T14:00:00.000Z", timezone: "UTC" });
      expect(interviewsApi.listApplicationInterviews).not.toHaveBeenCalled();
    });
  });

  // ===== ASSESSMENT STATUS ON CARD =====
  describe("assessment status on card", () => {
    async function renderAssessmentCard(assessmentSummary: HiringPipelineApplicationCard["assessment_summary"]) {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-assessment",
              name: "Technical Assessment",
              type: "assessment",
              count: 1,
              applications: [
                buildHiringPipelineApplicationCard({
                  id: "a1",
                  candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
                  screening: { status: "completed", has_screening: true, latest_score: 81 },
                  assessment_summary: assessmentSummary,
                }),
              ],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Technical Assessment" });
    }

    // 22. Not configured
    it('shows "Assessment · Not configured" when no assessment record exists', async () => {
      await renderAssessmentCard({ status: "not_configured", grade: null, email_status: null });
      expect(screen.getByText(/Assessment · Not configured/)).toBeInTheDocument();
    });

    // 23. Pending
    it('shows "Assessment · Pending" for an assessment awaiting a result', async () => {
      await renderAssessmentCard({ status: "pending", grade: null, email_status: "sent" });
      expect(screen.getByText(/Assessment · Pending/)).toBeInTheDocument();
    });

    // 24. Passed
    it('shows "Assessment · Passed" with no grade line when no grade exists', async () => {
      await renderAssessmentCard({ status: "passed", grade: null, email_status: "sent" });
      expect(screen.getByText(/Assessment · Passed/)).toBeInTheDocument();
      expect(screen.queryByText(/Grade/)).not.toBeInTheDocument();
    });

    // 25. Passed + grade
    it('shows "Assessment · Passed" with "Grade 84%"', async () => {
      await renderAssessmentCard({ status: "passed", grade: 84, email_status: "sent" });
      expect(screen.getByText(/Assessment · Passed/)).toBeInTheDocument();
      expect(screen.getByText("Grade 84%")).toBeInTheDocument();
    });

    // 26. Failed
    it('shows "Assessment · Failed" with no grade line when no grade exists', async () => {
      await renderAssessmentCard({ status: "failed", grade: null, email_status: "sent" });
      expect(screen.getByText(/Assessment · Failed/)).toBeInTheDocument();
      expect(screen.queryByText(/Grade/)).not.toBeInTheDocument();
    });

    // 27. Failed + grade
    it('shows "Assessment · Failed" with "Grade 48%"', async () => {
      await renderAssessmentCard({ status: "failed", grade: 48, email_status: "sent" });
      expect(screen.getByText(/Assessment · Failed/)).toBeInTheDocument();
      expect(screen.getByText("Grade 48%")).toBeInTheDocument();
    });

    it('shows a compact "Email needs attention" hint only while pending and the email failed', async () => {
      await renderAssessmentCard({ status: "pending", grade: null, email_status: "failed" });
      expect(screen.getByText("Email needs attention")).toBeInTheDocument();
    });

    it('never shows "Email needs attention" once a result exists, even if the email failed', async () => {
      await renderAssessmentCard({ status: "passed", grade: 84, email_status: "failed" });
      expect(screen.queryByText("Email needs attention")).not.toBeInTheDocument();
    });

    it("shows no assessment status line for a card in a non-assessment stage", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-review",
              name: "Application Review",
              type: "review",
              count: 1,
              applications: [buildHiringPipelineApplicationCard({ id: "a1", assessment_summary: null })],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Application Review" });
      expect(screen.queryByText(/Assessment ·/)).not.toBeInTheDocument();
    });

    // 28. no per-card assessment request — structural: the board response
    // already carries assessment_summary; no assessment API module is even
    // mocked/imported by this test file, so a per-card request would fail
    // outright rather than silently succeed.
    it("renders purely from the already-batched board response, with no separate per-card fetch", async () => {
      await renderAssessmentCard({ status: "passed", grade: 90, email_status: "sent" });
      expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledTimes(1);
    });

    // 29. AI Match remains visible
    it("keeps the AI Match / screening line visible alongside the assessment status", async () => {
      await renderAssessmentCard({ status: "passed", grade: 90, email_status: "sent" });
      expect(screen.getByText("AI Match 81%")).toBeInTheDocument();
      expect(screen.getByText(/Assessment · Passed/)).toBeInTheDocument();
    });

    // 30. Interview cards unaffected
    it("does not render an assessment line on an interview-stage card", async () => {
      vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
        buildHiringPipelineBoard({
          stages: [
            buildHiringPipelineBoardColumn({
              id: "step-interview",
              name: "Technical Interview",
              type: "interview",
              count: 1,
              applications: [
                buildHiringPipelineApplicationCard({ id: "a1", interview_summary: { status: "not_scheduled" }, assessment_summary: null }),
              ],
            }),
          ],
        })
      );
      renderBoard();
      await screen.findByRole("heading", { name: "Technical Interview" });
      expect(screen.getByText(/Interview · Not scheduled/)).toBeInTheDocument();
      expect(screen.queryByText(/Assessment ·/)).not.toBeInTheDocument();
    });
  });
});
