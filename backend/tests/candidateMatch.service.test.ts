import { Types } from "mongoose";
import { Application } from "../src/models/Application.model";
import { Candidate } from "../src/models/Candidate.model";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// The only AI work happens inside analyzeApplicationCv() — mocking it here
// means this file never touches real Groq or real R2 at all: it doesn't
// even import groq-sdk, @aws-sdk/client-s3, aiService, or cvStorage.
// candidateMatch.service.ts itself has no such imports either (see task
// report) — if it ever called aiService.generate() or cvStorage.download()
// directly without them being mocked, the success-path tests below would
// fail outright (GROQ_API_KEY/R2_* are not configured in the test
// environment), which is itself proof no such call happens.
jest.mock("../src/services/ai/cvAnalysis.service", () => {
  const actual = jest.requireActual("../src/services/ai/cvAnalysis.service");
  return { ...actual, analyzeApplicationCv: jest.fn() };
});

import { analyzeApplicationCv } from "../src/services/ai/cvAnalysis.service";
import { scoreApplicationMatch } from "../src/services/ai/candidateMatch.service";
import { CvAnalysisError } from "../src/services/ai/cvAnalysis.types";

const mockAnalyze = analyzeApplicationCv as jest.Mock;

function validAnalysis(requiredSkillEvidence: Array<{ skill: string; status: string; evidence?: string }>) {
  return {
    summary: "Backend developer.",
    skills: [{ name: "Node.js" }],
    experience: { yearsMentioned: 3, summary: "3 years." },
    education: [],
    strengths: [],
    gaps: [],
    requiredSkillEvidence,
  };
}

describe("scoreApplicationMatch", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    mockAnalyze.mockReset();
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@candidate-match.test", role: "HR" });
  });

  async function createApplication(requiredSkills: string[]) {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
      required_skills: requiredSkills,
      status: "active",
    });
    const candidate = await Candidate.create({
      full_name: "Taylor Example",
      email: `candidate-match-${Date.now()}@test.local`,
      phone: "+1-555-000-9999",
    });
    const application = await Application.create({
      job_id: job.id,
      candidate_id: candidate.id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
    });
    return { job, candidate, application };
  }

  it("fails safely with application_not_found for a nonexistent application", async () => {
    const missingId = new Types.ObjectId().toString();

    await expect(scoreApplicationMatch(missingId)).rejects.toMatchObject({
      name: "ApplicationCvExtractionError",
      code: "application_not_found",
    });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("fails safely with job_not_found when the application's job no longer resolves", async () => {
    const candidate = await Candidate.create({ full_name: "No Job", email: "no-job@candidate-match.test" });
    const application = await Application.create({
      job_id: new Types.ObjectId(),
      candidate_id: candidate.id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
    });

    await expect(scoreApplicationMatch(application.id)).rejects.toMatchObject({
      name: "CvAnalysisError",
      code: "job_not_found",
    });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("calls analyzeApplicationCv(applicationId) for the given application", async () => {
    mockAnalyze.mockResolvedValueOnce(validAnalysis([{ skill: "React", status: "found" }]));
    const { application } = await createApplication(["React"]);

    await scoreApplicationMatch(application.id);

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyze).toHaveBeenCalledWith(application.id);
  });

  it("obtains required skills from the correct Job for this application", async () => {
    mockAnalyze.mockResolvedValueOnce(
      validAnalysis([
        { skill: "React", status: "found" },
        { skill: "GraphQL", status: "not_found" },
      ])
    );
    const { application } = await createApplication(["React", "GraphQL"]);

    const { match } = await scoreApplicationMatch(application.id);

    expect(match.totalRequiredSkills).toBe(2);
    expect(match.breakdown.map((e) => e.skill)).toEqual(["React", "GraphQL"]);
  });

  it("returns a deterministic MatchResult for the same input", async () => {
    mockAnalyze.mockResolvedValueOnce(validAnalysis([{ skill: "React", status: "found" }]));
    const { application: appA } = await createApplication(["React"]);
    mockAnalyze.mockResolvedValueOnce(validAnalysis([{ skill: "React", status: "found" }]));
    const { application: appB } = await createApplication(["React"]);

    const resultA = await scoreApplicationMatch(appA.id);
    const resultB = await scoreApplicationMatch(appB.id);

    expect(resultA.match).toEqual(resultB.match);
  });

  it("returns score, analysis, and required-skill metrics together", async () => {
    mockAnalyze.mockResolvedValueOnce(
      validAnalysis([
        { skill: "React", status: "found" },
        { skill: "GraphQL", status: "not_found" },
      ])
    );
    const { application } = await createApplication(["React", "GraphQL"]);

    const result = await scoreApplicationMatch(application.id);

    expect(result.match.score).toBe(50);
    expect(result.analysis.summary).toBe("Backend developer.");
  });

  it("propagates a CV analysis failure unchanged, without re-wrapping it", async () => {
    mockAnalyze.mockRejectedValueOnce(new CvAnalysisError("invalid_ai_schema", "AI response did not match schema."));
    const { application } = await createApplication(["React"]);

    await expect(scoreApplicationMatch(application.id)).rejects.toMatchObject({
      name: "CvAnalysisError",
      code: "invalid_ai_schema",
    });
  });

  it("never sends candidate PII anywhere in the returned result (candidateMatch.service.ts never even reads the Candidate document)", async () => {
    mockAnalyze.mockResolvedValueOnce(validAnalysis([{ skill: "React", status: "found" }]));
    const { application, candidate } = await createApplication(["React"]);

    const result = await scoreApplicationMatch(application.id);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(candidate.email);
    expect(serialized).not.toContain("+1-555-000-9999");
    expect(serialized).not.toContain(candidate.id);
  });

  it("never logs CV/evidence text, candidate PII, or an API key, on success or failure", async () => {
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockAnalyze.mockResolvedValueOnce(
      validAnalysis([{ skill: "React", status: "found", evidence: "Distinctive-Evidence-Marker" }])
    );
    const { application: okApplication, candidate } = await createApplication(["React"]);
    await scoreApplicationMatch(okApplication.id);

    mockAnalyze.mockRejectedValueOnce(new CvAnalysisError("invalid_ai_schema", "AI response did not match schema."));
    const { application: failingApplication } = await createApplication(["React"]);
    await scoreApplicationMatch(failingApplication.id).catch(() => {});

    const allLogged = JSON.stringify([...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]);
    expect(allLogged).not.toContain("Distinctive-Evidence-Marker");
    expect(allLogged).not.toContain(candidate.email);
    expect(allLogged).not.toMatch(/gsk_/);

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
