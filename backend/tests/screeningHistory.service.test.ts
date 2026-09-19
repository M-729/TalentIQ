import { Types } from "mongoose";
import { AIScreening } from "../src/models/AIScreening.model";
import { Application } from "../src/models/Application.model";
import { Candidate } from "../src/models/Candidate.model";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

jest.mock("../src/services/ai/candidateMatch.service", () => {
  const actual = jest.requireActual("../src/services/ai/candidateMatch.service");
  return { ...actual, scoreApplicationMatch: jest.fn() };
});

import { scoreApplicationMatch } from "../src/services/ai/candidateMatch.service";
import {
  createApplicationScreening,
  getApplicationScreeningHistory,
  getLatestApplicationScreening,
  SCORE_FORMULA_VERSION,
} from "../src/services/ai/screeningHistory.service";

const mockScore = scoreApplicationMatch as jest.Mock;

function analysisFixture(evidenceStatus: "found" | "unclear" | "not_found" = "found") {
  return {
    summary: "Backend developer.",
    skills: [{ name: "Node.js" }],
    experience: { yearsMentioned: 3, summary: "3 years." },
    education: [],
    strengths: [],
    gaps: [],
    requiredSkillEvidence: [{ skill: "Node.js", status: evidenceStatus, evidence: "Distinctive-Evidence-Marker" }],
  };
}

function matchFixture(score = 100) {
  return {
    score,
    scorable: true,
    totalRequiredSkills: 1,
    foundSkills: score === 100 ? 1 : 0,
    unclearSkills: 0,
    missingSkills: score === 100 ? 0 : 1,
    matchedSkills: score === 100 ? ["Node.js"] : [],
    unclearRequiredSkills: [],
    missingRequiredSkills: score === 100 ? [] : ["Node.js"],
    breakdown: [{ skill: "Node.js", status: score === 100 ? "found" : "not_found", weight: score === 100 ? 1 : 0 }],
  };
}

describe("screeningHistory.service", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    mockScore.mockReset();
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@screening-history.test", role: "HR" });
  });

  async function createApplication() {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
      required_skills: ["Node.js"],
      status: "active",
    });
    const candidate = await Candidate.create({
      full_name: "Taylor Example",
      email: `screening-history-${Date.now()}@test.local`,
      phone: "+1-555-000-8888",
    });
    const application = await Application.create({
      job_id: job.id,
      candidate_id: candidate.id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
    });
    return { job, candidate, application };
  }

  describe("createApplicationScreening", () => {
    it("calls scoreApplicationMatch(applicationId)", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();

      await createApplicationScreening(application.id);

      expect(mockScore).toHaveBeenCalledTimes(1);
      expect(mockScore).toHaveBeenCalledWith(application.id);
    });

    it("saves a new AIScreening document", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();

      const screening = await createApplicationScreening(application.id);

      const stored = await AIScreening.findById(screening._id);
      expect(stored).not.toBeNull();
    });

    it("takes job_id from the actual Application, not any external input", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application, job } = await createApplication();

      const screening = await createApplicationScreening(application.id);

      expect(screening.job_id.toString()).toBe(job.id);
    });

    it("stores the analysis snapshot from scoreApplicationMatch", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();

      const screening = await createApplicationScreening(application.id);

      expect(screening.analysis.summary).toBe("Backend developer.");
      expect(screening.analysis.requiredSkillEvidence[0]?.skill).toBe("Node.js");
    });

    it("stores the match snapshot from scoreApplicationMatch", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(63) });
      const { application } = await createApplication();

      const screening = await createApplicationScreening(application.id);

      expect(screening.match.score).toBe(63);
    });

    it("stores the centralized score_formula_version constant", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();

      const screening = await createApplicationScreening(application.id);

      expect(screening.score_formula_version).toBe(SCORE_FORMULA_VERSION);
      expect(SCORE_FORMULA_VERSION).toBe("required_skill_coverage_v1");
    });

    it("does not create a document when scoring/AI fails", async () => {
      mockScore.mockRejectedValueOnce(new Error("AI provider request failed."));
      const { application } = await createApplication();

      await expect(createApplicationScreening(application.id)).rejects.toThrow();

      const count = await AIScreening.countDocuments({ application_id: application._id });
      expect(count).toBe(0);
    });

    it("creates two history records on two calls, never overwriting", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(50) });
      const { application } = await createApplication();

      await createApplicationScreening(application.id);
      await createApplicationScreening(application.id);

      const count = await AIScreening.countDocuments({ application_id: application._id });
      expect(count).toBe(2);
    });

    it("leaves the previous screening unchanged after a second run", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(100) });
      const { application } = await createApplication();
      const first = await createApplicationScreening(application.id);

      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(50) });
      await createApplicationScreening(application.id);

      const reread = await AIScreening.findById(first._id);
      expect(reread?.match.score).toBe(100);
    });
  });

  describe("getLatestApplicationScreening", () => {
    it("returns null when no screening exists", async () => {
      const { application } = await createApplication();

      const latest = await getLatestApplicationScreening(application.id);

      expect(latest).toBeNull();
    });

    it("returns the single screening when only one exists", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();
      const created = await createApplicationScreening(application.id);

      const latest = await getLatestApplicationScreening(application.id);

      expect(latest?._id.toString()).toBe(created._id.toString());
    });

    it("returns the newest screening when multiple exist", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(100) });
      const { application } = await createApplication();
      await createApplicationScreening(application.id);

      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(50) });
      const second = await createApplicationScreening(application.id);

      const latest = await getLatestApplicationScreening(application.id);

      expect(latest?._id.toString()).toBe(second._id.toString());
      expect(latest?.match.score).toBe(50);
    });

    it("does not call scoreApplicationMatch (no AI/Groq call on read)", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();
      await createApplicationScreening(application.id);
      mockScore.mockClear();

      await getLatestApplicationScreening(application.id);

      expect(mockScore).not.toHaveBeenCalled();
    });
  });

  describe("getApplicationScreeningHistory", () => {
    it("returns all screenings newest first", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(100) });
      const { application } = await createApplication();
      const first = await createApplicationScreening(application.id);

      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(50) });
      const second = await createApplicationScreening(application.id);

      const history = await getApplicationScreeningHistory(application.id);

      expect(history.map((s) => s._id.toString())).toEqual([second._id.toString(), first._id.toString()]);
    });

    it("returns an empty array when there is no history", async () => {
      const { application } = await createApplication();

      const history = await getApplicationScreeningHistory(application.id);

      expect(history).toEqual([]);
    });

    it("does not call scoreApplicationMatch (no AI/Groq call on read)", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application } = await createApplication();
      await createApplicationScreening(application.id);
      mockScore.mockClear();

      await getApplicationScreeningHistory(application.id);

      expect(mockScore).not.toHaveBeenCalled();
    });

    it("does not recalculate an old stored score", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture(63) });
      const { application } = await createApplication();
      await createApplicationScreening(application.id);

      const historyBefore = await getApplicationScreeningHistory(application.id);
      const historyAfter = await getApplicationScreeningHistory(application.id);

      expect(historyBefore[0]?.match.score).toBe(63);
      expect(historyAfter[0]?.match.score).toBe(63);
    });
  });

  describe("privacy", () => {
    it("never copies candidate PII into the AIScreening document", async () => {
      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application, candidate } = await createApplication();

      const screening = await createApplicationScreening(application.id);

      const serialized = JSON.stringify(screening.toObject());
      expect(serialized).not.toContain(candidate.email);
      expect(serialized).not.toContain("+1-555-000-8888");
      expect(serialized).not.toContain(candidate.full_name);
    });

    it("never logs CV/evidence text, candidate PII, or an API key", async () => {
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      mockScore.mockResolvedValueOnce({ analysis: analysisFixture(), match: matchFixture() });
      const { application, candidate } = await createApplication();
      await createApplicationScreening(application.id);

      mockScore.mockRejectedValueOnce(new Error("AI provider request failed."));
      const { application: failingApplication } = await createApplication();
      await createApplicationScreening(failingApplication.id).catch(() => {});

      const allLogged = JSON.stringify([...consoleLogSpy.mock.calls, ...consoleErrorSpy.mock.calls]);
      expect(allLogged).not.toContain("Distinctive-Evidence-Marker");
      expect(allLogged).not.toContain(candidate.email);
      expect(allLogged).not.toMatch(/gsk_/);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  it("fails safely for a nonexistent application without creating a document", async () => {
    const missingId = new Types.ObjectId().toString();
    mockScore.mockRejectedValueOnce(
      Object.assign(new Error("Application not found."), { name: "ApplicationCvExtractionError", code: "application_not_found" })
    );

    await expect(createApplicationScreening(missingId)).rejects.toMatchObject({
      name: "ApplicationCvExtractionError",
      code: "application_not_found",
    });
    expect(await AIScreening.countDocuments({})).toBe(0);
  });
});
