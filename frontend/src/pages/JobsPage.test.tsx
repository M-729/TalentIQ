import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { JobsPage } from "@/pages/JobsPage";
import * as jobsApi from "@/services/api/jobs";
import { ApiError } from "@/services/api/client";
import type { Job } from "@/types/job";

vi.mock("@/services/api/jobs");

function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    _id: "job-1",
    company_id: "company-1",
    created_by: "user-1",
    title: "Backend Engineer",
    required_skills: [],
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>
  );
}

describe("JobsPage", () => {
  beforeEach(() => {
    vi.mocked(jobsApi.listJobs).mockReset();
  });

  it("renders the page title and the table once jobs load", async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({ jobs: [buildJob()] });
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Jobs" })).toBeInTheDocument();
    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
  });

  it("shows loading skeletons before jobs resolve", () => {
    vi.mocked(jobsApi.listJobs).mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("marks the active status tab with aria-pressed and a non-color (font-weight) indicator", async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({ jobs: [buildJob()] });
    renderPage();
    await screen.findByText("Backend Engineer");

    const allTab = screen.getByRole("button", { name: /All/ });
    const activeTab = screen.getByRole("button", { name: /Active/ });
    expect(allTab).toHaveAttribute("aria-pressed", "true");
    expect(allTab).toHaveClass("font-semibold");
    expect(activeTab).toHaveAttribute("aria-pressed", "false");
    expect(activeTab).toHaveClass("font-medium");
  });

  it("switches the active tab on click", async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({ jobs: [buildJob()] });
    renderPage();
    await screen.findByText("Backend Engineer");

    await userEvent.click(screen.getByRole("button", { name: /Draft/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Draft/ })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("button", { name: /All/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a Create Job action in the empty state when there is no filter applied", async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({ jobs: [] });
    renderPage();

    expect(await screen.findByText("No jobs yet")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Create Job" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/jobs/new");
  });

  it("does not show a Create Job action in the empty state when a filter is applied", async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({ jobs: [buildJob()] });
    renderPage();
    await screen.findByText("Backend Engineer");

    vi.mocked(jobsApi.listJobs).mockResolvedValue({ jobs: [] });
    await userEvent.click(screen.getByRole("button", { name: /Draft/ }));

    expect(await screen.findByText("No jobs match this filter")).toBeInTheDocument();
    // The PageHeader's own Create Job button is still present — only the
    // second, empty-state one must be absent when filtered.
    expect(screen.getAllByRole("link", { name: "Create Job" })).toHaveLength(1);
  });

  it("shows a safe error message with retry", async () => {
    vi.mocked(jobsApi.listJobs).mockRejectedValue(new ApiError("Failed to load jobs. Please try again.", 500));
    renderPage();

    // Both the stats block and the table block independently fetch via
    // useJobs(), so a shared failure legitimately renders "Couldn't load
    // jobs" (and its own Retry button) twice on this page.
    expect((await screen.findAllByText("Couldn't load jobs")).length).toBeGreaterThan(0);
    const retryButtons = screen.getAllByRole("button", { name: "Retry" });
    expect(retryButtons.length).toBeGreaterThan(0);
  });
});
