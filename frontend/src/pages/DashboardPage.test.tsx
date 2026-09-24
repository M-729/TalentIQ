import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import * as useAuthModule from "@/hooks/useAuth";
import * as useDashboardModule from "@/hooks/useDashboard";
import type { Dashboard } from "@/types/dashboard";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useDashboard");

function mockAuth() {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: "u1", name: "Mohamad Ali", email: "a@acme.test", role: "ADMIN", status: "active", companyId: "c1" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    hydrateSession: vi.fn(),
    logout: vi.fn(),
  });
}

function buildDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    metrics: { open_jobs: 3, new_applicants: 5, upcoming_interviews: 2, pending_offers: 1, hired: 4 },
    recent_applications: [
      {
        id: "app-1",
        candidate: { id: "cand-1", name: "Sarah Ahmed" },
        job: { id: "job-1", title: "Backend Developer" },
        status: "applied",
        current_step: null,
        applied_at: "2026-09-20T00:00:00.000Z",
      },
    ],
    upcoming_interviews: [
      {
        id: "iv-1",
        application_id: "app-1",
        candidate: { id: "cand-1", name: "Sarah Ahmed" },
        job: { id: "job-1", title: "Backend Developer" },
        starts_at: "2026-10-01T10:00:00.000Z",
        timezone: "UTC",
        status: "scheduled",
      },
    ],
    attention: {
      failed_emails: 0,
      assessments_awaiting_result: 0,
      interviews_awaiting_feedback: 0,
      offers_awaiting_response: 0,
      offers_expiring_soon: 0,
    },
    ...overrides,
  };
}

function mockDashboard(overrides: Partial<ReturnType<typeof useDashboardModule.useDashboard>> = {}) {
  vi.mocked(useDashboardModule.useDashboard).mockReturnValue({
    dashboard: buildDashboard(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    mockAuth();
  });

  // 12. dashboard real metrics render
  it("12. renders real metric values from the API, not placeholders", () => {
    mockDashboard();
    renderPage();

    expect(screen.getByText("Open Jobs")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("New Applicants")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  // 13. recent applications render
  it("13. renders recent applications", () => {
    mockDashboard();
    renderPage();

    expect(screen.getAllByText("Sarah Ahmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Backend Developer").length).toBeGreaterThan(0);
    expect(screen.getByText("New Applicant")).toBeInTheDocument();
  });

  // 14. upcoming interviews render
  it("14. renders upcoming interviews", () => {
    mockDashboard();
    renderPage();

    const interviewsSection = screen.getByText("Upcoming Interviews").closest("div")!.parentElement!;
    expect(interviewsSection).toBeTruthy();
    expect(screen.getAllByText("Sarah Ahmed").length).toBeGreaterThan(0);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
  });

  // dashboard.service.ts's own query is status: "scheduled", so this is
  // "scheduled" in production today — but the row itself carries a real
  // status field (not a hardcoded label), so the badge must reflect
  // whatever value the API actually returns, reusing the same
  // Scheduled/Completed/Cancelled semantics as the Interview detail pages.
  it("renders the interview row's real status rather than a hardcoded label", () => {
    mockDashboard({
      dashboard: buildDashboard({
        upcoming_interviews: [
          {
            id: "iv-1",
            application_id: "app-1",
            candidate: { id: "cand-1", name: "Sarah Ahmed" },
            job: { id: "job-1", title: "Backend Developer" },
            starts_at: "2026-10-01T10:00:00.000Z",
            timezone: "UTC",
            status: "completed",
          },
        ],
      }),
    });
    renderPage();

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled")).not.toBeInTheDocument();
  });

  // 15. attention states render
  it("15. renders a Needs Attention item when a count is non-zero", () => {
    mockDashboard({
      dashboard: buildDashboard({
        attention: {
          failed_emails: 2,
          assessments_awaiting_result: 0,
          interviews_awaiting_feedback: 0,
          offers_awaiting_response: 0,
          offers_expiring_soon: 0,
        },
      }),
    });
    renderPage();

    const attentionItem = screen.getByText(/failed email\(s\) need attention/);
    expect(attentionItem).toBeInTheDocument();
    expect(attentionItem.closest("li")).toHaveTextContent("2 failed email(s) need attention");
  });

  it("15. shows a caught-up message when every attention count is zero", () => {
    mockDashboard();
    renderPage();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  // 16. empty-company CTA
  it("16. shows the empty-company welcome state with a Create Job link", () => {
    mockDashboard({
      dashboard: buildDashboard({
        metrics: { open_jobs: 0, new_applicants: 0, upcoming_interviews: 0, pending_offers: 0, hired: 0 },
        recent_applications: [],
        upcoming_interviews: [],
      }),
    });
    renderPage();

    expect(screen.getByText("Welcome to TalentIQ")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Create Job" });
    expect(link).toHaveAttribute("href", "/jobs/new");
  });

  // 17. loading/error states
  it("17. shows a loading state", () => {
    mockDashboard({ dashboard: null, isLoading: true });
    renderPage();
    expect(screen.queryByText("Open Jobs")).not.toBeInTheDocument();
  });

  it("17. shows an error state with retry", () => {
    const refetch = vi.fn();
    mockDashboard({ dashboard: null, isLoading: false, error: "Something went wrong", refetch });
    renderPage();

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(refetch).toHaveBeenCalled();
  });

  // 18. links navigate correctly
  it("18. the recent application row links to its Application Detail page", () => {
    mockDashboard();
    renderPage();

    const links = screen.getAllByRole("link", { name: "View" });
    expect(links.some((link) => link.getAttribute("href") === "/applications/app-1")).toBe(true);
  });
});
