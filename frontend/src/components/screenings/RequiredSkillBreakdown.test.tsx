import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequiredSkillBreakdown } from "@/components/screenings/RequiredSkillBreakdown";

describe("RequiredSkillBreakdown", () => {
  const breakdown = [
    { skill: "React", status: "found" as const, weight: 1, evidence: "Built React interfaces for the dashboard." },
    { skill: "PostgreSQL", status: "not_found" as const, weight: 0 },
    { skill: "Node.js", status: "unclear" as const, weight: 0.5, evidence: "Worked on JavaScript backend services." },
  ];

  it("renders each required skill with a status label and evidence", () => {
    render(<RequiredSkillBreakdown breakdown={breakdown} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("Built React interfaces for the dashboard.")).toBeInTheDocument();

    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText("Not found")).toBeInTheDocument();
    expect(screen.getByText("No direct evidence found in the submitted CV.")).toBeInTheDocument();

    expect(screen.getByText("Node.js")).toBeInTheDocument();
    expect(screen.getByText("Unclear")).toBeInTheDocument();
    expect(screen.getByText("Worked on JavaScript backend services.")).toBeInTheDocument();
  });

  it('never labels a missing skill as "Failed"', () => {
    render(<RequiredSkillBreakdown breakdown={breakdown} />);
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });

  it("does not display raw numeric weights to the user", () => {
    render(<RequiredSkillBreakdown breakdown={breakdown} />);
    const text = document.body.textContent ?? "";
    // "0.5" or a bare "1"/"0" as the weight value should never render as
    // visible text content next to a skill row.
    expect(text).not.toMatch(/\b0\.5\b/);
  });
});
