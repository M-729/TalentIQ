import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HiringAnalyticsPage } from "@/pages/HiringAnalyticsPage";
import * as hiringAnalyticsApi from "@/services/api/hiringAnalytics";
import * as jobsApi from "@/services/api/jobs";
import type { HiringAnalytics } from "@/types/hiringAnalytics";

vi.mock("@/services/api/hiringAnalytics");
vi.mock("@/services/api/jobs");

function buildAnalytics(overrides: Partial<HiringAnalytics> = {}): HiringAnalytics {
  return {
    range: "30d",
    job_id: null,
    kpis: {
      total_applications: 12,
      hired: 2,
      offers_accepted: 3,
      offers_declined: 1,
      offer_acceptance_rate: 75,
      average_time_to_hire_days: 9.5,
    },
    applications_over_time: [
      { period: "2026-09-19", count: 2 },
      { period: "2026-09-20", count: 4 },
      { period: "2026-09-21", count: 6 },
    ],
    applications_by_job: [{ job_id: "job-1", job_title: "Backend Developer", count: 8 }],
    pipeline_distribution: {
      new_applicants: 4,
      review: 2,
      interview: 1,
      assessment: 0,
      other: 0,
      offered: 1,
      hired: 2,
      rejected: 1,
      offer_declined: 0,
    },
    offer_outcomes: { accepted: 3, declined: 1, pending: 2, withdrawn: 0, acceptance_rate: 75 },
    ...overrides,
  };
}

function mockAnalytics(overrides: Partial<HiringAnalytics> = {}) {
  vi.mocked(hiringAnalyticsApi.getHiringAnalytics).mockResolvedValue(buildAnalytics(overrides));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HiringAnalyticsPage />
    </MemoryRouter>
  );
}

describe("HiringAnalyticsPage", () => {
  beforeEach(() => {
    vi.mocked(hiringAnalyticsApi.getHiringAnalytics).mockReset();
    vi.mocked(jobsApi.listJobs).mockReset().mockResolvedValue({ jobs: [] });
  });

  // 53. Analytics sidebar enabled — covered in router.test.tsx.

  // 54. KPI cards
  it("54. renders real KPI values from the API", async () => {
    mockAnalytics();
    renderPage();

    expect(await screen.findByText("Total Applications")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    // The value and unit are now separate DOM nodes (a larger number next
    // to a smaller/muted unit) for a clearer number hierarchy — RTL can't
    // string-match text split across elements, hence the function matcher
    // against the containing element's own full text content.
    expect(screen.getByText((_, node) => node?.textContent === "75%")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === "9.5d")).toBeInTheDocument();
  });

  it("never shows a misleading 0%/NaN when a rate is null", async () => {
    mockAnalytics({ kpis: { total_applications: 0, hired: 0, offers_accepted: 0, offers_declined: 0, offer_acceptance_rate: null, average_time_to_hire_days: null } });
    renderPage();

    await screen.findByText("Total Applications");
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  // 55. date filter
  it("55. calls the API with the selected range", async () => {
    mockAnalytics();
    renderPage();
    await waitFor(() => expect(hiringAnalyticsApi.getHiringAnalytics).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Date range"), "90d");
    await waitFor(() =>
      expect(hiringAnalyticsApi.getHiringAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ range: "90d" }), expect.anything())
    );
  });

  // 56. job filter if implemented
  it("56. calls the API with the selected job filter", async () => {
    vi.mocked(jobsApi.listJobs).mockResolvedValue({
      jobs: [
        {
          _id: "job-1",
          company_id: "company-1",
          created_by: "user-1",
          title: "Backend Developer",
          department: "Eng",
          status: "active",
          required_skills: [],
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    mockAnalytics();
    renderPage();
    await waitFor(() => expect(hiringAnalyticsApi.getHiringAnalytics).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("Filter by job"), "job-1");
    await waitFor(() =>
      expect(hiringAnalyticsApi.getHiringAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ jobId: "job-1" }), expect.anything())
    );
  });

  // 57. applications-by-job visualization
  it("57. renders the applications-by-job chart", async () => {
    mockAnalytics();
    renderPage();

    // recharts' <ResponsiveContainer> sizes itself via a ResizeObserver
    // effect that commits one tick AFTER the chart first mounts — real
    // browsers do this too, so the axis tick text (unlike the static
    // CardTitle above) genuinely isn't present on the very first render
    // and must be awaited, not asserted synchronously. Scoped to this
    // specific chart's own Card: the page renders more than one chart
    // with a y-axis/x-axis (Applications Over Time has a numeric y-axis
    // of its own), and recharts' hidden measurement span (see
    // src/test/setup.ts) can also transiently carry the same text — an
    // unscoped, document-wide lookup risks matching the wrong element.
    const title = await screen.findByText("Applications by Job");
    const card = title.closest('[data-slot="card"]') as HTMLElement;
    await waitFor(() => expect(card.querySelector(".recharts-yAxis-tick-labels")).toBeTruthy());
    const jobChart = within(card);
    expect(jobChart.getByText("Backend Developer")).toBeInTheDocument();
  });

  // 58. pipeline distribution
  it("58. renders the pipeline distribution chart, excluding zero buckets", async () => {
    mockAnalytics();
    renderPage();

    // Scoped to this specific chart's own Card — the page renders THREE
    // charts with an x-axis (Applications Over Time, Applications by Job,
    // Pipeline Distribution), so an unscoped lookup for a bare category
    // label risks matching the wrong chart's axis (or recharts' own
    // hidden measurement span — see src/test/setup.ts).
    const title = await screen.findByText("Current Pipeline Distribution");
    const card = title.closest('[data-slot="card"]') as HTMLElement;
    await waitFor(() => expect(card.querySelector(".recharts-xAxis-tick-labels")).toBeTruthy());
    const pipelineChart = within(card);
    expect(pipelineChart.getByText("New Applicants")).toBeInTheDocument();
    expect(pipelineChart.queryByText("Assessment")).not.toBeInTheDocument(); // count is 0
  });

  // 59. offer outcomes
  it("59. renders the offer outcomes chart", async () => {
    mockAnalytics();
    renderPage();

    expect(await screen.findByText("Offer Outcomes")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  // 60. empty period — each chart shows its OWN precise empty state
  // (this ticket's explicit per-chart empty-state list), rather than one
  // blanket message hiding everything, including sections (Pipeline
  // Distribution) that are current-state and genuinely still have data.
  it("60. shows each chart's own empty-period message when total applications is zero but the company has data overall", async () => {
    mockAnalytics({
      kpis: { total_applications: 0, hired: 0, offers_accepted: 0, offers_declined: 0, offer_acceptance_rate: null, average_time_to_hire_days: null },
      applications_over_time: [],
      applications_by_job: [],
      pipeline_distribution: { new_applicants: 0, review: 0, interview: 0, assessment: 0, other: 0, offered: 0, hired: 0, rejected: 1, offer_declined: 0 },
      offer_outcomes: { accepted: 0, declined: 0, pending: 0, withdrawn: 0, acceptance_rate: null },
    });
    renderPage();

    expect(await screen.findByText("No applications in this period.")).toBeInTheDocument();
    expect(screen.getByText("No application data for this period.")).toBeInTheDocument();
    expect(screen.getByText("No offer outcomes yet.")).toBeInTheDocument();
    // Pipeline Distribution is current-state, not period-scoped — it
    // still shows its real (non-empty) data here. Scoped to the chart's
    // own tick labels, not the whole document: recharts' own hidden
    // measurement span can transiently carry the same text (see
    // src/test/setup.ts).
    await waitFor(() => expect(document.querySelector(".recharts-xAxis-tick-labels")).toBeTruthy());
    const pipelineTicks = within(document.querySelector(".recharts-xAxis-tick-labels") as HTMLElement);
    expect(pipelineTicks.getByText("Rejected")).toBeInTheDocument();
  });

  // 61. empty company
  it("61. shows the empty-company state when there is truly no data anywhere", async () => {
    mockAnalytics({
      kpis: { total_applications: 0, hired: 0, offers_accepted: 0, offers_declined: 0, offer_acceptance_rate: null, average_time_to_hire_days: null },
      applications_by_job: [],
      pipeline_distribution: { new_applicants: 0, review: 0, interview: 0, assessment: 0, other: 0, offered: 0, hired: 0, rejected: 0, offer_declined: 0 },
    });
    renderPage();

    expect(await screen.findByText("No hiring data yet")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "View Jobs" });
    expect(link).toHaveAttribute("href", "/jobs");
  });

  // 19 / 62. loading/error behavior unchanged
  it("19. shows a loading skeleton before real data arrives", () => {
    vi.mocked(hiringAnalyticsApi.getHiringAnalytics).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByText("Total Applications")).not.toBeInTheDocument();
    expect(screen.queryByText("Applications by Job")).not.toBeInTheDocument();
  });

  it("62. shows an error state with retry", async () => {
    vi.mocked(hiringAnalyticsApi.getHiringAnalytics).mockRejectedValue(new Error("down"));
    renderPage();
    expect(await screen.findByText("Couldn't load analytics")).toBeInTheDocument();
  });

  // 20. responsive chart containers present
  it("20. every chart section uses a responsive container, not a fixed pixel width", async () => {
    mockAnalytics();
    renderPage();

    await screen.findByText("Applications Over Time");
    const responsiveContainers = document.querySelectorAll(".recharts-responsive-container");
    // Applications Over Time, Applications by Job, Pipeline Distribution,
    // Offer Outcomes — one real chart section each.
    expect(responsiveContainers.length).toBe(4);
    responsiveContainers.forEach((el) => {
      expect(el).toHaveStyle({ width: "100%" });
    });
  });

  // 18. no fake data — the KPI grid never renders a chart section with
  // invented content beyond exactly what the (mocked) API returned.
  it("18. never renders a job that wasn't in the real applications_by_job response", async () => {
    mockAnalytics({ applications_by_job: [{ job_id: "job-9", job_title: "Data Analyst", count: 2 }] });
    renderPage();

    await screen.findByText("Applications by Job");
    expect(screen.queryByText("Backend Developer")).not.toBeInTheDocument();
  });
});
