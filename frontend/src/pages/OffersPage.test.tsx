import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OffersPage } from "@/pages/OffersPage";
import { buildOfferListRow } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as offersApi from "@/services/api/offers";
import * as jobsApi from "@/services/api/jobs";

vi.mock("@/services/api/offers");
vi.mock("@/services/api/jobs");

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/offers"]}>
      <Routes>
        <Route path="/offers" element={<OffersPage />} />
        <Route path="/applications/:applicationId" element={<div>Application Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockPage(offers: ReturnType<typeof buildOfferListRow>[], overrides: Partial<{ page: number; limit: number; total: number; totalPages: number }> = {}) {
  vi.mocked(offersApi.listOffers).mockResolvedValue({
    offers,
    pagination: { page: 1, limit: 20, total: offers.length, totalPages: 1, ...overrides },
  });
}

describe("OffersPage", () => {
  beforeEach(() => {
    vi.mocked(offersApi.listOffers).mockReset();
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({
      jobs: [
        { _id: "job-1", public_id: "job-1", company_id: "c1", created_by: "u1", title: "Backend Developer", required_skills: [], status: "active", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-01T00:00:00.000Z" },
      ],
    });
  });

  // 16. list renders
  it("fetches and renders offers on mount", async () => {
    mockPage([buildOfferListRow()]);
    renderPage();
    await waitFor(() => expect(offersApi.listOffers).toHaveBeenCalled());
    expect(await screen.findByText("Sarah Ahmed")).toBeInTheDocument();
  });

  it("displays candidate, job, offer title, status, salary, dates, and the Action column", async () => {
    mockPage([
      buildOfferListRow({
        candidate: { id: "c1", full_name: "Ahmad Khalil", email: "ahmad@candidate.test" },
        job: { id: "job-1", title: "Backend Developer" },
        title: "Backend Engineer Offer",
        status: "sent",
        salary_amount: 95000,
        salary_currency: "USD",
        start_date: "2026-10-01T00:00:00.000Z",
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Ahmad Khalil")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Backend Developer")).toBeInTheDocument();
    expect(table.getByText("Backend Engineer Offer")).toBeInTheDocument();
    const row = screen.getAllByRole("row")[1]!;
    const statusCell = within(row).getAllByRole("cell")[3]!;
    expect(within(statusCell).getByText("Sent")).toBeInTheDocument();
    expect(table.getByText("95,000 USD")).toBeInTheDocument();
    expect(table.getByRole("link", { name: /view application/i })).toBeInTheDocument();
  });

  // 19. salary formatting
  it('shows "—" for salary when absent', async () => {
    mockPage([buildOfferListRow({ salary_amount: null, salary_currency: null })]);
    renderPage();
    await screen.findByText("Sarah Ahmed");
    const table = within(screen.getByRole("table"));
    expect(table.getAllByText("—").length).toBeGreaterThan(0);
  });

  // 20. statuses
  it.each(["draft", "sent", "accepted", "declined", "withdrawn"] as const)("renders the %s status", async (status) => {
    mockPage([buildOfferListRow({ status })]);
    renderPage();
    await screen.findByText("Sarah Ahmed");
    const row = screen.getAllByRole("row")[1]!;
    const statusCell = within(row).getAllByRole("cell")[3]!;
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    expect(within(statusCell).getByText(label)).toBeInTheDocument();
  });

  // 17. filters
  it("changes the API query when filtering by job", async () => {
    const user = userEvent.setup();
    mockPage([buildOfferListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    await user.selectOptions(screen.getByLabelText(/filter by job/i), "job-1");

    await waitFor(() => expect(offersApi.listOffers).toHaveBeenLastCalledWith(expect.objectContaining({ jobId: "job-1" }), expect.anything()));
  });

  it("changes the API query when filtering by offer status", async () => {
    const user = userEvent.setup();
    mockPage([buildOfferListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    await user.selectOptions(screen.getByLabelText(/filter by offer status/i), "accepted");

    await waitFor(() => expect(offersApi.listOffers).toHaveBeenLastCalledWith(expect.objectContaining({ status: "accepted" }), expect.anything()));
  });

  // 18. search
  it("changes the API query when searching", async () => {
    const user = userEvent.setup();
    mockPage([buildOfferListRow()]);
    renderPage();
    await waitFor(() => expect(offersApi.listOffers).toHaveBeenCalledTimes(1));

    await user.type(screen.getByLabelText(/search offers/i), "ahmad");

    await waitFor(() => expect(offersApi.listOffers).toHaveBeenLastCalledWith(expect.objectContaining({ search: "ahmad" }), expect.anything()));
  });

  // 21. View Application
  it("navigates to the correct Application detail route when View Application is clicked", async () => {
    const user = userEvent.setup();
    mockPage([buildOfferListRow({ application_id: "application-42" })]);
    renderPage();

    await user.click(await screen.findByRole("link", { name: /view application/i }));

    expect(await screen.findByText("Application Detail Page")).toBeInTheDocument();
  });

  // Phase 1 opaque public ID migration: prefers the owning Application's
  // public_id over its raw Mongo _id once the backend provides one.
  it("links to the Application detail route using application_public_id when present, not application_id", async () => {
    mockPage([
      buildOfferListRow({
        application_id: "internal-object-id",
        application_public_id: "app_a8f13c92e51b4f638dde79bf",
      }),
    ]);
    renderPage();

    const link = await screen.findByRole("link", { name: /view application/i });
    expect(link).toHaveAttribute("href", "/applications/app_a8f13c92e51b4f638dde79bf");
  });

  // Phase 2 cutover: the legacy _id fallback is gone — a row missing
  // application_public_id must disable the action, never build a Mongo
  // ObjectId URL from application_id.
  it("disables View Application rather than falling back to application_id when public_id is missing", async () => {
    mockPage([buildOfferListRow({ application_id: "internal-object-id", application_public_id: undefined })]);
    renderPage();

    const button = await screen.findByRole("button", { name: /view application/i });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("link", { name: /view application/i })).not.toBeInTheDocument();
  });

  // 22. empty/error/loading states
  it("shows the unfiltered empty state when there are no offers at all", async () => {
    mockPage([], { total: 0, totalPages: 0 });
    renderPage();
    expect(await screen.findByText(/No offers yet/)).toBeInTheDocument();
  });

  it("shows the filtered empty state with a clear-filters action when a filter matches nothing", async () => {
    const user = userEvent.setup();
    mockPage([buildOfferListRow()]);
    renderPage();
    await screen.findByText("Sarah Ahmed");

    mockPage([], { total: 0, totalPages: 0 });
    await user.type(screen.getByLabelText(/search offers/i), "no-such-candidate");

    expect(await screen.findByText("No offers match your filters.")).toBeInTheDocument();
    // Two Clear filters buttons legitimately exist now — one next to the
    // filter bar itself, one in the empty state — both call clearFilters().
    expect(screen.getAllByRole("button", { name: /clear filters/i }).length).toBeGreaterThan(0);
  });

  it("shows a safe error message on API failure", async () => {
    vi.mocked(offersApi.listOffers).mockRejectedValue(new ApiError("raw db error", 500));
    renderPage();
    expect(await screen.findByText("Offers could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText(/raw db error/)).not.toBeInTheDocument();
  });

  it("shows a loading state before results arrive", () => {
    vi.mocked(offersApi.listOffers).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("heading", { name: "Offers" })).toBeInTheDocument();
    expect(screen.queryByText(/No offers yet/)).not.toBeInTheDocument();
  });

  it("supports pagination", async () => {
    const user = userEvent.setup();
    mockPage([buildOfferListRow()], { page: 1, totalPages: 3, total: 45 });
    renderPage();
    await screen.findByText("Page 1 of 3");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(offersApi.listOffers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()));
  });
});
