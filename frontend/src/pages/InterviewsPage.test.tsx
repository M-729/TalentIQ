import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InterviewsPage } from "@/pages/InterviewsPage";
import { buildInterviewListRow } from "@/test/fixtures";
import { ApiError } from "@/services/api/client";
import * as interviewsApi from "@/services/api/interviews";
import * as jobsApi from "@/services/api/jobs";

vi.mock("@/services/api/interviews");
vi.mock("@/services/api/jobs");

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/interviews"]}>
      <Routes>
        <Route path="/interviews" element={<InterviewsPage />} />
        <Route path="/interviews/:interviewId" element={<div>Interview Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewsPage", () => {
  beforeEach(() => {
    vi.mocked(interviewsApi.listInterviews).mockReset();
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({ jobs: [] });
  });

  it("renders real interview data from the API", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ title: "Backend Technical Interview" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    expect(await screen.findByText("Backend Technical Interview")).toBeInTheDocument();
    expect(screen.getByText("Sarah Ahmed")).toBeInTheDocument();
  });

  it("shows the empty state when there are no interviews", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    renderPage();

    expect(await screen.findByText("No interviews scheduled yet.")).toBeInTheDocument();
  });

  it("renders a scheduled interview's status", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ status: "scheduled" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText("Scheduled")).toBeInTheDocument();
  });

  it("renders a cancelled interview's status", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ status: "cancelled" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
  });

  it("renders a completed interview's status", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ status: "completed" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText("Completed")).toBeInTheDocument();
  });

  it("shows a Join Google Meet link only when meeting_url is present", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [
        buildInterviewListRow({
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/abc-defg-hij", last_synced_at: "2024-01-01T00:00:00.000Z" },
        }),
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    const link = await screen.findByRole("link", { name: /Join Google Meet/ });
    expect(link).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("never shows Join Google Meet when there is no meeting_url", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ calendar: { provider: "google", connected: true, sync_status: "pending", meeting_url: null, last_synced_at: null } })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    await screen.findByText("Pending");
    expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
  });

  it("never shows Join Google Meet for a cancelled interview, even though meeting_url still exists", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [
        buildInterviewListRow({
          status: "cancelled",
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/abc-defg-hij", last_synced_at: null },
        }),
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    await screen.findByText("Cancelled");
    expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
  });

  it("never shows Join Google Meet for a completed interview, even though meeting_url still exists", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [
        buildInterviewListRow({
          status: "completed",
          calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/abc-defg-hij", last_synced_at: null },
        }),
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    await screen.findByText("Completed");
    expect(screen.queryByRole("link", { name: /Join Google Meet/ })).not.toBeInTheDocument();
  });

  it("renders each calendar state correctly: Not linked, Synced, Pending, Sync issue", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [
        buildInterviewListRow({ id: "i1", calendar: null }),
        buildInterviewListRow({ id: "i2", calendar: { provider: "google", connected: true, sync_status: "synced", meeting_url: "https://meet.google.com/a", last_synced_at: null } }),
        buildInterviewListRow({ id: "i3", calendar: { provider: "google", connected: true, sync_status: "pending", meeting_url: null, last_synced_at: null } }),
        buildInterviewListRow({ id: "i4", calendar: { provider: "google", connected: true, sync_status: "failed", meeting_url: null, last_synced_at: null } }),
      ],
      pagination: { page: 1, limit: 20, total: 4, totalPages: 1 },
    });
    renderPage();

    await waitFor(() => expect(screen.getAllByText(/Not linked|Synced|Pending|Sync issue/)).toHaveLength(4));
    expect(screen.getByText("Not linked")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Sync issue")).toBeInTheDocument();
  });

  it("shows a loading skeleton before interviews resolve", () => {
    vi.mocked(interviewsApi.listInterviews).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByText("No interviews scheduled yet.")).not.toBeInTheDocument();
  });

  it("shows a safe error message and Retry on failure, never a raw backend message", async () => {
    vi.mocked(interviewsApi.listInterviews).mockRejectedValue(new ApiError("raw db connection error", 500));
    renderPage();

    expect(await screen.findByText("Interviews could not be loaded. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText(/raw db connection error/)).not.toBeInTheDocument();
  });

  it("retries the fetch when Retry is clicked", async () => {
    vi.mocked(interviewsApi.listInterviews)
      .mockRejectedValueOnce(new ApiError("fail", 500))
      .mockResolvedValueOnce({
        interviews: [buildInterviewListRow({ title: "Retried Interview" })],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Retried Interview")).toBeInTheDocument();
  });

  it("links each row to its interview detail page", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ id: "interview-42", public_id: "interview-42-public" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    const link = await screen.findByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/interviews/interview-42-public");
  });

  // Phase 1 opaque public ID migration: prefers public_id over the raw
  // Mongo _id (exposed here as `id`) once the backend provides one.
  it("links each row using public_id when present, not id", async () => {
    vi.mocked(interviewsApi.listInterviews).mockResolvedValue({
      interviews: [buildInterviewListRow({ id: "internal-object-id", public_id: "int_a8f13c92e51b4f638dde79bf" })],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderPage();

    const link = await screen.findByRole("link", { name: "View" });
    expect(link).toHaveAttribute("href", "/interviews/int_a8f13c92e51b4f638dde79bf");
  });
});
