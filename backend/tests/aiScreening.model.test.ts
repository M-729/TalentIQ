import { Types } from "mongoose";
import { AIScreening } from "../src/models/AIScreening.model";
import { Application } from "../src/models/Application.model";
import { Candidate } from "../src/models/Candidate.model";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const VALID_ANALYSIS = {
  summary: "Backend developer with Node.js and TypeScript experience.",
  skills: [{ name: "Node.js", evidence: "Listed under Skills." }],
  experience: { yearsMentioned: 5, summary: "5 years as a backend developer." },
  education: ["B.Sc. Computer Science"],
  strengths: ["Strong TypeScript background"],
  gaps: ["No mentioned cloud experience"],
  requiredSkillEvidence: [{ skill: "Node.js", status: "found", evidence: "Listed under Skills." }],
};

const VALID_MATCH = {
  score: 100,
  scorable: true,
  totalRequiredSkills: 1,
  foundSkills: 1,
  unclearSkills: 0,
  missingSkills: 0,
  matchedSkills: ["Node.js"],
  unclearRequiredSkills: [],
  missingRequiredSkills: [],
  breakdown: [{ skill: "Node.js", status: "found", weight: 1, evidence: "Listed under Skills." }],
};

function validScreeningInput(overrides: Record<string, unknown> = {}) {
  return {
    application_id: new Types.ObjectId(),
    job_id: new Types.ObjectId(),
    analysis: VALID_ANALYSIS,
    match: VALID_MATCH,
    ai_metadata: { provider: "groq", model: "openai/gpt-oss-120b" },
    score_formula_version: "required_skill_coverage_v1",
    ...overrides,
  };
}

describe("AIScreening model", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@ai-screening-model.test", role: "HR" });
  });

  async function createRealApplication() {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
      required_skills: ["Node.js"],
      status: "active",
    });
    const candidate = await Candidate.create({ full_name: "Taylor Example", email: `screening-${Date.now()}@test.local` });
    const application = await Application.create({
      job_id: job.id,
      candidate_id: candidate.id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
    });
    return { job, application };
  }

  it("persists a valid completed screening", async () => {
    const { job, application } = await createRealApplication();

    const screening = await AIScreening.create(
      validScreeningInput({ application_id: application._id, job_id: job._id })
    );

    expect(screening._id).toBeDefined();
    expect(screening.application_id.toString()).toBe(application.id);
    expect(screening.job_id.toString()).toBe(job.id);
  });

  it("requires application_id", async () => {
    const input = validScreeningInput();
    delete (input as Record<string, unknown>).application_id;

    await expect(AIScreening.create(input)).rejects.toThrow();
  });

  it("requires job_id", async () => {
    const input = validScreeningInput();
    delete (input as Record<string, unknown>).job_id;

    await expect(AIScreening.create(input)).rejects.toThrow();
  });

  it("persists the analysis structure correctly", async () => {
    const screening = await AIScreening.create(validScreeningInput());

    expect(screening.analysis.summary).toBe(VALID_ANALYSIS.summary);
    expect(screening.analysis.skills[0]?.name).toBe("Node.js");
    expect(screening.analysis.experience.yearsMentioned).toBe(5);
    expect(screening.analysis.experience.summary).toBe(VALID_ANALYSIS.experience.summary);
    expect(screening.analysis.education).toEqual(VALID_ANALYSIS.education);
    expect(screening.analysis.strengths).toEqual(VALID_ANALYSIS.strengths);
    expect(screening.analysis.gaps).toEqual(VALID_ANALYSIS.gaps);
    expect(screening.analysis.requiredSkillEvidence[0]?.skill).toBe("Node.js");
    expect(screening.analysis.requiredSkillEvidence[0]?.status).toBe("found");
  });

  it("persists the match structure correctly", async () => {
    const screening = await AIScreening.create(validScreeningInput());

    expect(screening.match.score).toBe(100);
    expect(screening.match.scorable).toBe(true);
    expect(screening.match.totalRequiredSkills).toBe(1);
    expect(screening.match.foundSkills).toBe(1);
    expect(screening.match.matchedSkills).toEqual(["Node.js"]);
    expect(screening.match.breakdown[0]?.skill).toBe("Node.js");
  });

  it("enforces the match status enum on requiredSkillEvidence and breakdown entries", async () => {
    await expect(
      AIScreening.create(
        validScreeningInput({
          analysis: { ...VALID_ANALYSIS, requiredSkillEvidence: [{ skill: "Node.js", status: "maybe" }] },
        })
      )
    ).rejects.toThrow();

    await expect(
      AIScreening.create(
        validScreeningInput({
          match: { ...VALID_MATCH, breakdown: [{ skill: "Node.js", status: "maybe", weight: 1 }] },
        })
      )
    ).rejects.toThrow();
  });

  it("constrains breakdown weight to exactly 0, 0.5, or 1", async () => {
    await expect(
      AIScreening.create(
        validScreeningInput({
          match: { ...VALID_MATCH, breakdown: [{ skill: "Node.js", status: "found", weight: 0.75 }] },
        })
      )
    ).rejects.toThrow();

    const screening = await AIScreening.create(
      validScreeningInput({
        match: { ...VALID_MATCH, breakdown: [{ skill: "Node.js", status: "unclear", weight: 0.5 }] },
      })
    );
    expect(screening.match.breakdown[0]?.weight).toBe(0.5);
  });

  it("constrains score to 0-100 when non-null", async () => {
    await expect(
      AIScreening.create(validScreeningInput({ match: { ...VALID_MATCH, score: 150 } }))
    ).rejects.toThrow();
    await expect(
      AIScreening.create(validScreeningInput({ match: { ...VALID_MATCH, score: -1 } }))
    ).rejects.toThrow();
  });

  it("allows score to be null when scorable is false", async () => {
    const screening = await AIScreening.create(
      validScreeningInput({
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
      })
    );

    expect(screening.match.score).toBeNull();
    expect(screening.match.scorable).toBe(false);
    expect(screening.match.reason).toBe("no_required_skills");
  });

  it("persists the score_formula_version", async () => {
    const screening = await AIScreening.create(validScreeningInput());
    expect(screening.score_formula_version).toBe("required_skill_coverage_v1");
  });

  it("requires score_formula_version", async () => {
    const input = validScreeningInput();
    delete (input as Record<string, unknown>).score_formula_version;

    await expect(AIScreening.create(input)).rejects.toThrow();
  });

  it("sets created_at automatically and has no updated_at field", async () => {
    const screening = await AIScreening.create(validScreeningInput());

    expect(screening.created_at).toBeInstanceOf(Date);
    expect((screening as unknown as { updated_at?: unknown }).updated_at).toBeUndefined();
  });

  it("does not persist unrecognized fields such as raw CV text or a raw provider response", async () => {
    const screening = await AIScreening.create(
      validScreeningInput({
        cv_text: "This should never be stored.",
        prompt: "system prompt content",
        raw_provider_response: { choices: [{ message: { content: "..." } }] },
        api_key: "gsk_should_never_be_stored",
      })
    );

    const stored = screening.toObject();
    expect(stored).not.toHaveProperty("cv_text");
    expect(stored).not.toHaveProperty("prompt");
    expect(stored).not.toHaveProperty("raw_provider_response");
    expect(stored).not.toHaveProperty("api_key");
  });

  it("has an { application_id: 1, created_at: -1 } index for history queries", () => {
    const indexes = AIScreening.schema.indexes();
    const hasHistoryIndex = indexes.some(
      ([spec]) => spec.application_id === 1 && spec.created_at === -1
    );
    expect(hasHistoryIndex).toBe(true);
  });
});
