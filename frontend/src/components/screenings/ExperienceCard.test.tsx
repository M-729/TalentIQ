import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExperienceCard } from "@/components/screenings/ExperienceCard";

describe("ExperienceCard", () => {
  it("shows the years mentioned, phrased as CV-mentioned, not verified", () => {
    render(<ExperienceCard experience={{ yearsMentioned: 5, summary: "5 years as a backend developer." }} />);

    expect(screen.getByText("Years mentioned in CV: 5")).toBeInTheDocument();
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it('shows a neutral message instead of "0 years" when yearsMentioned is null', () => {
    render(<ExperienceCard experience={{ yearsMentioned: null, summary: "Dates were unclear in the CV." }} />);

    expect(screen.getByText("Exact years not clearly determined from the CV.")).toBeInTheDocument();
    expect(screen.queryByText(/0 years/i)).not.toBeInTheDocument();
  });
});
