import { Types } from "mongoose";
import { AIScreeningRun } from "../src/models/AIScreeningRun.model";
import { AIScreening } from "../src/models/AIScreening.model";
import { Application } from "../src/models/Application.model";
import { Candidate } from "../src/models/Candidate.model";
import { Job } from "../src/models/Job.model";
import { ConflictError } from "../src/security/AppError";
import { CvAnalysisError } from "../src/services/ai/cvAnalysis.types";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// screeningRun.service.ts calls createApplicationScreening exactly once
// per successful run — mocking it at this boundary (same one
// screening.api.test.ts already uses) lets these tests control
// success/failure precisely without touching CV/R2/Groq at all.
jest.mock("../src/services/ai/screeningHistory.service", () => ({
  createApplicationScreening: jest.fn(),
}));

import { createApplicationScreening } from "../src/services/ai/screeningHistory.service";
import {
  getEffectiveScreeningState,
  reserveScreeningRunForProcessing,
  runAndFinalizeScreening,
  triggerInitialScreeningInBackground,
} from "../src/services/ai/screeningRun.service";

const mockCreate = createApplicationScreening as jest.Mock;

function screeningFixture(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    id: new Types.ObjectId().toString(),
    application_id: new Types.ObjectId(),
    job_id: new Types.ObjectId(),
    analysis: {
      summary: "Solid candidate.",
      skills: [],
      experience: { yearsMentioned: null, summary: "" },
      education: [],
      strengths: [],
      gaps: [],
      requiredSkillEvidence: [],
    },
    match: {
      score: 80,
      scorable: true,
      totalRequiredSkills: 1,
      foundSkills: 1,
      unclearSkills: 0,
      missingSkills: 0,
      matchedSkills: [],
      unclearRequiredSkills: [],
      missingRequiredSkills: [],
      breakdown: [],
    },
    ai_metadata: { provider: "groq", model: "test-model" },
    score_formula_version: "required_skill_coverage_v1",
    created_at: new Date(),
    ...overrides,
  };
}

async function pollUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 2000, intervalMs = 10): Promise<void> {
  const start = Date.now();
  while (!(await predicate())) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("pollUntil: timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe("screeningRun.service", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    mockCreate.mockReset();
    company = await createCompany();
    hr = await createUser({ companyId: company.id, email: "hr@screening-run.test", role: "HR" });
  });

  async function createApplicationFixture() {
    const job = await Job.create({ company_id: company.id, created_by: hr.id, title: "Backend Engineer", status: "active" });
    const candidate = await Candidate.create({
      full_name: "Taylor Example",
      email: `screening-run-${Date.now()}-${Math.random()}@test.local`,
    });
    const application = await Application.create({
      job_id: job.id,
      candidate_id: candidate.id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
    });
    return { job, application };
  }

  // ===== getEffectiveScreeningState (legacy resolution) =====
  describe("getEffectiveScreeningState", () => {
    it("reports not_started when no run row and no screening exist", async () => {
      const { application } = await createApplicationFixture();
      const state = await getEffectiveScreeningState(application.id);
      expect(state.status).toBe("not_started");
      expect(state.run).toBeNull();
    });

    // 11. existing completed screening untouched
    it("reports completed (derived, without creating a row) for a legacy Application with an existing AIScreening but no run row", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreening.create({
        application_id: application.id,
        job_id: job.id,
        analysis: { ...screeningFixture().analysis, experience: { yearsMentioned: 3, summary: "3 years." } },
        match: screeningFixture().match,
        ai_metadata: { provider: "groq" },
        score_formula_version: "required_skill_coverage_v1",
      });

      const state = await getEffectiveScreeningState(application.id);

      expect(state.status).toBe("completed");
      expect(state.run).toBeNull();
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(0);
    });

    it("reports the real run row's own status when one exists", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({ application_id: application.id, job_id: job.id, status: "processing", attempt_count: 1 });

      const state = await getEffectiveScreeningState(application.id);
      expect(state.status).toBe("processing");
      expect(state.run).not.toBeNull();
    });
  });

  // ===== reserveScreeningRunForProcessing (concurrency/one-time guarantee) =====
  describe("reserveScreeningRunForProcessing", () => {
    it("creates a new run row and transitions it to processing on first use", async () => {
      const { application, job } = await createApplicationFixture();

      const run = await reserveScreeningRunForProcessing(application.id, job.id);

      expect(run.status).toBe("processing");
      expect(run.attempt_count).toBe(1);
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(1);
    });

    // 13. completed screening cannot retry
    it("rejects when the run is already completed", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({ application_id: application.id, job_id: job.id, status: "completed", attempt_count: 1 });

      await expect(reserveScreeningRunForProcessing(application.id, job.id)).rejects.toBeInstanceOf(ConflictError);
    });

    // 14. processing screening cannot retry
    it("rejects when the run is already processing", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({ application_id: application.id, job_id: job.id, status: "processing", attempt_count: 1 });

      await expect(reserveScreeningRunForProcessing(application.id, job.id)).rejects.toBeInstanceOf(ConflictError);
    });

    it("allows reservation from a failed state (retry)", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "failed",
        failure_code: "ai_provider_failure",
        attempt_count: 1,
      });

      const run = await reserveScreeningRunForProcessing(application.id, job.id);

      expect(run.status).toBe("processing");
      expect(run.attempt_count).toBe(2);
    });

    // 9/10. duplicate/concurrent trigger protection
    it("only allows one of two concurrent reservation attempts to succeed for a brand-new Application", async () => {
      const { application, job } = await createApplicationFixture();

      const results = await Promise.allSettled([
        reserveScreeningRunForProcessing(application.id, job.id),
        reserveScreeningRunForProcessing(application.id, job.id),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(1);
    });

    it("only allows one of two concurrent reservation attempts to succeed when retrying from failed", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({ application_id: application.id, job_id: job.id, status: "failed", attempt_count: 1 });

      const results = await Promise.allSettled([
        reserveScreeningRunForProcessing(application.id, job.id),
        reserveScreeningRunForProcessing(application.id, job.id),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      expect(fulfilled).toHaveLength(1);
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(1);
    });
  });

  // ===== runAndFinalizeScreening =====
  describe("runAndFinalizeScreening", () => {
    // 15. retry succeeds and produces completed result
    it("marks the run completed and links the produced AIScreening on success", async () => {
      const { application, job } = await createApplicationFixture();
      const run = await reserveScreeningRunForProcessing(application.id, job.id);
      const screening = screeningFixture({ application_id: application._id, job_id: job._id });
      mockCreate.mockResolvedValueOnce(screening);

      const result = await runAndFinalizeScreening(run);

      expect(result).toBe(screening);
      const reread = await AIScreeningRun.findById(run._id);
      expect(reread?.status).toBe("completed");
      expect(reread?.screening_id?.toString()).toBe(screening._id.toString());
      expect(reread?.failure_code).toBeNull();
    });

    // 16. retry failure remains failed / 3. AI failure stored as failed state
    it("marks the run failed with a safe code/message on failure, and re-throws", async () => {
      const { application, job } = await createApplicationFixture();
      const run = await reserveScreeningRunForProcessing(application.id, job.id);
      mockCreate.mockRejectedValueOnce(new CvAnalysisError("ai_provider_failure", "upstream exploded: secret-trace-ABC"));

      await expect(runAndFinalizeScreening(run)).rejects.toThrow();

      const reread = await AIScreeningRun.findById(run._id);
      expect(reread?.status).toBe("failed");
      expect(reread?.failure_code).toBe("ai_provider_failure");
      // 23. provider error sanitized — never the raw underlying message.
      expect(reread?.failure_message).not.toContain("secret-trace-ABC");
      expect(reread?.failure_message).toBe("The AI provider is temporarily unavailable.");
    });

    it("falls back to a generic safe message for an unrecognized error", async () => {
      const { application, job } = await createApplicationFixture();
      const run = await reserveScreeningRunForProcessing(application.id, job.id);
      mockCreate.mockRejectedValueOnce(new Error("some totally unexpected internal failure with secret detail"));

      await expect(runAndFinalizeScreening(run)).rejects.toThrow();

      const reread = await AIScreeningRun.findById(run._id);
      expect(reread?.status).toBe("failed");
      expect(reread?.failure_message).toBe("AI screening could not be completed. Please try again.");
      expect(reread?.failure_message).not.toContain("secret detail");
    });

    // 24. CV extraction error does not remove Application
    it("never removes the Application when the screening fails", async () => {
      const { application, job } = await createApplicationFixture();
      const run = await reserveScreeningRunForProcessing(application.id, job.id);
      mockCreate.mockRejectedValueOnce(new CvAnalysisError("ai_provider_failure", "boom"));

      await expect(runAndFinalizeScreening(run)).rejects.toThrow();

      expect(await Application.findById(application.id)).not.toBeNull();
    });

    // 20. no automatic hiring/pipeline decision
    it("never mutates the Application's status or current_step_id on completion", async () => {
      const { application, job } = await createApplicationFixture();
      const before = await Application.findById(application.id);
      const run = await reserveScreeningRunForProcessing(application.id, job.id);
      mockCreate.mockResolvedValueOnce(screeningFixture({ application_id: application._id, job_id: job._id, match: { ...screeningFixture().match, score: 100 } }));

      await runAndFinalizeScreening(run);

      const after = await Application.findById(application.id);
      expect(after?.status).toBe(before?.status);
      expect(after?.current_step_id).toBe(before?.current_step_id ?? null);
    });
  });

  // ===== triggerInitialScreeningInBackground =====
  describe("triggerInitialScreeningInBackground", () => {
    // 1/4. successful trigger persists a completed screening
    it("eventually persists a completed run for a successful screening", async () => {
      const { application, job } = await createApplicationFixture();
      mockCreate.mockResolvedValueOnce(screeningFixture({ application_id: application._id, job_id: job._id }));

      triggerInitialScreeningInBackground(application.id, job.id);

      await pollUntil(async () => (await AIScreeningRun.findOne({ application_id: application.id }))?.status === "completed");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    // 3. AI failure stored as failed state, never thrown back to the caller
    it("never throws, and persists a failed run when the screening fails", async () => {
      const { application, job } = await createApplicationFixture();
      mockCreate.mockRejectedValueOnce(new CvAnalysisError("ai_provider_failure", "boom"));

      expect(() => triggerInitialScreeningInBackground(application.id, job.id)).not.toThrow();

      await pollUntil(async () => (await AIScreeningRun.findOne({ application_id: application.id }))?.status === "failed");
    });

    // 9. duplicate automatic trigger does not produce a second initial screening
    it("does not produce a second screening when triggered twice for the same Application", async () => {
      const { application, job } = await createApplicationFixture();
      mockCreate.mockResolvedValue(screeningFixture({ application_id: application._id, job_id: job._id }));

      triggerInitialScreeningInBackground(application.id, job.id);
      triggerInitialScreeningInBackground(application.id, job.id);

      await pollUntil(async () => (await AIScreeningRun.findOne({ application_id: application.id }))?.status === "completed");
      // Give the loser's promise chain a chance to settle too, if it hasn't already.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(1);
    });
  });

  // ===== STALE PROCESSING RECOVERY =====
  describe("stale processing recovery", () => {
    // Comfortably inside/outside the default 15-minute
    // AI_SCREENING_PROCESSING_TIMEOUT_MINUTES (env.setup.ts leaves it
    // unset, so the real default applies in this suite).
    function freshAttemptedAt(): Date {
      return new Date(Date.now() - 60 * 1000);
    }
    function staleAttemptedAt(): Date {
      return new Date(Date.now() - 20 * 60 * 1000);
    }

    // 1. fresh processing remains processing
    it("reports a fresh processing run as processing via getEffectiveScreeningState", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: freshAttemptedAt(),
        attempt_count: 1,
      });

      const state = await getEffectiveScreeningState(application.id);
      expect(state.status).toBe("processing");
    });

    // 2. fresh processing cannot Retry
    it("rejects reservation for a fresh processing run", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: freshAttemptedAt(),
        attempt_count: 1,
      });

      await expect(reserveScreeningRunForProcessing(application.id, job.id)).rejects.toBeInstanceOf(ConflictError);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    // 3. stale processing becomes retryable
    it("reports a stale processing run (with no completed screening) as stale_processing", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: staleAttemptedAt(),
        attempt_count: 1,
      });

      const state = await getEffectiveScreeningState(application.id);
      expect(state.status).toBe("stale_processing");
    });

    it("allows reservation to reclaim a stale processing run", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: staleAttemptedAt(),
        attempt_count: 1,
      });

      const reserved = await reserveScreeningRunForProcessing(application.id, job.id);
      expect(reserved.status).toBe("processing");
    });

    // 4. stale retry reuses same AIScreeningRun row / 6. does not create a duplicate run
    it("reuses the SAME AIScreeningRun row when reclaiming a stale run, never creating a second one", async () => {
      const { application, job } = await createApplicationFixture();
      const original = await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: staleAttemptedAt(),
        attempt_count: 1,
      });

      const reserved = await reserveScreeningRunForProcessing(application.id, job.id);

      expect(reserved._id.toString()).toBe(original._id.toString());
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(1);
    });

    // 5. stale retry updates processing_started_at (attempted_at)
    it("updates attempted_at to now, and increments attempt_count, when reclaiming a stale run", async () => {
      const { application, job } = await createApplicationFixture();
      const originalAttemptedAt = staleAttemptedAt();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: originalAttemptedAt,
        attempt_count: 1,
      });

      const before = Date.now();
      const reserved = await reserveScreeningRunForProcessing(application.id, job.id);

      expect(reserved.attempted_at!.getTime()).toBeGreaterThanOrEqual(before);
      expect(reserved.attempted_at!.getTime()).not.toBe(originalAttemptedAt.getTime());
      expect(reserved.attempt_count).toBe(2);
    });

    // 7. concurrent stale retries -> only one reservation wins
    it("only allows one of two concurrent reclaim attempts on the same stale run to succeed", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: staleAttemptedAt(),
        attempt_count: 1,
      });

      const results = await Promise.allSettled([
        reserveScreeningRunForProcessing(application.id, job.id),
        reserveScreeningRunForProcessing(application.id, job.id),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(await AIScreeningRun.countDocuments({ application_id: application.id })).toBe(1);
    });

    // 8. stale run + existing successful AIScreening derives completed
    it("derives completed (not stale_processing) when a completed AIScreening already exists for a stale run", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "processing",
        attempted_at: staleAttemptedAt(),
        attempt_count: 1,
      });
      const screening = await AIScreening.create({
        application_id: application.id,
        job_id: job.id,
        analysis: {
          summary: "Solid candidate.",
          skills: [],
          experience: { yearsMentioned: 3, summary: "3 years." },
          education: [],
          strengths: [],
          gaps: [],
          requiredSkillEvidence: [],
        },
        match: {
          score: 80,
          scorable: true,
          totalRequiredSkills: 1,
          foundSkills: 1,
          unclearSkills: 0,
          missingSkills: 0,
          matchedSkills: [],
          unclearRequiredSkills: [],
          missingRequiredSkills: [],
          breakdown: [],
        },
        ai_metadata: { provider: "groq" },
        score_formula_version: "required_skill_coverage_v1",
      });

      const state = await getEffectiveScreeningState(application.id);
      expect(state.status).toBe("completed");

      // 9. never calls AI again for this case
      await expect(reserveScreeningRunForProcessing(application.id, job.id)).rejects.toBeInstanceOf(ConflictError);
      expect(mockCreate).not.toHaveBeenCalled();

      // Self-healed: the run row itself now reflects the truth, not just the derived read.
      const reread = await AIScreeningRun.findOne({ application_id: application.id });
      expect(reread?.status).toBe("completed");
      expect(reread?.screening_id?.toString()).toBe(screening._id.toString());
    });

    // 13. completed result remains stable — a completed run can never be reclaimed, stale or not.
    it("never reclaims an already-completed run, regardless of attempted_at age", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "completed",
        attempted_at: staleAttemptedAt(),
        attempt_count: 1,
      });

      await expect(reserveScreeningRunForProcessing(application.id, job.id)).rejects.toBeInstanceOf(ConflictError);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    // 14. normal failed retry still works (unaffected by the staleness change)
    it("still allows reclaiming a normal failed run, unrelated to staleness", async () => {
      const { application, job } = await createApplicationFixture();
      await AIScreeningRun.create({
        application_id: application.id,
        job_id: job.id,
        status: "failed",
        failure_code: "ai_provider_failure",
        attempted_at: freshAttemptedAt(),
        attempt_count: 1,
      });

      const reserved = await reserveScreeningRunForProcessing(application.id, job.id);
      expect(reserved.status).toBe("processing");
    });
  });
});
