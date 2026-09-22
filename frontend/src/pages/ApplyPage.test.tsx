import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplyPage } from "@/pages/ApplyPage";
import * as publicJobsApi from "@/services/api/publicJobs";
import type { PublicJob } from "@/types/publicJob";

vi.mock("@/services/api/publicJobs");
vi.mock("@/services/api/applications");

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

function renderPage(jobId = "job-1") {
  return render(
    <MemoryRouter initialEntries={[`/careers/jobs/${jobId}/apply`]}>
      <Routes>
        <Route path="/careers" element={<div>Careers List Page</div>} />
        <Route path="/careers/jobs/:id" element={<div>Job Detail Page</div>} />
        <Route path="/careers/jobs/:id/apply" element={<ApplyPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ApplyPage (public application form)", () => {
  beforeEach(() => {
    vi.mocked(publicJobsApi.getPublicJob).mockReset();
  });

  it("renders the application form for the job", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    expect(await screen.findByText("Applying for")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
  });

  // 6. Apply page has a "Back to job details" navigation link
  it('shows a "Back to job details" link', async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    expect(await screen.findByRole("link", { name: "Back to job details" })).toBeInTheDocument();
  });

  // 7. Back to job details targets the correct Job
  it("the back link targets this exact job's detail page, not a generic one", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob({ _id: "job-42" }) });
    renderPage("job-42");

    const backLink = await screen.findByRole("link", { name: "Back to job details" });
    expect(backLink).toHaveAttribute("href", "/careers/jobs/job-42");
  });

  it("navigates to the Job Detail page when the back link is clicked", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    await userEvent.click(await screen.findByRole("link", { name: "Back to job details" }));
    expect(await screen.findByText("Job Detail Page")).toBeInTheDocument();
  });

  // 3. TalentIQ brand/logo targets /careers, consistently on this page too
  it("the TalentIQ brand link targets /careers", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const brandLink = await screen.findByRole("link", { name: /TalentIQ/ });
    expect(brandLink).toHaveAttribute("href", "/careers");
  });

  // 10. keyboard-accessible: the back link is a real, focusable,
  // Enter-activatable anchor.
  it("navigates to the Job Detail page when the back link is activated via the keyboard", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const backLink = await screen.findByRole("link", { name: "Back to job details" });
    backLink.focus();
    expect(backLink).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByText("Job Detail Page")).toBeInTheDocument();
  });

  // Recruiter login correction: 4. Apply page also shows it
  it('shows a "Recruiter login" link targeting /login, alongside the Back link', async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    const recruiterLoginLink = await screen.findByRole("link", { name: "Recruiter login" });
    expect(recruiterLoginLink).toHaveAttribute("href", "/login");
    // 6. existing Back link remains correct alongside it.
    expect(screen.getByRole("link", { name: "Back to job details" })).toHaveAttribute("href", "/careers/jobs/job-1");
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

  it("does not disrupt the application form fields (name/email still present alongside the back link)", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    await screen.findByRole("link", { name: "Back to job details" });
    expect(screen.getByLabelText(/Full Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Application" })).toBeInTheDocument();
  });

  it("shows a candidate-friendly unavailable state for a job that is not found/closed", async () => {
    const { ApiError } = await import("@/services/api/client");
    vi.mocked(publicJobsApi.getPublicJob).mockRejectedValue(new ApiError("Job not found", 404));
    renderPage();

    expect(await screen.findByText("Job not available")).toBeInTheDocument();
  });
});
