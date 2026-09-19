import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application } from "../src/models/Application.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// This whole test suite mocks the screening pipeline's persistence-layer
// entry points, never real Groq or real R2 — matching the same boundary
// screeningHistory.service.test.ts itself mocks scoreApplicationMatch at.
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
  getLatestApplicationScreening: jest.fn(),
  getApplicationScreeningHistory: jest.fn(),
}));

import {
  createApplicationScreening,
  getApplicationScreeningHistory,
  getLatestApplicationScreening,
} from "../src/services/ai/screeningHistory.service";
import { ApplicationCvExtractionError } from "../src/modules/applications/applicationCvExtraction.service";
import { CvAnalysisError } from "../src/services/ai/cvAnalysis.types";
import { CvStorageError } from "../src/services/storage/cvStorage.service";
import { CvParseError } from "../src/services/cv/cvParser.service";

const mockCreate = createApplicationScreening as jest.Mock;
const mockLatest = getLatestApplicationScreening as jest.Mock;
const mockHistory = getApplicationScreeningHistory as jest.Mock;

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function screeningFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "6aae000000000000000000aa",
    application_id: "6aae000000000000000000bb",
    job_id: "6aae000000000000000000cc",
    analysis: {
      summary: "Backend developer with Node.js and TypeScript experience.",
      skills: [{ name: "Node.js", evidence: "Listed under Skills." }],
      experience: { yearsMentioned: 5, summary: "5 years as a backend developer." },
      education: ["B.Sc. Computer Science"],
      strengths: ["Strong TypeScript background"],
      gaps: ["No mentioned cloud experience"],
      requiredSkillEvidence: [{ skill: "Node.js", status: "found", evidence: "Listed under Skills." }],
    },
    match: {
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
    },
    ai_metadata: { provider: "groq", model: "openai/gpt-oss-120b" },
    score_formula_version: "required_skill_coverage_v1",
    created_at: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("AI Screening API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;

  beforeEach(async () => {
    mockCreate.mockReset();
    mockLatest.mockReset();
    mockHistory.mockReset();
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });
  });

  async function createApplicationFor(company: CompanyDoc, hr: UserDoc) {
    const job = await Job.create({
      company_id: company.id,
      created_by: hr.id,
      title: "Backend Engineer",
      required_skills: ["Node.js"],
      status: "active",
    });
    const candidate = await Candidate.create({
      full_name: "Taylor Example",
      email: `screening-api-${Date.now()}-${Math.random()}@test.local`,
    });
    const application = await Application.create({
      job_id: job.id,
      candidate_id: candidate.id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
    });
    return { job, application };
  }

  function urlFor(applicationId: string, suffix = "") {
    return `/api/v1/applications/${applicationId}/screenings${suffix}`;
  }

  // ===== AUTH =====
  describe("authentication and role authorization", () => {
    it("rejects an unauthenticated POST with 401", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      const res = await request(app).post(urlFor(application.id));
      expect(res.status).toBe(401);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated GET latest with 401", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      const res = await request(app).get(urlFor(application.id, "/latest"));
      expect(res.status).toBe(401);
    });

    it("rejects an unauthenticated GET history with 401", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      const res = await request(app).get(urlFor(application.id));
      expect(res.status).toBe(401);
    });

    it("allows an authenticated HR user to access all three routes", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());
      mockLatest.mockResolvedValueOnce(screeningFixture());
      mockHistory.mockResolvedValueOnce([screeningFixture()]);

      const post = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const latest = await request(app).get(urlFor(application.id, "/latest")).set("Authorization", authHeaderFor(hrA, companyA.id));
      const history = await request(app).get(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(post.status).toBe(201);
      expect(latest.status).toBe(200);
      expect(history.status).toBe(200);
    });

    it("allows an authenticated ADMIN user to access all three routes", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());
      mockLatest.mockResolvedValueOnce(screeningFixture());
      mockHistory.mockResolvedValueOnce([screeningFixture()]);

      const post = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(admin, companyA.id));
      const latest = await request(app).get(urlFor(application.id, "/latest")).set("Authorization", authHeaderFor(admin, companyA.id));
      const history = await request(app).get(urlFor(application.id)).set("Authorization", authHeaderFor(admin, companyA.id));

      expect(post.status).toBe(201);
      expect(latest.status).toBe(200);
      expect(history.status).toBe(200);
    });
    // Note: this system has exactly two roles (HR, ADMIN) — there is no
    // third role to exercise a 403 "wrong role" case against.
  });

  // ===== VALIDATION =====
  describe("request validation", () => {
    it("rejects a malformed applicationId with 400 on POST", async () => {
      const res = await request(app)
        .post(urlFor("not-an-object-id"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects a malformed applicationId with 400 on GET latest", async () => {
      const res = await request(app)
        .get(urlFor("not-an-object-id", "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects a malformed applicationId with 400 on GET history", async () => {
      const res = await request(app)
        .get(urlFor("not-an-object-id"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects a POST body containing client-controlled fields", async () => {
      const { application } = await createApplicationFor(companyA, hrA);

      const res = await request(app)
        .post(urlFor(application.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ score: 100, model: "gpt-4", jobId: "someOtherJob", formulaVersion: "hacked_v2" });

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("accepts a POST with no body at all", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(201);
    });
  });

  // ===== TENANT ISOLATION =====
  describe("company/tenant isolation", () => {
    it("allows HR to screen an application belonging to their own company", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(201);
    });

    it("allows Admin to screen an application belonging to their own company", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin2@a.test", role: "ADMIN" });
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(admin, companyA.id));

      expect(res.status).toBe(201);
    });

    it("returns 404 for a cross-company POST", async () => {
      const { application } = await createApplicationFor(companyB, hrB);

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("returns 404 for a cross-company GET latest", async () => {
      const { application } = await createApplicationFor(companyB, hrB);

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("returns 404 for a cross-company GET history", async () => {
      const { application } = await createApplicationFor(companyB, hrB);

      const res = await request(app).get(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("never calls createApplicationScreening for a cross-company POST (no R2/Groq cost)", async () => {
      const { application } = await createApplicationFor(companyB, hrB);

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 404 for a well-formed but nonexistent applicationId", async () => {
      const missingId = new Types.ObjectId().toString();

      const res = await request(app).post(urlFor(missingId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ===== POST =====
  describe("POST /api/v1/applications/:applicationId/screenings", () => {
    it("calls createApplicationScreening exactly once for a valid request", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());

      await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(application.id);
    });

    it("returns 201 on success", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(201);
    });

    it("returns a response built by the explicit serializer, not a raw Mongoose document", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture());

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(Object.keys(res.body.screening).sort()).toEqual(
        ["id", "application_id", "job_id", "analysis", "match", "ai_metadata", "score_formula_version", "created_at"].sort()
      );
    });

    it("creates another screening on a second explicit POST, never silently reusing the first", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockResolvedValueOnce(screeningFixture({ id: "first-screening" }));
      mockCreate.mockResolvedValueOnce(screeningFixture({ id: "second-screening" }));

      const first = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const second = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(first.body.screening.id).toBe("first-screening");
      expect(second.body.screening.id).toBe("second-screening");
    });

    it("maps a service failure to a safe HTTP error", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(new CvAnalysisError("ai_provider_failure", "AI analysis provider request failed."));

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(503);
    });
  });

  // ===== LATEST =====
  describe("GET /api/v1/applications/:applicationId/screenings/latest", () => {
    it("returns the latest stored screening", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture({ id: "latest-one" }));

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.screening.id).toBe("latest-one");
    });

    it("returns 200 with { screening: null } when none exists", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(null);

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ screening: null });
    });

    it("never calls createApplicationScreening", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      await request(app).get(urlFor(application.id, "/latest")).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ===== HISTORY =====
  describe("GET /api/v1/applications/:applicationId/screenings", () => {
    it("returns history newest first, as provided by the service", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockHistory.mockResolvedValueOnce([screeningFixture({ id: "second" }), screeningFixture({ id: "first" })]);

      const res = await request(app).get(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.screenings.map((s: { id: string }) => s.id)).toEqual(["second", "first"]);
    });

    it("returns [] for empty history", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockHistory.mockResolvedValueOnce([]);

      const res = await request(app).get(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.screenings).toEqual([]);
    });

    it("never calls createApplicationScreening", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockHistory.mockResolvedValueOnce([screeningFixture()]);

      await request(app).get(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ===== SERIALIZATION =====
  describe("response serialization", () => {
    it("includes the analysis HR needs for review", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.screening.analysis.summary).toBeDefined();
      expect(res.body.screening.analysis.skills).toBeDefined();
      expect(res.body.screening.analysis.requiredSkillEvidence).toBeDefined();
    });

    it("includes match score and breakdown", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.screening.match.score).toBe(100);
      expect(res.body.screening.match.breakdown).toEqual([
        { skill: "Node.js", status: "found", weight: 1, evidence: "Listed under Skills." },
      ]);
    });

    it("includes score_formula_version", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.screening.score_formula_version).toBe("required_skill_coverage_v1");
    });

    it("includes safe model/provider metadata", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.screening.ai_metadata).toEqual({ provider: "groq", model: "openai/gpt-oss-120b" });
    });

    it("excludes __v and other internal Mongoose fields", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture({ __v: 0 }));

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.screening).not.toHaveProperty("__v");
    });

    it("excludes the CV storage key", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(JSON.stringify(res.body)).not.toContain("storage_key");
      expect(JSON.stringify(res.body)).not.toContain("talentiq/cvs");
    });

    it("excludes raw CV text, prompt content, and any raw provider response", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain("prompt");
      expect(serialized).not.toContain("choices");
      expect(serialized).not.toContain("system_prompt");
    });

    it("excludes candidate email/phone", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain("@test.local");
      expect(serialized).not.toContain("candidate_id");
      expect(serialized).not.toContain("email");
      expect(serialized).not.toContain("phone");
    });

    it("does not expose authentication fields (token, password hash, etc.)", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockLatest.mockResolvedValueOnce(screeningFixture());

      const res = await request(app)
        .get(urlFor(application.id, "/latest"))
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("token");
    });
  });

  // ===== ERROR SAFETY =====
  describe("error safety", () => {
    it("maps AI-not-configured to a safe error without leaking the underlying message", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(
        new CvAnalysisError("ai_not_configured", "Groq AI is not configured. Set GROQ_API_KEY=some-fake-detail.")
      );

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(503);
      expect(JSON.stringify(res.body)).not.toContain("GROQ_API_KEY");
    });

    it("maps invalid AI JSON/schema output to a safe error", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(new CvAnalysisError("invalid_ai_schema", "AI response did not match the expected schema."));

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(502);
    });

    it("maps a CV-storage failure to a safe error", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(new CvStorageError("provider_error", "Failed to download CV from storage."));

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(503);
    });

    it("maps a CV-parser failure to a safe error", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(new CvParseError("no_extractable_text", "The PDF has no extractable text."));

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(422);
    });

    it("maps a missing-CV condition to a safe error", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(new ApplicationCvExtractionError("no_cv_on_application", "Application has no CV file."));

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(422);
    });

    it("never leaks a raw underlying error message in the response body", async () => {
      const { application } = await createApplicationFor(companyA, hrA);
      mockCreate.mockRejectedValueOnce(
        new CvAnalysisError("ai_provider_failure", "upstream exploded with secret internal trace ABC123")
      );

      const res = await request(app).post(urlFor(application.id)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(JSON.stringify(res.body)).not.toContain("ABC123");
      expect(JSON.stringify(res.body)).not.toContain("secret internal trace");
    });
  });
});
