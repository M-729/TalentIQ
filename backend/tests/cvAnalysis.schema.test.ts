import { cvAnalysisResultSchema } from "../src/services/ai/cvAnalysis.schema";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    summary: "Backend developer with experience in Node.js and TypeScript.",
    skills: [{ name: "Node.js", evidence: "Listed under skills." }],
    experience: { yearsMentioned: 5, summary: "5 years as a backend developer." },
    education: ["B.Sc. Computer Science"],
    strengths: ["Strong TypeScript background"],
    gaps: ["No mentioned cloud experience"],
    requiredSkillEvidence: [{ skill: "Node.js", status: "found", evidence: "Listed under skills." }],
    ...overrides,
  };
}

describe("cvAnalysisResultSchema", () => {
  it("accepts a valid, complete payload", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("accepts experience.yearsMentioned as null", () => {
    const result = cvAnalysisResultSchema.safeParse(
      validPayload({ experience: { yearsMentioned: null, summary: "Dates are unclear." } })
    );
    expect(result.success).toBe(true);
  });

  it("accepts experience.yearsMentioned omitted entirely", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload({ experience: { summary: "Dates are unclear." } }));
    expect(result.success).toBe(true);
  });

  it("rejects a top-level field the schema doesn't define (e.g. a hallucinated hiring recommendation)", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload({ recommendedDecision: "hire" }));
    expect(result.success).toBe(false);
  });

  it("rejects a hallucinated candidateScore field", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload({ candidateScore: 87 }));
    expect(result.success).toBe(false);
  });

  it("rejects an extra field nested inside a skill entry", () => {
    const result = cvAnalysisResultSchema.safeParse(
      validPayload({ skills: [{ name: "Node.js", evidence: "x", confidence: 0.9 }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid requiredSkillEvidence status enum value", () => {
    const result = cvAnalysisResultSchema.safeParse(
      validPayload({ requiredSkillEvidence: [{ skill: "Node.js", status: "maybe" }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an excessive skills array beyond the bound", () => {
    const skills = Array.from({ length: 51 }, (_, i) => ({ name: `Skill ${i}` }));
    const result = cvAnalysisResultSchema.safeParse(validPayload({ skills }));
    expect(result.success).toBe(false);
  });

  it("accepts a skills array right at the bound", () => {
    const skills = Array.from({ length: 50 }, (_, i) => ({ name: `Skill ${i}` }));
    const result = cvAnalysisResultSchema.safeParse(validPayload({ skills }));
    expect(result.success).toBe(true);
  });

  it("rejects an excessively long evidence string", () => {
    const result = cvAnalysisResultSchema.safeParse(
      validPayload({ skills: [{ name: "Node.js", evidence: "x".repeat(301) }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an excessively long summary", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload({ summary: "x".repeat(1001) }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty summary", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload({ summary: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty skill name", () => {
    const result = cvAnalysisResultSchema.safeParse(validPayload({ skills: [{ name: "" }] }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty requiredSkillEvidence skill name", () => {
    const result = cvAnalysisResultSchema.safeParse(
      validPayload({ requiredSkillEvidence: [{ skill: "", status: "found" }] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a negative or unrealistic yearsMentioned value", () => {
    expect(
      cvAnalysisResultSchema.safeParse(validPayload({ experience: { yearsMentioned: -1, summary: "x" } })).success
    ).toBe(false);
    expect(
      cvAnalysisResultSchema.safeParse(validPayload({ experience: { yearsMentioned: 200, summary: "x" } })).success
    ).toBe(false);
  });

  it("rejects education/strengths/gaps arrays beyond their bounds", () => {
    expect(
      cvAnalysisResultSchema.safeParse(validPayload({ education: Array(21).fill("Degree") })).success
    ).toBe(false);
    expect(
      cvAnalysisResultSchema.safeParse(validPayload({ strengths: Array(16).fill("Strength") })).success
    ).toBe(false);
    expect(cvAnalysisResultSchema.safeParse(validPayload({ gaps: Array(16).fill("Gap") })).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).experience;
    const result = cvAnalysisResultSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
