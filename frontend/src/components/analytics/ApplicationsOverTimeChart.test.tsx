import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApplicationsOverTimeChart } from "@/components/analytics/ApplicationsOverTimeChart";

describe("ApplicationsOverTimeChart", () => {
  // 10. line chart renders applications-over-time data
  it("10. renders a line chart with the real data points", async () => {
    const { container } = render(
      <ApplicationsOverTimeChart
        data={[
          { period: "2026-09-19", count: 2 },
          { period: "2026-09-20", count: 4 },
          { period: "2026-09-21", count: 6 },
        ]}
        range="30d"
      />
    );

    expect(container.querySelector(".recharts-line")).toBeInTheDocument();
    // 3 real data points -> 3 dots, never fabricated extra points.
    expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(3);
  });

  // 20. responsive chart container present
  it("20. uses a responsive container, never a hard-coded pixel width", () => {
    const { container } = render(<ApplicationsOverTimeChart data={[{ period: "2026-09-21", count: 1 }]} range="30d" />);
    const responsiveContainer = container.querySelector(".recharts-responsive-container");
    expect(responsiveContainer).toBeInTheDocument();
    expect(responsiveContainer).toHaveStyle({ width: "100%" });
  });

  // 15. empty state
  it("15. shows a clear empty state and renders no chart when there is no data", () => {
    const { container } = render(<ApplicationsOverTimeChart data={[]} range="30d" />);
    expect(screen.getByText("No applications in this period.")).toBeInTheDocument();
    expect(container.querySelector(".recharts-line")).not.toBeInTheDocument();
  });

  // 18. no fake data — a real zero-count bucket still renders as a real point, never omitted or invented
  it("18. never fabricates data points beyond what was passed in", () => {
    const { container } = render(
      <ApplicationsOverTimeChart data={[{ period: "2026-09-21", count: 0 }]} range="30d" />
    );
    expect(container.querySelectorAll(".recharts-line-dot")).toHaveLength(1);
  });
});
