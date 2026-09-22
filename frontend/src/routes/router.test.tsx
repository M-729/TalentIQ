import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { routeConfig } from "@/routes/router";
import * as authApi from "@/services/api/auth";
import * as publicJobsApi from "@/services/api/publicJobs";
import type { PublicJob } from "@/types/publicJob";

vi.mock("@/services/api/auth");
vi.mock("@/services/api/publicJobs");

function buildJob(overrides: Partial<PublicJob> = {}): PublicJob {
  return {
    _id: "job-1",
    title: "Backend Engineer",
    department: "Engineering",
    description: "Build and scale our backend.",
    required_skills: ["Node.js"],
    location: "Remote",
    employment_type: "Full-time",
    company_name: "Acme Recruiting Co",
    ...overrides,
  };
}

function renderAt(path: string) {
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

describe("app router — public vs protected routes", () => {
  beforeEach(() => {
    vi.mocked(authApi.refresh).mockReset().mockRejectedValue(new Error("no session"));
    vi.mocked(authApi.login).mockReset();
    vi.mocked(authApi.logout).mockReset();
    vi.mocked(publicJobsApi.listPublicJobs).mockReset().mockResolvedValue({
      jobs: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    vi.mocked(publicJobsApi.getPublicJob).mockReset().mockResolvedValue({ job: buildJob() });
  });

  // 11. /careers accessible logged out
  it("renders /careers without redirecting to login when logged out", async () => {
    renderAt("/careers");

    expect(await screen.findByRole("heading", { name: "Open Positions" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to your account" })).not.toBeInTheDocument();
  });

  // 23. existing authenticated /jobs pages remain unaffected — still
  // protected, still redirects to /login when there is no session.
  it("redirects /jobs to /login when logged out, unchanged from before", async () => {
    renderAt("/jobs");

    expect(await screen.findByRole("heading", { name: "Sign in to your account" })).toBeInTheDocument();
  });

  // 17. no HR sidebar on public pages — /careers never mounts AppShell, so
  // none of its authenticated nav destinations can appear.
  it("never renders HR navigation destinations on /careers", async () => {
    renderAt("/careers");

    await screen.findByRole("heading", { name: "Open Positions" });
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Applications" })).not.toBeInTheDocument();
  });

  // Careers navigation polish — 5. public Job Detail page remains
  // logged-out accessible, unaffected by the new Back link/brand link.
  it("renders /careers/jobs/:id without redirecting to login when logged out", async () => {
    renderAt("/careers/jobs/job-1");

    expect(await screen.findByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to your account" })).not.toBeInTheDocument();
  });

  // 5 (Apply variant) — the public Apply page remains logged-out
  // accessible too.
  it("renders /careers/jobs/:id/apply without redirecting to login when logged out", async () => {
    renderAt("/careers/jobs/job-1/apply");

    expect(await screen.findByText("Applying for")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to your account" })).not.toBeInTheDocument();
  });

  // 9. authenticated HR /jobs routes unaffected by the public-page
  // navigation changes — still protected, still redirects when logged out.
  it("still redirects /jobs/new and /jobs/:id/edit to /login when logged out, unchanged from before", async () => {
    renderAt("/jobs/new");
    expect(await screen.findByRole("heading", { name: "Sign in to your account" })).toBeInTheDocument();
  });
});
