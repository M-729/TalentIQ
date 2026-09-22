import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AssessmentsPage } from "@/pages/AssessmentsPage";
import { buildAssessmentListRow } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import * as jobsApi from "@/services/api/jobs";

vi.mock("@/services/api/applicationAssessments");
vi.mock("@/services/api/jobs");

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/assessments"]}>
      <Routes>
        <Route path="/assessments" element={<AssessmentsPage />} />
        <Route path="/applications/:applicationId" element={<div>Application Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockPage(assessments: ReturnType<typeof buildAssessmentListRow>[], overrides: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) {
  vi.mocked(applicationAssessmentsApi.listAssessments).mockResolvedValue({
    assessments,
    pagination: { page: 1, limit: 20, total: assessments.length, totalPages: 1, ...overrides },
  });
}

describe("AssessmentsPage", () => {
  beforeEach(() => {
    vi.mocked(applicationAssessmentsApi.listAssessments).mockReset();
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({
      jobs: [
        { _id: "job-1", company_id: "c1", created_by: "u1", title: "Backend Developer", required_skills: [], status: "active", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-01T00:00:00.000Z" },
      ],
    });
  });

  // 31. list renders
  it("fetches and renders assessments on mount", async () => {
    mockPage([buildAssessmentListRow()]);
    renderPage();
    await waitFor(() => expect(applicationAssessmentsApi.listAssessments).toHaveBeenCalled());
    expect(await screen.findByText("Sarah Ahmed")).toBeInTheDocument();
  });

  // 33. candidate/job/assessment/status/grade/email displayed
  it("displays candidate, job, assessment name, status, grade, and email columns", async () => {
    mockPage([
      buildAssessmentListRow({
        candidate: { id: "c1", full_name: "Ahmad Khalil", email: "ahmad@candidate.test" },
        job: { id: "job-1", title: "Backend Developer" },
        name: "Backend Technical Test",
        status: "passed",
        grade: 84,
        email_status: "sent",
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Ahmad Khalil")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Backend Developer")).toBeInTheDocument();
    expect(table.getByText("Backend Technical Test")).toBeInTheDocument();
    expect(table.getByText("Passed")).toBeInTheDocument();
    expect(table.getByText("84%")).toBeInTheDocument();
    expect(table.getByText("Sent")).toBeInTheDocument();
  });

  it('shows "—" for grade and "Not sent" for email when absent', async () => {
    mockPage([buildAssessmentListRow({ grade: null, email_status: null })]);
    renderPage();
    await screen.findByText("Sarah Ahmed");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Not sent")).toBeInTheDocument();
  });

  it("renders the Pipeline Stage for each row", async () => {
    mockPage([buildAssessmentListRow({ current_step: { id: "step-1", name: "Technical Assessment", type: "assessment" } })]);
    renderPage();
    expect(await screen.findByText("Technical Assessment")).toBeInTheDocument();
  });

  // 32. filters
  it("changes the API query when filtering by job", async () => {
    const user = userEvent.setup();
    mockPage([buildAssessmentListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    await user.selectOptions(screen.getByLabelText(/filter by job/i), "job-1");

    await waitFor(() =>
      expect(applicationAssessmentsApi.listAssessments).toHaveBeenLastCalledWith(
        expect.objectContaining({ jobId: "job-1" }),
        expect.anything()
      )
    );
  });

  it("changes the API query when filtering by result status", async () => {
    const user = userEvent.setup();
    mockPage([buildAssessmentListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    await user.selectOptions(screen.getByLabelText(/filter by result status/i), "passed");

    await waitFor(() =>
      expect(applicationAssessmentsApi.listAssessments).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "passed" }),
        expect.anything()
      )
    );
  });

  it("changes the API query when searching", async () => {
    const user = userEvent.setup();
    mockPage([buildAssessmentListRow()]);
    renderPage();
    await waitFor(() => expect(applicationAssessmentsApi.listAssessments).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(/search assessments/i), "ahmad");

    await waitFor(() =>
      expect(applicationAssessmentsApi.listAssessments).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "ahmad" }),
        expect.anything()
      )
    );
  });

  // 34. action navigation works
  it("navigates to the correct Application detail route when View Application is clicked", async () => {
    const user = userEvent.setup();
    mockPage([buildAssessmentListRow({ application_id: "application-42" })]);
    renderPage();

    await user.click(await screen.findByRole("link", { name: /view application/i }));

    expect(await screen.findByText("Application Detail Page")).toBeInTheDocument();
  });

  // 35. empty state
  it("shows the unfiltered empty state when there are no assessments at all", async () => {
    mockPage([], { total: 0, totalPages: 0 });
    renderPage();
    expect(await screen.findByText(/No external assessments yet/)).toBeInTheDocument();
  });

  it("shows the filtered empty state with a clear-filters action when a filter matches nothing", async () => {
    const user = userEvent.setup();
    mockPage([buildAssessmentListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    mockPage([], { total: 0, totalPages: 0 });
    await user.type(screen.getByLabelText(/search assessments/i), "no-such-candidate");

    expect(await screen.findByText("No assessments match your filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  // 36. error state
  it("shows a safe error message on API failure", async () => {
    vi.mocked(applicationAssessmentsApi.listAssessments).mockRejectedValue(new ApiError("raw db error", 500));
    renderPage();
    expect(await screen.findByText("Assessments could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db error/)).not.toBeInTheDocument();
  });

  it("supports pagination", async () => {
    const user = userEvent.setup();
    mockPage([buildAssessmentListRow()], { page: 1, totalPages: 3, total: 45 });
    renderPage();
    await screen.findByText("Page 1 of 3");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() =>
      expect(applicationAssessmentsApi.listAssessments).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything())
    );
  });
});
