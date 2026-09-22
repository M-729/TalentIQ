import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationScreeningPage } from "@/pages/ApplicationScreeningPage";
import { buildApplicationDetail, buildScreening } from "@/test/fixtures";
import * as screeningsApi from "@/services/api/screenings";
import * as applicationsApi from "@/services/api/applications";

vi.mock("@/services/api/screenings");
vi.mock("@/services/api/applications");

function renderPage(applicationId = "app-1") {
  return render(
    <MemoryRouter initialEntries={[`/applications/${applicationId}/screening`]}>
      <Routes>
        <Route path="/applications/:applicationId/screening" element={<ApplicationScreeningPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ApplicationScreeningPage", () => {
  beforeEach(() => {
    vi.mocked(screeningsApi.getLatestScreening).mockReset();
    vi.mocked(screeningsApi.getScreeningHistory).mockReset();
    vi.mocked(screeningsApi.createScreening).mockReset();
    vi.mocked(applicationsApi.getApplication)
      .mockReset()
      .mockResolvedValue({
        application: buildApplicationDetail({
          candidate: { id: "candidate-1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
          job: { id: "job-1", title: "Backend Developer", required_skills: [], status: "active" },
        }),
      });
  });

  it("fetches the latest screening on mount", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: buildScreening(), status: "completed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();

    await waitFor(() => expect(screeningsApi.getLatestScreening).toHaveBeenCalledWith("app-1", expect.anything()));
  });

  it("never calls createScreening automatically on mount, even when no screening exists", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();
    await screen.findByText("No AI screening yet");

    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  it("shows the empty state with a Run AI Screening action when no screening exists", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();

    expect(await screen.findByRole("button", { name: /run ai screening/i })).toBeInTheDocument();
  });

  it("POSTs exactly once when Run AI Screening is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({ screening: buildScreening() });

    renderPage();
    await user.click(await screen.findByRole("button", { name: /run ai screening/i }));

    await waitFor(() => expect(screeningsApi.createScreening).toHaveBeenCalledTimes(1));
  });

  it("disables the button while the POST is in flight, preventing duplicate clicks", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    let resolveCreate: (value: { screening: ReturnType<typeof buildScreening> }) => void = () => {};
    vi.mocked(screeningsApi.createScreening).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    renderPage();
    const button = await screen.findByRole("button", { name: /run ai screening/i });
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    resolveCreate({ screening: buildScreening() });
  });

  it("renders the result after a successful POST", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({ screening: buildScreening() });

    renderPage();
    await user.click(await screen.findByRole("button", { name: /run ai screening/i }));

    expect(await screen.findByText("Required Skill Coverage")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  // Screening happens once, automatically, and the result stays stable —
  // the normal completed-screening workflow no longer offers a Rerun
  // control at all (see this ticket's explicit removal of the standard
  // manual rerun UX; ScreeningResultHeader's onRequestRerun is simply
  // never wired up from this page anymore, though the underlying
  // component/dialog/backend capability still exist for a future
  // administrative mechanism, out of scope here).
  it("shows no Rerun control for a normal completed screening", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: buildScreening(), status: "completed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [buildScreening()] });

    renderPage();

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /re-run screening/i })).not.toBeInTheDocument();
    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  it("shows a Processing message, with no Run/Retry button, while the initial screening is running", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "processing" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();

    expect(await screen.findByText(/processing candidate cv/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  // Stale processing recovery — a "processing" run stuck past the
  // configured timeout (e.g. a backend crash) is reported by the backend
  // as "stale_processing" and must show a distinct "interrupted" message
  // with an explicit Retry action, never an indefinite Processing state
  // and never an automatic rerun just because the page was opened.
  it('shows "Screening was interrupted" with a Retry Screening action for a stale processing run', async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "stale_processing" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();

    expect(await screen.findByText(/screening was interrupted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry screening/i })).toBeInTheDocument();
    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  it("lets Retry succeed for a stale processing run, without auto-retrying on page load", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "stale_processing" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({ screening: buildScreening({ id: "recovered" }) });

    renderPage();
    await screen.findByText(/screening was interrupted/i);
    expect(screeningsApi.createScreening).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /retry screening/i }));

    await waitFor(() => expect(screeningsApi.createScreening).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("100%")).toBeInTheDocument();
  });

  it("shows a Retry Screening action, and lets it succeed, when the initial screening failed", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "failed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({ screening: buildScreening({ id: "retry-success" }) });

    renderPage();
    const retryButton = await screen.findByRole("button", { name: /retry screening/i });
    await user.click(retryButton);

    await waitFor(() => expect(screeningsApi.createScreening).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("100%")).toBeInTheDocument();
  });

  it("disables the Retry Screening button while the retry is in flight, preventing a double submit", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "failed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    let resolveCreate: (value: { screening: ReturnType<typeof buildScreening> }) => void = () => {};
    vi.mocked(screeningsApi.createScreening).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    renderPage();
    const retryButton = await screen.findByRole("button", { name: /retry screening/i });
    await user.click(retryButton);

    await waitFor(() => expect(retryButton).toBeDisabled());
    resolveCreate({ screening: buildScreening() });
  });

  it("renders history newest-first exactly as the API returns it, without re-sorting", async () => {
    const newest = buildScreening({ id: "second", created_at: "2024-02-01T00:00:00.000Z" });
    const oldest = buildScreening({ id: "first", created_at: "2024-01-01T00:00:00.000Z" });
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest, status: "completed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [newest, oldest] });

    renderPage();
    await screen.findByText("Screening History");

    const buttons = screen.getAllByRole("button", { name: /view screening from/i });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute("aria-label")).toContain("Feb");
    expect(buttons[1]?.getAttribute("aria-label")).toContain("Jan");
  });

  it("selecting a historical screening shows that stored snapshot without calling createScreening", async () => {
    const user = userEvent.setup();
    const newest = buildScreening({ id: "second", created_at: "2024-02-01T00:00:00.000Z" });
    const oldest = buildScreening({
      id: "first",
      created_at: "2024-01-01T00:00:00.000Z",
      match: { ...buildScreening().match, score: 40 },
    });
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest, status: "completed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [newest, oldest] });

    renderPage();
    await screen.findByText("Screening History");
    const oldEntryButton = screen.getByRole("button", { name: /view screening from.*jan/i });
    await user.click(oldEntryButton);

    expect(await screen.findByText("Historical Screening")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  it("Back to Latest returns from a historical view to the current latest screening", async () => {
    const user = userEvent.setup();
    const newest = buildScreening({ id: "second", created_at: "2024-02-01T00:00:00.000Z" });
    const oldest = buildScreening({
      id: "first",
      created_at: "2024-01-01T00:00:00.000Z",
      match: { ...buildScreening().match, score: 40 },
    });
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest, status: "completed" });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [newest, oldest] });

    renderPage();
    await screen.findByText("Screening History");
    await user.click(screen.getByRole("button", { name: /view screening from.*jan/i }));
    await screen.findByText("Historical Screening");

    await user.click(screen.getByRole("button", { name: /back to latest/i }));

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.queryByText("Historical Screening")).not.toBeInTheDocument();
  });

  describe("candidate/job context header", () => {
    it("shows the candidate's name", async () => {
      vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
      vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

      renderPage();

      expect(await screen.findByRole("heading", { name: "Sarah Ahmed" })).toBeInTheDocument();
    });

    it("shows the applied job title", async () => {
      vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
      vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

      renderPage();

      expect(await screen.findByText("Application for Backend Developer")).toBeInTheDocument();
    });

    it("links Back to Application to the correct detail route", async () => {
      vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
      vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

      renderPage("app-1");

      const backLink = await screen.findByRole("link", { name: /back to application/i });
      expect(backLink).toHaveAttribute("href", "/applications/app-1");
    });

    it("still never auto-POSTs a screening, even with candidate/job context loaded", async () => {
      vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null, status: "not_started" });
      vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

      renderPage();

      await screen.findByRole("heading", { name: "Sarah Ahmed" });
      expect(screeningsApi.createScreening).not.toHaveBeenCalled();
    });

    it("leaves historical screening browsing unchanged by the context header", async () => {
      const newest = buildScreening({ id: "second", created_at: "2024-02-01T00:00:00.000Z" });
      const oldest = buildScreening({
        id: "first",
        created_at: "2024-01-01T00:00:00.000Z",
        match: { ...buildScreening().match, score: 40 },
      });
      vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest, status: "completed" });
      vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [newest, oldest] });

      renderPage();
      await screen.findByRole("heading", { name: "Sarah Ahmed" });
      await screen.findByText("Screening History");

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /view screening from.*jan/i }));

      // Context header stays visible and correct alongside the historical view.
      expect(await screen.findByText("Historical Screening")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Sarah Ahmed" })).toBeInTheDocument();
      expect(screen.getByText("40%")).toBeInTheDocument();
    });
  });
});
