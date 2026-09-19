import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreCoverageBar } from "@/components/screenings/ScoreCoverageBar";
import { buildScreening } from "@/test/fixtures";

describe("ScoreCoverageBar", () => {
  it("labels the score as Required Skill Coverage, never as a hiring/AI judgment", () => {
    const { match } = buildScreening({ match: { ...buildScreening().match, score: 63 } });
    render(<ScoreCoverageBar match={match} />);

    expect(screen.getByText("Required Skill Coverage")).toBeInTheDocument();
    expect(screen.getByText("63%")).toBeInTheDocument();
  });

  it("never uses hiring-recommendation or candidate-quality language", () => {
    const { match } = buildScreening();
    render(<ScoreCoverageBar match={match} />);

    const text = document.body.textContent ?? "";
    for (const forbidden of [
      "chance of hire",
      "hiring probability",
      "candidate quality",
      "recommendation",
      "AI confidence",
      "AI score",
      "suitable",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("shows a neutral message instead of a percentage when not scorable", () => {
    const { match } = buildScreening({
      match: {
        score: null,
        scorable: false,
        reason: "no_required_skills",
        totalRequiredSkills: 0,
        foundSkills: 0,
        unclearSkills: 0,
        missingSkills: 0,
        matchedSkills: [],
        unclearRequiredSkills: [],
        missingRequiredSkills: [],
        breakdown: [],
      },
    });
    render(<ScoreCoverageBar match={match} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/no required skills configured/i)).toBeInTheDocument();
  });
});
