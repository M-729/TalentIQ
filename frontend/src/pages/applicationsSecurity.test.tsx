import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationDetailPage } from "@/pages/ApplicationDetailPage";
import { ApplicationsPage } from "@/pages/ApplicationsPage";
import { buildApplicationDetail, buildApplicationListRow } from "@/test/fixtures";
import * as applicationsApi from "@/services/api/applications";
import * as jobsApi from "@/services/api/jobs";

vi.mock("@/services/api/applications");
vi.mock("@/services/api/jobs");

const FORBIDDEN_PHRASES = [
  "ai score",
  "candidate score",
  "hiring probability",
  "chance of hire",
  "suitability",
  "recommendation",
];

describe("Applications UI — safe language and no internal data leakage", () => {
  beforeEach(() => {
    vi.mocked(applicationsApi.getApplications).mockReset();
    vi.mocked(applicationsApi.getApplication).mockReset();
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({ jobs: [] });
  });

  it("Applications list never uses hiring-judgment language for the screening score", async () => {
    vi.mocked(applicationsApi.getApplications).mockResolvedValue({
      applications: [buildApplicationListRow({ screening: { status: "completed", has_screening: true, latest_score: 63 } })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/applications"]}>
        <Routes>
          <Route path="/applications" element={<ApplicationsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("63% Skill Coverage");

    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });

  it("Application detail never uses hiring-judgment language for the screening score", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ screening: { status: "completed", has_screening: true, latest_score: 63, latest_screened_at: "2024-01-01T00:00:00.000Z" } }),
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/applications/application-1"]}>
        <Routes>
          <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Sarah Ahmed" });

    const text = (container.textContent ?? "").toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text).not.toContain(phrase);
    }
  });

  it("never renders raw CV text, even if a malformed API response included it", async () => {
    const poisoned = {
      ...buildApplicationDetail(),
      cv: {
        ...buildApplicationDetail().cv,
        // Not a real field on ApplicationDetail's cv type — simulates a
        // hypothetical backend regression to prove the UI would still
        // never surface it, since components only ever read known fields.
        text: "Extracted CV text that must never render.",
      },
    } as ReturnType<typeof buildApplicationDetail>;
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({ application: poisoned });

    const { container } = render(
      <MemoryRouter initialEntries={["/applications/application-1"]}>
        <Routes>
          <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Sarah Ahmed" });

    expect(container.textContent).not.toContain("Extracted CV text that must never render.");
  });

  it("never renders secret/internal auth-shaped fields even if present in the API response", async () => {
    const poisoned = {
      ...buildApplicationDetail(),
      password_hash: "should-never-render",
      refresh_token: "should-never-render-either",
    } as ReturnType<typeof buildApplicationDetail>;
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({ application: poisoned });

    const { container } = render(
      <MemoryRouter initialEntries={["/applications/application-1"]}>
        <Routes>
          <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Sarah Ahmed" });

    expect(container.textContent).not.toContain("should-never-render");
    expect(container.textContent).not.toContain("should-never-render-either");
  });
});
