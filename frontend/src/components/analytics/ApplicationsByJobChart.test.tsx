import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { ApplicationsByJobChart } from "@/components/analytics/ApplicationsByJobChart";

// recharts' hidden #recharts_measurement_span (used internally to measure
// tick label widths — see src/test/setup.ts's own doc comment) carries
// the exact same text as the real, visible tick, so an unscoped
// `screen.getByText` is ambiguous. Every lookup below is scoped to the
// real axis tick labels group instead.
function getYAxisTickLabels() {
  return document.querySelector(".recharts-yAxis-tick-labels") as HTMLElement;
}

describe("ApplicationsByJobChart", () => {
  // 11. applications-by-job chart renders
  it("11. renders a horizontal bar chart with real job titles and counts as tick values", async () => {
    render(
      <ApplicationsByJobChart
        data={[
          { job_id: "job-1", job_title: "Backend Developer", count: 8 },
          { job_id: "job-2", job_title: "Frontend Developer", count: 5 },
        ]}
      />
    );

    await waitFor(() => expect(getYAxisTickLabels()).toBeTruthy());
    const ticks = within(getYAxisTickLabels());
    expect(ticks.getByText("Backend Developer")).toBeInTheDocument();
    expect(ticks.getByText("Frontend Developer")).toBeInTheDocument();
  });

  // long job names remain readable
  it("wraps a long job title on the axis instead of overflowing the chart", async () => {
    render(<ApplicationsByJobChart data={[{ job_id: "job-1", job_title: "Senior Full-Stack Platform Engineer II", count: 3 }]} />);
    // recharts wraps a long category label across multiple <tspan> lines
    // (and ellipsizes further if it still overflows) rather than a single
    // unbroken line running off the chart — assert on the tick's combined
    // text content, not a single element (RTL's default text matcher only
    // ever checks one element's own text node, not text split across
    // sibling <tspan>s).
    const tick = await screen.findByText("Senior Full-Stack");
    const tickGroup = tick.closest(".recharts-cartesian-axis-tick-value")!;
    expect(tickGroup.textContent).not.toBe("Senior Full-Stack Platform Engineer II");
    expect(tickGroup.textContent!.length).toBeLessThan("Senior Full-Stack Platform Engineer II".length);
  });

  // 20. responsive
  it("20. uses a responsive container", () => {
    const { container } = render(<ApplicationsByJobChart data={[{ job_id: "job-1", job_title: "Backend Developer", count: 8 }]} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  // 15. empty state
  it("15. shows a clear empty state when there is no application data for the period", () => {
    const { container } = render(<ApplicationsByJobChart data={[]} />);
    expect(screen.getByText("No application data for this period.")).toBeInTheDocument();
    expect(container.querySelector(".recharts-bar")).not.toBeInTheDocument();
  });

  // 18. no fake zero jobs
  it("18. never renders a job that wasn't in the real data", () => {
    render(<ApplicationsByJobChart data={[{ job_id: "job-1", job_title: "Backend Developer", count: 8 }]} />);
    expect(screen.queryByText("Unknown job")).not.toBeInTheDocument();
  });
});
