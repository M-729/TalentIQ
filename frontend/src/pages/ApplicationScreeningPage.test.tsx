import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ApplicationScreeningPage } from "@/pages/ApplicationScreeningPage";
import { buildScreening } from "@/test/fixtures";
import * as screeningsApi from "@/services/api/screenings";

vi.mock("@/services/api/screenings");

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
  });

  it("fetches the latest screening on mount", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: buildScreening() });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();

    await waitFor(() => expect(screeningsApi.getLatestScreening).toHaveBeenCalledWith("app-1", expect.anything()));
  });

  it("never calls createScreening automatically on mount, even when no screening exists", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();
    await screen.findByText("No AI screening yet");

    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  it("shows the empty state with a Run AI Screening action when no screening exists", async () => {
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });

    renderPage();

    expect(await screen.findByRole("button", { name: /run ai screening/i })).toBeInTheDocument();
  });

  it("POSTs exactly once when Run AI Screening is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({ screening: buildScreening() });

    renderPage();
    await user.click(await screen.findByRole("button", { name: /run ai screening/i }));

    await waitFor(() => expect(screeningsApi.createScreening).toHaveBeenCalledTimes(1));
  });

  it("disables the button while the POST is in flight, preventing duplicate clicks", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null });
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
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: null });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({ screening: buildScreening() });

    renderPage();
    await user.click(await screen.findByRole("button", { name: /run ai screening/i }));

    expect(await screen.findByText("Required Skill Coverage")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("requires confirmation before a rerun when a screening already exists", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: buildScreening() });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [buildScreening()] });

    renderPage();
    const rerunButton = await screen.findByRole("button", { name: /re-run screening/i });
    await user.click(rerunButton);

    expect(await screen.findByText("Re-run AI screening?")).toBeInTheDocument();
    expect(screeningsApi.createScreening).not.toHaveBeenCalled();
  });

  it("creates a new screening only after the rerun is confirmed", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: buildScreening({ id: "first" }) });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [buildScreening({ id: "first" })] });
    vi.mocked(screeningsApi.createScreening).mockResolvedValue({
      screening: buildScreening({ id: "second", match: { ...buildScreening().match, score: 63 } }),
    });

    renderPage();
    await user.click(await screen.findByRole("button", { name: /re-run screening/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^re-run screening$/i }));

    await waitFor(() => expect(screeningsApi.createScreening).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("63%")).toBeInTheDocument();
  });

  it("keeps the old screening visible if the rerun fails", async () => {
    const user = userEvent.setup();
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: buildScreening() });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [buildScreening()] });
    vi.mocked(screeningsApi.createScreening).mockRejectedValue(new Error("boom"));

    renderPage();
    await user.click(await screen.findByRole("button", { name: /re-run screening/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^re-run screening$/i }));

    await waitFor(() => expect(screeningsApi.createScreening).toHaveBeenCalledTimes(1));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders history newest-first exactly as the API returns it, without re-sorting", async () => {
    const newest = buildScreening({ id: "second", created_at: "2024-02-01T00:00:00.000Z" });
    const oldest = buildScreening({ id: "first", created_at: "2024-01-01T00:00:00.000Z" });
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest });
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
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest });
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
    vi.mocked(screeningsApi.getLatestScreening).mockResolvedValue({ screening: newest });
    vi.mocked(screeningsApi.getScreeningHistory).mockResolvedValue({ screenings: [newest, oldest] });

    renderPage();
    await screen.findByText("Screening History");
    await user.click(screen.getByRole("button", { name: /view screening from.*jan/i }));
    await screen.findByText("Historical Screening");

    await user.click(screen.getByRole("button", { name: /back to latest/i }));

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.queryByText("Historical Screening")).not.toBeInTheDocument();
  });
});
