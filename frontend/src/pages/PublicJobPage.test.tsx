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
    public_id: "job-1-public",
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

  it("renders the job title as the page's single h1", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({ job: buildJob() });
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Backend Engineer" })).toBeInTheDocument();
  });

  it("renders required skills, compensation, and experience level in the summary panel", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({
      job: buildJob({ experience_level: "Senior", salary_min: 90000, salary_max: 120000 }),
    });
    renderPage();

    await screen.findByText("Backend Engineer");
    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
    expect(screen.getByText("$90,000 – $120,000")).toBeInTheDocument();
  });

  // The Apply CTA now lives inside the summary panel alongside the other
  // job facts, rather than floating alone beneath the whole page — this
  // pins that it's still a real, working link, not just present anywhere.
  it("places a working Apply link in the same summary panel as the other job facts", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({
      job: buildJob({ experience_level: "Senior" }),
    });
    renderPage();

    const applyLink = await screen.findByRole("link", { name: "Apply for this position" });
    expect(applyLink).toHaveAttribute("href", "/careers/jobs/job-1-public/apply");
    const panel = applyLink.closest('[data-slot="card"]') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel).toHaveTextContent("Senior");
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

  // Phase 1 opaque public ID migration: the Apply link must prefer
  // public_id over the raw Mongo _id once the backend provides one.
  it("builds the Apply link from public_id when present, not _id", async () => {
    vi.mocked(publicJobsApi.getPublicJob).mockResolvedValue({
      job: buildJob({ _id: "internal-object-id", public_id: "job_a8f13c92e51b4f638dde79bf" }),
    });
    renderPage();

    const applyLink = await screen.findByRole("link", { name: "Apply for this position" });
    expect(applyLink).toHaveAttribute("href", "/careers/jobs/job_a8f13c92e51b4f638dde79bf/apply");
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
