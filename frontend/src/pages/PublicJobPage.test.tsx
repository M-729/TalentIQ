import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PublicJobPage } from "@/pages/PublicJobPage";
import * as publicJobsApi from "@/services/api/publicJobs";
import type { PublicJob } from "@/types/publicJob";

vi.mock("@/services/api/publicJobs");

function buildJob(overrides: Partial<PublicJob> = {}): PublicJob {
  return {
    _id: "job-1",
    title: "Backend Engineer",
    department: "Engineering",
    description: "Build and scale our backend.",
    required_skills: ["Node.js", "TypeScript"],
    location: "Remote",
    employment_type: "Full-time",
    company_name: "Acme Recruiting Co",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/careers/jobs/job-1"]}>
      <Routes>
        <Route path="/careers" element={<div>Careers List Page</div>} />
        <Route path="/careers/jobs/:id" element={<PublicJobPage />} />
        <Route path="/careers/jobs/:id/apply" element={<div>Apply Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PublicJobPage (existing public Job detail)", () => {
  beforeEach(() => {
    vi.mocked(publicJobsApi.getPublicJob).mockReset();
  });

  // 15. /careers/:jobId (here: /careers/jobs/:id) renders
  it("renders the job's public details", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme Recruiting Co")).toBeInTheDocument();
    expect(screen.getByText("Build and scale our backend.")).toBeInTheDocument();
  });

  // 16. Apply workflow reachable without typing IDs manually
  it("navigates to the existing Apply flow via a click, with no manual URL/id entry", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    await userEvent.click(await screen.findByRole("link", { name: "Apply for this position" }));

    expect(await screen.findByText("Apply Page")).toBeInTheDocument();
  });

  it("shows a candidate-friendly unavailable state for a job that is not found/closed", async () => {
    const { ApiError } = await import("@/services/api/client");
    vi.mocked(publicJobsApi.getPublicJob).mockRejectedValue(new ApiError("Job not found", 404));
    renderPage();

    expect(await screen.findByText("Job not available")).toBeInTheDocument();
  });

  // Careers navigation polish: 1. shows "Back to open positions"
  it('shows a "Back to open positions" link', async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    expect(await screen.findByRole("link", { name: "Back to open positions" })).toBeInTheDocument();
  });

  // 2. it targets /careers
  it('the "Back to open positions" link targets /careers', async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const backLink = await screen.findByRole("link", { name: "Back to open positions" });
    expect(backLink).toHaveAttribute("href", "/careers");
  });

  // 3. TalentIQ brand/logo targets /careers
  it("the TalentIQ brand link targets /careers", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const brandLink = await screen.findByRole("link", { name: /TalentIQ/ });
    expect(brandLink).toHaveAttribute("href", "/careers");
  });

  // 10. keyboard-accessible: the Back link is a real, focusable,
  // Enter-activatable anchor, not a click-only handler.
  it("navigates to /careers when the Back link is activated via the keyboard", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const backLink = await screen.findByRole("link", { name: "Back to open positions" });
    backLink.focus();
    expect(backLink).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Careers List Page")).toBeInTheDocument();
  });

  // Recruiter login correction: 3. Job Detail also shows it
  it('shows a "Recruiter login" link targeting /login, alongside the Back link', async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const recruiterLoginLink = await screen.findByRole("link", { name: "Recruiter login" });
    expect(recruiterLoginLink).toHaveAttribute("href", "/login");
    // 6. existing Back link remains correct alongside it.
    expect(screen.getByRole("link", { name: "Back to open positions" })).toHaveAttribute("href", "/careers");
  });

  // 7. keyboard accessible
  it("navigates to /login when Recruiter login is activated via the keyboard", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const recruiterLoginLink = await screen.findByRole("link", { name: "Recruiter login" });
    recruiterLoginLink.focus();
    expect(recruiterLoginLink).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });
});
