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
        <Route path="/careers/jobs/:id" element={<PublicJobPage />} />
        <Route path="/careers/jobs/:id/apply" element={<div>Apply Page</div>} />
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
});
