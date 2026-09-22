import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicJobLinkAction } from "@/components/jobs/PublicJobLinkAction";
import type { Job } from "@/types/job";

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

describe("PublicJobLinkAction", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("shows View Public Job and Copy Public Link for an active job", () => {
    render(<PublicJobLinkAction job={buildJob({ status: "active" })} />);

    const viewLink = screen.getByRole("link", { name: "View Public Job" });
    expect(viewLink).toHaveAttribute("href", "/careers/jobs/job-1");
    expect(screen.getByRole("button", { name: "Copy Public Link" })).toBeInTheDocument();
  });

  it("copies the full public URL to the clipboard", async () => {
    render(<PublicJobLinkAction job={buildJob({ _id: "job-42", status: "active" })} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy Public Link" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/careers/jobs/job-42`);
    expect(await screen.findByRole("button", { name: "Link copied!" })).toBeInTheDocument();
  });

  it("does not show a public link for a draft job, and explains why", () => {
    render(<PublicJobLinkAction job={buildJob({ status: "draft" })} />);

    expect(screen.queryByRole("link", { name: "View Public Job" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Public Link" })).not.toBeInTheDocument();
    expect(screen.getByText(/still a draft/)).toBeInTheDocument();
  });

  it("does not show a public link for a closed job, and explains why", () => {
    render(<PublicJobLinkAction job={buildJob({ status: "closed" })} />);

    expect(screen.queryByRole("link", { name: "View Public Job" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Public Link" })).not.toBeInTheDocument();
    expect(screen.getByText(/no longer publicly visible/)).toBeInTheDocument();
  });
});
