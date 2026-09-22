import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationsPage } from "@/pages/ApplicationsPage";
import { buildApplicationListRow } from "@/test/fixtures";
import * as applicationsApi from "@/services/api/applications";
import * as jobsApi from "@/services/api/jobs";

vi.mock("@/services/api/applications");
vi.mock("@/services/api/jobs");

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/applications"]}>
      <Routes>
        <Route path="/applications" element={<ApplicationsPage />} />
        <Route path="/applications/:applicationId" element={<div>Application Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockPage(applications: ReturnType<typeof buildApplicationListRow>[], overrides: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) {
  vi.mocked(applicationsApi.getApplications).mockResolvedValue({
    applications,
    pagination: { page: 1, limit: 20, total: applications.length, totalPages: 1, ...overrides },
  });
}

describe("ApplicationsPage", () => {
  beforeEach(() => {
    vi.mocked(applicationsApi.getApplications).mockReset();
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({
      jobs: [
        { _id: "job-1", company_id: "c1", created_by: "u1", title: "Backend Developer", required_skills: [], status: "active", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-01T00:00:00.000Z" },
      ],
    });
  });

  it("fetches applications on mount", async () => {
    mockPage([buildApplicationListRow()]);
    renderPage();
    await waitFor(() => expect(applicationsApi.getApplications).toHaveBeenCalled());
  });

  it("renders the candidate name", async () => {
    mockPage([buildApplicationListRow({ candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test" } })]);
    renderPage();
    expect(await screen.findByText("Sarah Ahmed")).toBeInTheDocument();
  });

  it("renders the correct applied job", async () => {
    mockPage([buildApplicationListRow({ job: { id: "j1", title: "Frontend Developer", status: "active" } })]);
    renderPage();
    expect(await screen.findByText("Frontend Developer")).toBeInTheDocument();
  });

  it("renders the application status", async () => {
    mockPage([buildApplicationListRow({ status: "in_process" })]);
    renderPage();
    expect(await screen.findByText("In Process")).toBeInTheDocument();
  });

  it('shows "Not screened" for an unscreened applicant', async () => {
    mockPage([buildApplicationListRow({ screening: { status: "not_started", has_screening: false } })]);
    renderPage();
    expect(await screen.findByText("Not screened")).toBeInTheDocument();
  });

  it('shows "Screened" for a screened applicant', async () => {
    mockPage([buildApplicationListRow({ screening: { status: "completed", has_screening: true, latest_score: 63 } })]);
    renderPage();
    expect(await screen.findByText("Screened")).toBeInTheDocument();
  });

  it("displays the coverage percentage for a screened applicant", async () => {
    mockPage([buildApplicationListRow({ screening: { status: "completed", has_screening: true, latest_score: 63 } })]);
    renderPage();
    expect(await screen.findByText("63% Skill Coverage")).toBeInTheDocument();
  });

  it("never shows 0% for an unscreened applicant", async () => {
    mockPage([buildApplicationListRow({ screening: { status: "not_started", has_screening: false } })]);
    renderPage();
    await screen.findByText("Not screened");
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
  });

  // 33. Applications list shows screening state (processing/failed)
  it('shows "Processing" for an applicant whose initial screening is still running, with no score', async () => {
    mockPage([buildApplicationListRow({ screening: { status: "processing", has_screening: false } })]);
    renderPage();
    expect(await screen.findByText("Processing")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('shows "Needs attention" for an applicant whose initial screening failed', async () => {
    mockPage([buildApplicationListRow({ screening: { status: "failed", has_screening: false } })]);
    renderPage();
    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
  });

  it('shows "Interrupted" for an applicant whose initial screening stalled past the timeout', async () => {
    mockPage([buildApplicationListRow({ screening: { status: "stale_processing", has_screening: false } })]);
    renderPage();
    expect(await screen.findByText("Interrupted")).toBeInTheDocument();
  });

  it("navigates to the correct detail route when View Application is clicked", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow({ id: "application-42" })]);
    renderPage();

    await user.click(await screen.findByRole("link", { name: /view application/i }));

    expect(await screen.findByText("Application Detail Page")).toBeInTheDocument();
  });

  it("changes the API query when searching", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow()]);
    renderPage();
    await waitFor(() => expect(applicationsApi.getApplications).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(/search applicants/i), "sarah");

    await waitFor(() =>
      expect(applicationsApi.getApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "sarah" }),
        expect.anything()
      )
    );
  });

  it("changes the API query when filtering by status", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow()]);
    renderPage();
    await waitFor(() => expect(applicationsApi.getApplications).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "hired");

    await waitFor(() =>
      expect(applicationsApi.getApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "hired" }),
        expect.anything()
      )
    );
  });

  it("changes the API query when filtering by job", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    await user.selectOptions(screen.getByLabelText(/filter by job/i), "job-1");

    await waitFor(() =>
      expect(applicationsApi.getApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ jobId: "job-1" }),
        expect.anything()
      )
    );
  });

  it("supports pagination", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow()], { page: 1, totalPages: 3, total: 45 });
    renderPage();
    await screen.findByText("Page 1 of 3");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() =>
      expect(applicationsApi.getApplications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything())
    );
  });

  it("shows the unfiltered empty state when there are no applications at all", async () => {
    mockPage([], { total: 0, totalPages: 0 });
    renderPage();
    expect(await screen.findByText("No applications yet")).toBeInTheDocument();
  });

  it("shows the filtered empty state with a clear-filters action when a filter matches nothing", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    mockPage([], { total: 0, totalPages: 0 });
    await user.type(screen.getByLabelText(/search applicants/i), "no-such-person");

    expect(await screen.findByText("No applications match your filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
  });

  it("shows a safe error message on API failure", async () => {
    vi.mocked(applicationsApi.getApplications).mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText("Applications could not be loaded. Please try again.")).toBeInTheDocument();
  });

  it("shows a loading state before data arrives", async () => {
    let resolvePromise: (value: Awaited<ReturnType<typeof applicationsApi.getApplications>>) => void = () => {};
    vi.mocked(applicationsApi.getApplications).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    const { container } = renderPage();

    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    resolvePromise({ applications: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });
});
