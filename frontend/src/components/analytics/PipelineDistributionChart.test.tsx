import { describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { PipelineDistributionChart } from "@/components/analytics/PipelineDistributionChart";

// recharts' hidden #recharts_measurement_span carries the same text as
// real ticks transiently — see src/test/setup.ts's own doc comment.
// Every lookup below is scoped to the real chart's tick labels.
async function getXAxisTicks() {
  await waitFor(() => expect(document.querySelector(".recharts-xAxis-tick-labels")).toBeTruthy());
  return within(document.querySelector(".recharts-xAxis-tick-labels") as HTMLElement);
}

describe("PipelineDistributionChart", () => {
  // 12. pipeline chart renders
  it("12. renders a bar chart with only the non-zero categories the API returned", async () => {
    render(
      <PipelineDistributionChart
        distribution={{
          new_applicants: 4,
          review: 2,
          interview: 0,
          assessment: 0,
          other: 0,
          offered: 1,
          hired: 2,
          rejected: 1,
          offer_declined: 0,
        }}
      />
    );

    const ticks = await getXAxisTicks();
    expect(ticks.getByText("New Applicants")).toBeInTheDocument();
    expect(ticks.getByText("Review")).toBeInTheDocument();
    expect(ticks.getByText("Offered")).toBeInTheDocument();
    expect(ticks.getByText("Hired")).toBeInTheDocument();
    expect(ticks.getByText("Rejected")).toBeInTheDocument();
    // Zero-count categories are never rendered as empty bars.
    expect(ticks.queryByText("Interview")).not.toBeInTheDocument();
    expect(ticks.queryByText("Assessment")).not.toBeInTheDocument();
    expect(ticks.queryByText("Other")).not.toBeInTheDocument();
    expect(ticks.queryByText("Offer Declined")).not.toBeInTheDocument();
  });

  // Never renamed to "Conversion Funnel", never a fabricated rate.
  it("never labels itself a conversion funnel or shows a conversion percentage", () => {
    render(<PipelineDistributionChart distribution={{ new_applicants: 1, review: 0, interview: 0, assessment: 0, other: 0, offered: 0, hired: 0, rejected: 0, offer_declined: 0 }} />);
    expect(screen.queryByText(/conversion/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  // 15. empty state
  it("15. shows a clear empty state when nobody is currently in the pipeline", () => {
    const { container } = render(
      <PipelineDistributionChart distribution={{ new_applicants: 0, review: 0, interview: 0, assessment: 0, other: 0, offered: 0, hired: 0, rejected: 0, offer_declined: 0 }} />
    );
    expect(screen.getByText("No candidates are currently in the hiring pipeline.")).toBeInTheDocument();
    expect(container.querySelector(".recharts-bar")).not.toBeInTheDocument();
  });

  // 20. responsive
  it("20. uses a responsive container", () => {
    const { container } = render(<PipelineDistributionChart distribution={{ new_applicants: 1, review: 0, interview: 0, assessment: 0, other: 0, offered: 0, hired: 0, rejected: 0, offer_declined: 0 }} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
