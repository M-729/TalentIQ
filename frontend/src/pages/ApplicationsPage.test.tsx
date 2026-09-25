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
        { _id: "job-1", public_id: "job-1", company_id: "c1", created_by: "u1", title: "Backend Developer", required_skills: [], status: "active", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-01T00:00:00.000Z" },
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

  it("labels the column header Pipeline Stage, not Status", async () => {
    mockPage([buildApplicationListRow()]);
    renderPage();
    expect(await screen.findByRole("columnheader", { name: "Pipeline Stage" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Status" })).not.toBeInTheDocument();
  });

  // 1. applied + no current step -> New Applicant
  it('shows "New Applicant" for an applied application with no current stage', async () => {
    mockPage([buildApplicationListRow({ status: "applied", current_step: null })]);
    renderPage();
    expect(await screen.findByText("New Applicant")).toBeInTheDocument();
  });

  // 2. in_process + Interview step -> actual stage name
  it("shows the actual HiringStep name for an in_process application in an interview-type stage", async () => {
    mockPage([
      buildApplicationListRow({
        status: "in_process",
        current_step: { id: "step-1", name: "Technical Interview", type: "interview" },
      }),
    ]);
    renderPage();
    expect(await screen.findByText("Technical Interview")).toBeInTheDocument();
  });

  // 3. in_process + Assessment step -> actual stage name
  it("shows the actual HiringStep name for an in_process application in an assessment-type stage", async () => {
    mockPage([
      buildApplicationListRow({
        status: "in_process",
        current_step: { id: "step-2", name: "External Assessment", type: "assessment" },
      }),
    ]);
    renderPage();
    expect(await screen.findByText("External Assessment")).toBeInTheDocument();
  });

  // Never hard-codes a stage name — an arbitrary HR-configured name renders as-is.
  it("never hard-codes a stage name — an arbitrary custom stage name renders as-is", async () => {
    mockPage([
      buildApplicationListRow({
        status: "in_process",
        current_step: { id: "step-3", name: "HR Review", type: "review" },
      }),
    ]);
    renderPage();
    expect(await screen.findByText("HR Review")).toBeInTheDocument();
  });

  // 4-6. rejected/offered/hired -> terminal lifecycle state wins over
  // whatever current_step happens to still be set.
  it.each([
    ["rejected", "Rejected"],
    ["offered", "Offered"],
    ["hired", "Hired"],
  ] as const)("shows %s as the pipeline stage for a %s application, even with a current_step set", async (status, label) => {
    mockPage([
      buildApplicationListRow({ status, current_step: { id: "step-4", name: "Final Interview", type: "interview" } }),
    ]);
    renderPage();
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByText("Final Interview")).not.toBeInTheDocument();
  });

  // 7. No N+1 stage requests — the pipeline stage comes back embedded in
  // the same list response; the frontend never issues a request per row.
  it("issues exactly one request for a page with several different pipeline stages", async () => {
    mockPage([
      buildApplicationListRow({ id: "a1", current_step: { id: "step-1", name: "Technical Interview", type: "interview" } }),
      buildApplicationListRow({ id: "a2", current_step: { id: "step-2", name: "External Assessment", type: "assessment" } }),
      buildApplicationListRow({ id: "a3", status: "applied", current_step: null }),
    ]);
    renderPage();
    await screen.findByText("Technical Interview");
    expect(applicationsApi.getApplications).toHaveBeenCalledTimes(1);
  });

  // 8. existing AI Screening column is unaffected by the pipeline-stage change.
  it("still renders the AI Screening column correctly alongside the new Pipeline Stage column", async () => {
    mockPage([
      buildApplicationListRow({
        status: "in_process",
        current_step: { id: "step-1", name: "Technical Interview", type: "interview" },
        screening: { status: "completed", has_screening: true, latest_score: 82 },
      }),
    ]);
    renderPage();
    expect(await screen.findByText("Technical Interview")).toBeInTheDocument();
    expect(screen.getByText("Screened")).toBeInTheDocument();
    expect(screen.getByText("82% Skill Coverage")).toBeInTheDocument();
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

  // Phase 1 opaque public ID migration: prefers public_id over the raw
  // Mongo _id (exposed here as `id`) once the backend provides one.
  it("links to the detail route using public_id when present, not id", async () => {
    mockPage([buildApplicationListRow({ id: "internal-object-id", public_id: "app_a8f13c92e51b4f638dde79bf" })]);
    renderPage();

    const link = await screen.findByRole("link", { name: /view application/i });
    expect(link).toHaveAttribute("href", "/applications/app_a8f13c92e51b4f638dde79bf");
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
    // Two Clear filters buttons legitimately exist now — one next to the
    // filter bar itself (visible even before results go to zero), one in
    // the empty state — both call the same clearFilters().
    expect(screen.getAllByRole("button", { name: /clear filters/i }).length).toBeGreaterThan(0);
  });

  // Phase 5 — active filter feedback: Clear filters must be reachable from
  // the filter row itself, not only once a filter happens to zero out the
  // results.
  it("shows a Clear filters action next to the filter bar as soon as a filter is active, even with results still showing", async () => {
    const user = userEvent.setup();
    mockPage([buildApplicationListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/search applicants/i), "sarah");
    await screen.findByRole("button", { name: /clear filters/i });
    // Results are still showing (not the empty state) while the button is present.
    expect(screen.getByText("Sarah Ahmed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByLabelText(/search applicants/i)).toHaveValue("");
    // hasActiveFilters is derived from the debounced search value, so the
    // button's disappearance lags the input clearing by the debounce delay.
    await waitFor(() => expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument());
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
