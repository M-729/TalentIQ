import { calculateCandidateMatch } from "../src/services/ai/candidateMatch.service";

function evidence(entries: Array<{ skill: string; status: "found" | "unclear" | "not_found"; evidence?: string }>) {
  return entries;
}

describe("calculateCandidateMatch (pure, deterministic)", () => {
  it("scores 100 when every required skill is found", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "found" },
        { skill: "TypeScript", status: "found" },
      ]),
      ["React", "TypeScript"]
    );

    expect(result.score).toBe(100);
    expect(result.scorable).toBe(true);
  });

  it("scores 0 when every required skill is missing", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "not_found" },
        { skill: "TypeScript", status: "not_found" },
      ]),
      ["React", "TypeScript"]
    );

    expect(result.score).toBe(0);
  });

  it("scores 50 when every required skill is unclear", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "unclear" },
        { skill: "TypeScript", status: "unclear" },
      ]),
      ["React", "TypeScript"]
    );

    expect(result.score).toBe(50);
  });

  it("computes the documented mixed example: found/found/unclear/not_found -> 62.5 rounded to 63", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "found" },
        { skill: "TypeScript", status: "found" },
        { skill: "Node.js", status: "unclear" },
        { skill: "PostgreSQL", status: "not_found" },
      ]),
      ["React", "TypeScript", "Node.js", "PostgreSQL"]
    );

    expect(result.score).toBe(63);
  });

  it("returns score: null and scorable: false with reason 'no_required_skills' when the Job has no required skills", () => {
    const result = calculateCandidateMatch(evidence([{ skill: "React", status: "found" }]), []);

    expect(result.score).toBeNull();
    expect(result.scorable).toBe(false);
    expect(result.reason).toBe("no_required_skills");
    expect(result.totalRequiredSkills).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("scores 100 for a single found required skill", () => {
    const result = calculateCandidateMatch(evidence([{ skill: "React", status: "found" }]), ["React"]);

    expect(result.score).toBe(100);
  });

  it("matches skill evidence case-insensitively", () => {
    const result = calculateCandidateMatch(evidence([{ skill: "react", status: "found" }]), ["React"]);

    expect(result.score).toBe(100);
    expect(result.matchedSkills).toEqual(["React"]);
  });

  it("matches skill evidence regardless of surrounding whitespace", () => {
    const result = calculateCandidateMatch(evidence([{ skill: "  Node.js  ", status: "found" }]), ["Node.js"]);

    expect(result.score).toBe(100);
  });

  it("does not let evidence for a non-required skill increase the score", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "not_found" },
        { skill: "Vue", status: "found" }, // not a required skill
      ]),
      ["React"]
    );

    expect(result.score).toBe(0);
    expect(result.matchedSkills).toEqual([]);
  });

  it("handles duplicate evidence entries for the same required skill deterministically (first occurrence wins)", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "not_found" },
        { skill: "React", status: "found" },
      ]),
      ["React"]
    );

    expect(result.score).toBe(0);
    expect(result.breakdown[0]?.status).toBe("not_found");
  });

  it("treats a required skill with no evidence entry at all as 'unclear', per the documented strategy", () => {
    const result = calculateCandidateMatch(evidence([]), ["React", "TypeScript"]);

    expect(result.score).toBe(50);
    expect(result.breakdown.every((entry) => entry.status === "unclear")).toBe(true);
  });

  it("returns correct found/unclear/missing counts", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "found" },
        { skill: "TypeScript", status: "found" },
        { skill: "Node.js", status: "unclear" },
        { skill: "PostgreSQL", status: "not_found" },
      ]),
      ["React", "TypeScript", "Node.js", "PostgreSQL"]
    );

    expect(result.totalRequiredSkills).toBe(4);
    expect(result.foundSkills).toBe(2);
    expect(result.unclearSkills).toBe(1);
    expect(result.missingSkills).toBe(1);
  });

  it("returns matchedSkills using the Job's exact skill name/casing", () => {
    const result = calculateCandidateMatch(
      evidence([{ skill: "react", status: "found" }]),
      ["React"] // Job casing, not the AI's echoed casing
    );

    expect(result.matchedSkills).toEqual(["React"]);
  });

  it("returns missingRequiredSkills correctly", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "not_found" },
        { skill: "TypeScript", status: "found" },
      ]),
      ["React", "TypeScript"]
    );

    expect(result.missingRequiredSkills).toEqual(["React"]);
  });

  it("returns unclearRequiredSkills correctly", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "found" },
        { skill: "TypeScript", status: "unclear" },
      ]),
      ["React", "TypeScript"]
    );

    expect(result.unclearRequiredSkills).toEqual(["TypeScript"]);
  });

  it("assigns the correct numeric weight to each breakdown entry", () => {
    const result = calculateCandidateMatch(
      evidence([
        { skill: "React", status: "found" },
        { skill: "TypeScript", status: "unclear" },
        { skill: "Node.js", status: "not_found" },
      ]),
      ["React", "TypeScript", "Node.js"]
    );

    expect(result.breakdown).toEqual([
      { skill: "React", status: "found", weight: 1, evidence: undefined },
      { skill: "TypeScript", status: "unclear", weight: 0.5, evidence: undefined },
      { skill: "Node.js", status: "not_found", weight: 0, evidence: undefined },
    ]);
  });

  it("does not let evidence text affect the mathematical weight, only the status does", () => {
    const withLongEvidence = calculateCandidateMatch(
      evidence([{ skill: "React", status: "found", evidence: "Extensive React usage across five major projects." }]),
      ["React"]
    );
    const withNoEvidence = calculateCandidateMatch(evidence([{ skill: "React", status: "found" }]), ["React"]);

    expect(withLongEvidence.score).toBe(withNoEvidence.score);
  });

  it("always returns a score between 0 and 100 across various combinations", () => {
    const combinations: Array<Array<"found" | "unclear" | "not_found">> = [
      ["found"],
      ["not_found"],
      ["unclear"],
      ["found", "unclear", "unclear", "not_found", "not_found"],
      ["found", "found", "found", "found", "found", "not_found"],
      ["unclear", "unclear", "unclear"],
    ];

    for (const statuses of combinations) {
      const requiredSkills = statuses.map((_, i) => `Skill${i}`);
      const result = calculateCandidateMatch(
        evidence(statuses.map((status, i) => ({ skill: `Skill${i}`, status }))),
        requiredSkills
      );

      expect(result.score).not.toBeNull();
      expect(result.score as number).toBeGreaterThanOrEqual(0);
      expect(result.score as number).toBeLessThanOrEqual(100);
    }
  });
});
