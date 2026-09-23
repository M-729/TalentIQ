import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OfferOutcomesChart } from "@/components/analytics/OfferOutcomesChart";

describe("OfferOutcomesChart", () => {
  // 13. offer-outcomes donut renders
  it("13. renders a donut chart with a slice per non-zero outcome", async () => {
    const { container } = render(<OfferOutcomesChart outcomes={{ accepted: 3, declined: 1, pending: 2, withdrawn: 0, acceptance_rate: 75 }} />);

    // recharts' <ResponsiveContainer> sizes itself via a ResizeObserver
    // effect that commits one tick AFTER the chart first mounts (see
    // src/test/setup.ts) — sectors aren't present on the very first render.
    await waitFor(() => expect(container.querySelectorAll(".recharts-pie-sector")).toHaveLength(3)); // accepted, declined, pending — withdrawn is 0
  });

  // 14. tooltips/data labels use correct values — the text legend (not
  // hover-dependent) is the always-visible, accessible source of the
  // exact values, so color is never the only way to read the chart.
  it("14. the text legend shows the exact real counts and percentages, not just color", () => {
    render(<OfferOutcomesChart outcomes={{ accepted: 3, declined: 1, pending: 0, withdrawn: 0, acceptance_rate: 75 }} />);

    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("3 (75%)")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("1 (25%)")).toBeInTheDocument();
  });

  // Center text — "Resolved Offers" = accepted + declined, computed
  // directly from existing fields, never a new backend metric.
  it("shows Resolved Offers (accepted + declined) in the donut center", () => {
    render(<OfferOutcomesChart outcomes={{ accepted: 3, declined: 1, pending: 2, withdrawn: 1, acceptance_rate: 75 }} />);
    expect(screen.getByText("Resolved Offers")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument(); // 3 + 1
  });

  // Draft offers are never a candidate outcome — there is no "draft" key
  // on the outcomes shape at all, so it's structurally impossible to show one.
  it("never shows a Draft category", () => {
    render(<OfferOutcomesChart outcomes={{ accepted: 1, declined: 0, pending: 0, withdrawn: 0, acceptance_rate: null }} />);
    expect(screen.queryByText(/draft/i)).not.toBeInTheDocument();
  });

  // 15. empty state
  it("15. shows a clear empty state when there are no offer outcomes yet", () => {
    const { container } = render(<OfferOutcomesChart outcomes={{ accepted: 0, declined: 0, pending: 0, withdrawn: 0, acceptance_rate: null }} />);
    expect(screen.getByText("No offer outcomes yet.")).toBeInTheDocument();
    expect(container.querySelector(".recharts-pie")).not.toBeInTheDocument();
  });

  // 20. responsive
  it("20. uses a responsive container", () => {
    const { container } = render(<OfferOutcomesChart outcomes={{ accepted: 1, declined: 0, pending: 0, withdrawn: 0, acceptance_rate: null }} />);
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });
});
