import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CareersPage } from "@/pages/CareersPage";
import { ApiError } from "@/services/api/client";
import * as publicJobsApi from "@/services/api/publicJobs";
import type { Pagination, PublicJob } from "@/types/publicJob";

vi.mock("@/services/api/publicJobs");

function buildJob(overrides: Partial<PublicJob> = {}): PublicJob {
  return {
    _id: "job-1",
    public_id: "job-1-public",
    title: "Backend Engineer",
    department: "Engineering",
    description: "Build and scale our backend services.",
    required_skills: ["Node.js"],
    location: "Remote",
    employment_type: "Full-time",
    company_name: "Acme Recruiting Co",
    ...overrides,
  };
}

function buildPagination(overrides: Partial<Pagination> = {}): Pagination {
  return { page: 1, limit: 20, total: 1, totalPages: 1, ...overrides };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/careers"]}>
      <Routes>
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/careers/jobs/:id" element={<div>Job Detail Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("CareersPage", () => {
  beforeEach(() => {
    vi.mocked(publicJobsApi.listPublicJobs).mockReset();
  });

  it("renders the header and intro copy", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    expect(await screen.findByRole("heading", { name: "Open Positions" })).toBeInTheDocument();
    expect(screen.getByText("Explore current opportunities and apply online.")).toBeInTheDocument();
    // The brand mark's wordmark is two colored spans ("Talent" + "IQ"), not
    // one text node — asserted via its accessible link name, same pattern
    // already used by the "brand link targets /careers" test below.
    expect(screen.getByRole("link", { name: /TalentIQ/ })).toBeInTheDocument();
  });

  // Careers navigation polish: 3. TalentIQ brand/logo targets /careers
  // (even on /careers itself, for consistency across every public page).
  it("the TalentIQ brand link targets /careers", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    const brandLink = await screen.findByRole("link", { name: /TalentIQ/ });
    expect(brandLink).toHaveAttribute("href", "/careers");
  });

  // Recruiter login correction: 1. /careers shows "Recruiter login"
  it('shows a "Recruiter login" link', async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    expect(await screen.findByRole("link", { name: "Recruiter login" })).toBeInTheDocument();
  });

  // 2. Recruiter login targets /login
  it('the "Recruiter login" link targets /login', async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    const recruiterLoginLink = await screen.findByRole("link", { name: "Recruiter login" });
    expect(recruiterLoginLink).toHaveAttribute("href", "/login");
  });

  // 7. keyboard accessible
  it("navigates to /login when Recruiter login is activated via the keyboard", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    const recruiterLoginLink = await screen.findByRole("link", { name: "Recruiter login" });
    recruiterLoginLink.focus();
    expect(recruiterLoginLink).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  // 12. public Jobs render
  it("renders public jobs returned by the API", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({
      jobs: [buildJob({ title: "Senior Backend Engineer" })],
      pagination: buildPagination(),
    });
    renderPage();

    expect(await screen.findByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme Recruiting Co")).toBeInTheDocument();
  });

  // 13. candidate can search
  it("sends a debounced search request as the candidate types a job title", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    await screen.findByRole("heading", { name: "Open Positions" });
    vi.mocked(publicJobsApi.listPublicJobs).mockClear();

    await userEvent.type(screen.getByLabelText("Search by job title"), "engineer");

    await waitFor(() => expect(publicJobsApi.listPublicJobs).toHaveBeenCalled());
    const [filters] = vi.mocked(publicJobsApi.listPublicJobs).mock.calls.at(-1)!;
    expect(filters.search).toBe("engineer");
  });

  it("supports filtering by location", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    await screen.findByRole("heading", { name: "Open Positions" });
    vi.mocked(publicJobsApi.listPublicJobs).mockClear();

    await userEvent.type(screen.getByLabelText("Location"), "Beirut");

    await waitFor(() => expect(publicJobsApi.listPublicJobs).toHaveBeenCalled());
    const [filters] = vi.mocked(publicJobsApi.listPublicJobs).mock.calls.at(-1)!;
    expect(filters.location).toBe("Beirut");
  });

  // 14. Job card navigates to detail
  it("navigates to the Job detail page when a job is opened", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({
      jobs: [buildJob({ _id: "job-42", title: "Product Designer" })],
      pagination: buildPagination(),
    });
    renderPage();

    await userEvent.click(await screen.findByRole("link", { name: "View Job" }));

    expect(await screen.findByText("Job Detail Page")).toBeInTheDocument();
  });

  // Phase 1 opaque public ID migration: Careers links must prefer public_id
  // over the raw Mongo _id once the backend provides one.
  it("links to the Job detail page using public_id when present, not _id", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({
      jobs: [buildJob({ _id: "internal-object-id", public_id: "job_a8f13c92e51b4f638dde79bf" })],
      pagination: buildPagination(),
    });
    renderPage();

    const jobLink = await screen.findByRole("link", { name: "Backend Engineer" });
    expect(jobLink).toHaveAttribute("href", "/careers/jobs/job_a8f13c92e51b4f638dde79bf");
    expect(screen.getByRole("link", { name: "View Job" })).toHaveAttribute(
      "href",
      "/careers/jobs/job_a8f13c92e51b4f638dde79bf"
    );
  });

  // 18. empty state
  it("shows the empty state when there are no open positions at all", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    expect(await screen.findByText("No open positions are available right now.")).toBeInTheDocument();
  });

  // 19. no-results state
  it("shows a distinct no-results message when a search matches nothing", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockResolvedValue({ jobs: [], pagination: buildPagination({ total: 0, totalPages: 0 }) });
    renderPage();

    await screen.findByText("No open positions are available right now.");
    await userEvent.type(screen.getByLabelText("Search by job title"), "zzz-nonexistent");

    expect(await screen.findByText("No positions match your search.")).toBeInTheDocument();
  });

  // 20. error state
  it("shows a safe, retryable error message, never a raw backend message, on failure", async () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockRejectedValue(new ApiError("raw db connection error", 500));
    renderPage();

    expect(await screen.findByText("Open positions could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db connection error/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a loading state before results arrive", () => {
    vi.mocked(publicJobsApi.listPublicJobs).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("heading", { name: "Open Positions" })).toBeInTheDocument();
    expect(screen.queryByText("No open positions are available right now.")).not.toBeInTheDocument();
  });
});
