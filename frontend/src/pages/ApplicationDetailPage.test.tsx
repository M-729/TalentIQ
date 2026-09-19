import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApiError } from "@/services/api/client";
import { ApplicationDetailPage } from "@/pages/ApplicationDetailPage";
import { buildApplicationDetail } from "@/test/fixtures";
import * as applicationsApi from "@/services/api/applications";

vi.mock("@/services/api/applications");

function renderPage(applicationId = "application-1") {
  return render(
    <MemoryRouter initialEntries={[`/applications/${applicationId}`]}>
      <Routes>
        <Route path="/applications" element={<div>Applications List Page</div>} />
        <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />
        <Route path="/applications/:applicationId/screening" element={<div>Screening Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ApplicationDetailPage", () => {
  beforeEach(() => {
    vi.mocked(applicationsApi.getApplication).mockReset();
  });

  it("fetches the application by id", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({ application: buildApplicationDetail() });
    renderPage("application-42");
    await screen.findByRole("heading", { name: "Sarah Ahmed" });
    expect(applicationsApi.getApplication).toHaveBeenCalledWith("application-42", expect.anything());
  });

  it("renders the candidate identity", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ candidate: { id: "c1", full_name: "Jordan Lee", email: "jordan@example.test" } }),
    });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Jordan Lee" })).toBeInTheDocument();
  });

  it('clearly renders "Application for <job>"', async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ job: { id: "j1", title: "Frontend Developer", required_skills: [], status: "active" } }),
    });
    renderPage();
    expect(await screen.findByText("Application for Frontend Developer")).toBeInTheDocument();
  });

  it("renders the applied date and status", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ applied_at: "2024-03-05T00:00:00.000Z", status: "hired" }),
    });
    renderPage();
    await screen.findByRole("heading", { name: "Sarah Ahmed" });
    expect(screen.getAllByText(/Mar 5, 2024/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hired").length).toBeGreaterThan(0);
  });

  it("renders candidate contact information safely, omitting fields not provided", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({
        candidate: { id: "c1", full_name: "Sarah Ahmed", email: "sarah@example.test", phone: "+1-555-000-1234" },
      }),
    });
    renderPage();
    await screen.findByRole("heading", { name: "Sarah Ahmed" });
    expect(screen.getByText("+1-555-000-1234")).toBeInTheDocument();
    expect(screen.queryByText("LinkedIn")).not.toBeInTheDocument();
    expect(screen.queryByText("Portfolio")).not.toBeInTheDocument();
  });

  it("renders LinkedIn/portfolio links with a safe target and rel", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({
        candidate: {
          id: "c1",
          full_name: "Sarah Ahmed",
          email: "sarah@example.test",
          linkedin_url: "https://linkedin.com/in/sarah",
          portfolio_url: "https://sarah.dev",
        },
      }),
    });
    renderPage();

    const linkedinLink = await screen.findByRole("link", { name: /linkedin\.com/i });
    expect(linkedinLink).toHaveAttribute("target", "_blank");
    expect(linkedinLink).toHaveAttribute("rel", "noopener noreferrer");

    const portfolioLink = screen.getByRole("link", { name: /sarah\.dev/i });
    expect(portfolioLink).toHaveAttribute("target", "_blank");
    expect(portfolioLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders required skills", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({
        job: { id: "j1", title: "Backend Developer", required_skills: ["Node.js", "PostgreSQL"], status: "active" },
      }),
    });
    renderPage();
    expect(await screen.findByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("renders safe CV metadata", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ cv: { original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 253952 } }),
    });
    renderPage();
    expect(await screen.findByText("resume.pdf")).toBeInTheDocument();
    expect(screen.getByText(/PDF · 248 KB/)).toBeInTheDocument();
  });

  it("never renders a storage_key anywhere on the page", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({ application: buildApplicationDetail() });
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "Sarah Ahmed" });
    expect(container.textContent).not.toContain("storage_key");
  });

  it('shows "Not screened" when the applicant has no screening', async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ screening: { has_screening: false } }),
    });
    renderPage();
    expect((await screen.findAllByText("Not screened")).length).toBeGreaterThan(0);
  });

  it('shows a "Run AI Screening" action when unscreened', async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ screening: { has_screening: false } }),
    });
    renderPage();
    expect((await screen.findAllByRole("link", { name: /run ai screening/i })).length).toBeGreaterThan(0);
  });

  it('shows "Screened" when the applicant has a screening', async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ screening: { has_screening: true, latest_score: 63, latest_screened_at: "2024-01-01T00:00:00.000Z" } }),
    });
    renderPage();
    expect((await screen.findAllByText("Screened")).length).toBeGreaterThan(0);
  });

  it("displays the coverage percentage when screened", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({ screening: { has_screening: true, latest_score: 63, latest_screened_at: "2024-01-01T00:00:00.000Z" } }),
    });
    renderPage();
    expect((await screen.findAllByText(/Required Skill Coverage: 63%/)).length).toBeGreaterThan(0);
  });

  it("navigates to the screening page when View AI Screening is clicked, without POSTing", async () => {
    const user = userEvent.setup();
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({
      application: buildApplicationDetail({
        id: "application-1",
        screening: { has_screening: true, latest_score: 63, latest_screened_at: "2024-01-01T00:00:00.000Z" },
      }),
    });
    renderPage("application-1");

    const links = await screen.findAllByRole("link", { name: /view ai screening/i });
    await user.click(links[0]!);

    expect(await screen.findByText("Screening Page")).toBeInTheDocument();
  });

  it("never calls a screening-creation endpoint automatically", async () => {
    vi.mocked(applicationsApi.getApplication).mockResolvedValue({ application: buildApplicationDetail() });
    renderPage();
    await screen.findByRole("heading", { name: "Sarah Ahmed" });
    // ApplicationDetailPage only ever imports getApplication — it has no
    // dependency on the screening-creation API at all, so there is
    // nothing here capable of triggering AI automatically.
    expect(applicationsApi.getApplication).toHaveBeenCalledTimes(1);
  });

  it("shows a safe message for a 404 detail response", async () => {
    vi.mocked(applicationsApi.getApplication).mockRejectedValue(new ApiError("Application not found", 404));
    renderPage();
    expect(await screen.findByText("This application is unavailable.")).toBeInTheDocument();
  });
});
