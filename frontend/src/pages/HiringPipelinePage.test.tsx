import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { HiringPipelinePage } from "@/pages/HiringPipelinePage";
import { buildHiringPipelineBoard } from "@/test/fixtures";
import * as hiringPipelineBoardApi from "@/services/api/hiringPipelineBoard";
import * as hiringStepsApi from "@/services/api/hiringSteps";
import * as jobsApi from "@/services/api/jobs";
import type { Job } from "@/types/job";

// Workspace-shell-level coverage only (job selection, tabs, default view,
// tab switching). Pipeline Setup's own detailed behavior lives in
// PipelineSetupPanel.test.tsx and the Board's own detailed behavior lives
// in HiringPipelineBoard.test.tsx — both decoupled from this page's
// structure.
vi.mock("@/services/api/hiringPipelineBoard");
vi.mock("@/services/api/hiringSteps");
vi.mock("@/services/api/jobs");

const JOB_A: Job = {
  _id: "job-a",
  company_id: "c1",
  created_by: "u1",
  title: "Backend Developer",
  required_skills: [],
  status: "active",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

const JOB_B: Job = {
  _id: "job-b",
  company_id: "c1",
  created_by: "u1",
  title: "Frontend Developer",
  required_skills: [],
  status: "closed",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

// Exposes the current URL (path + search) for assertions — MemoryRouter
// never touches window.location, so this is how tests observe the
// jobId query param without reaching into router internals.
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
}

function renderPage(initialPath = "/hiring-pipeline") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationDisplay />
      <Routes>
        <Route path="/hiring-pipeline" element={<HiringPipelinePage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function selectJob(jobTitle: string) {
  const select = await screen.findByLabelText("Job");
  await userEvent.selectOptions(select, jobTitle);
}

describe("HiringPipelinePage (workspace shell)", () => {
  beforeEach(() => {
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({ jobs: [JOB_A, JOB_B] });
    vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockReset().mockResolvedValue(buildHiringPipelineBoard());
    vi.mocked(hiringStepsApi.getHiringSteps).mockReset().mockResolvedValue({ steps: [] });
  });

  it("renders the page", async () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Hiring Pipeline" })).toBeInTheDocument();
  });

  it("shows a single shared Job selector, not duplicated per tab", async () => {
    renderPage();
    await selectJob("Backend Developer");
    expect(screen.getAllByLabelText("Job")).toHaveLength(1);
  });

  it("shows the no-selection empty state before a job is chosen", async () => {
    renderPage();
    await waitFor(() => expect(jobsApi.listJobs).toHaveBeenCalled());
    expect(hiringPipelineBoardApi.getHiringPipelineBoard).not.toHaveBeenCalled();
    expect(await screen.findByText("Select a job to view its hiring pipeline.")).toBeInTheDocument();
  });

  it("defaults to the Board tab once a job is selected", async () => {
    renderPage();
    await selectJob("Backend Developer");

    expect(screen.getByRole("button", { name: "Board", pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledWith("job-a", expect.anything()));
  });

  it("Pipeline Setup tab opens the existing builder", async () => {
    renderPage();
    await selectJob("Backend Developer");

    await userEvent.click(screen.getByRole("button", { name: "Pipeline Setup" }));

    await waitFor(() => expect(hiringStepsApi.getHiringSteps).toHaveBeenCalledWith("job-a", expect.anything()));
    expect(await screen.findByText("No hiring stages yet")).toBeInTheDocument();
  });

  it("switching tabs preserves the selected Job", async () => {
    renderPage();
    await selectJob("Frontend Developer");
    await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledWith("job-b", expect.anything()));

    await userEvent.click(screen.getByRole("button", { name: "Pipeline Setup" }));
    await waitFor(() => expect(hiringStepsApi.getHiringSteps).toHaveBeenCalledWith("job-b", expect.anything()));

    expect(screen.getByLabelText("Job")).toHaveValue("job-b");
  });

  it("Configure Pipeline (from an empty board) switches to the Setup tab", async () => {
    vi.mocked(hiringPipelineBoardApi.getHiringPipelineBoard).mockResolvedValue(
      buildHiringPipelineBoard({ stages: [] })
    );
    renderPage();
    await selectJob("Backend Developer");

    await userEvent.click(await screen.findByRole("button", { name: "Configure Pipeline" }));

    expect(screen.getByRole("button", { name: "Pipeline Setup", pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(hiringStepsApi.getHiringSteps).toHaveBeenCalledWith("job-a", expect.anything()));
  });

  // ===== URL PERSISTENCE =====
  describe("selected Job persisted in the URL", () => {
    it("writes jobId to the URL when a Job is selected", async () => {
      renderPage();
      await selectJob("Backend Developer");

      expect(screen.getByTestId("location-display")).toHaveTextContent("/hiring-pipeline?jobId=job-a");
    });

    it("restores the selected Job from a valid initial ?jobId=", async () => {
      renderPage("/hiring-pipeline?jobId=job-a");

      await waitFor(() => expect(screen.getByLabelText("Job")).toHaveValue("job-a"));
    });

    it("automatically loads the Board for a Job restored from the URL", async () => {
      renderPage("/hiring-pipeline?jobId=job-a");

      await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledWith("job-a", expect.anything()));
      expect(screen.getByRole("button", { name: "Board", pressed: true })).toBeInTheDocument();
    });

    it("a fresh render with a URL jobId already set (refresh-equivalent) preserves the Job selection", async () => {
      // A real browser refresh discards React state but keeps the URL —
      // a brand-new render() with the URL already populated is exactly
      // that: no prior interaction, no component instance carried over.
      renderPage("/hiring-pipeline?jobId=job-b");

      await waitFor(() => expect(screen.getByLabelText("Job")).toHaveValue("job-b"));
      await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledWith("job-b", expect.anything()));
    });

    it("changes the URL jobId when switching Jobs", async () => {
      renderPage();
      await selectJob("Backend Developer");
      expect(screen.getByTestId("location-display")).toHaveTextContent("jobId=job-a");

      await selectJob("Frontend Developer");
      expect(screen.getByTestId("location-display")).toHaveTextContent("jobId=job-b");
    });

    it("Board and Pipeline Setup share the same Job restored from the URL", async () => {
      renderPage("/hiring-pipeline?jobId=job-a");
      await waitFor(() => expect(hiringPipelineBoardApi.getHiringPipelineBoard).toHaveBeenCalledWith("job-a", expect.anything()));

      await userEvent.click(screen.getByRole("button", { name: "Pipeline Setup" }));
      await waitFor(() => expect(hiringStepsApi.getHiringSteps).toHaveBeenCalledWith("job-a", expect.anything()));
      expect(screen.getByLabelText("Job")).toHaveValue("job-a");
    });

    it("handles an unknown/stale jobId safely — no crash, no board fetch, shows the normal selection state", async () => {
      renderPage("/hiring-pipeline?jobId=not-a-real-job");

      expect(await screen.findByText("Select a job to view its hiring pipeline.")).toBeInTheDocument();
      expect(hiringPipelineBoardApi.getHiringPipelineBoard).not.toHaveBeenCalled();
    });

    it("strips a stale jobId from the URL once the Jobs list has loaded", async () => {
      renderPage("/hiring-pipeline?jobId=not-a-real-job");

      await waitFor(() => expect(screen.getByTestId("location-display")).not.toHaveTextContent("jobId"));
      expect(screen.getByTestId("location-display")).toHaveTextContent("/hiring-pipeline");
    });
  });
});
