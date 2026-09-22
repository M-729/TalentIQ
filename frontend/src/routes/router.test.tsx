import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { routeConfig } from "@/routes/router";
import * as authApi from "@/services/api/auth";
import * as publicJobsApi from "@/services/api/publicJobs";

vi.mock("@/services/api/auth");
vi.mock("@/services/api/publicJobs");

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
});
