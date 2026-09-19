import { Application } from "../../models/Application.model";
import { Job } from "../../models/Job.model";
import { ApplicationCvExtractionError } from "../../modules/applications/applicationCvExtraction.service";
import { analyzeApplicationCv } from "./cvAnalysis.service";
import { CvAnalysisError } from "./cvAnalysis.types";
import type { CvAnalysisResult } from "./cvAnalysis.schema";
import type {
  CandidateMatchResult,
  SkillMatchBreakdownEntry,
  SkillMatchStatus,
  SkillMatchWeight,
} from "./candidateMatch.types";

const SKILL_WEIGHTS: Record<SkillMatchStatus, SkillMatchWeight> = {
  found: 1,
  unclear: 0.5,
  not_found: 0,
};

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Pure, deterministic required-skill coverage score. No MongoDB, no
 * Groq, no R2 — this receives already-validated evidence and a Job's
 * required_skills list, and returns a result derived only from that
 * input. Same input always produces the same output.
 *
 * FORMULA (documented here, not hidden):
 *   weight(found) = 1.0, weight(unclear) = 0.5, weight(not_found) = 0.0
 *   score = round( (sum of weights / number of required skills) * 100 )
 *
 * Example: required = [React, TypeScript, Node.js, PostgreSQL], evidence =
 * [found, found, unclear, not_found] → (1 + 1 + 0.5 + 0) / 4 * 100 = 62.5
 * → rounds to 63.
 *
 * Deliberately excludes experience, education, strengths, and gaps —
 * this version is specifically a required-skill EVIDENCE COVERAGE score,
 * not a general candidate quality score. Job.experience_level isn't a
 * structured numeric requirement yet, and AI-reported experience years
 * may be null/ambiguous; inventing a weight for either would not be
 * explainable or repeatable. See candidateMatch.types.ts for what the
 * resulting `score` does and does not mean.
 *
 * The Job's `requiredSkills` list is treated as the source of truth for
 * both which skills are scored and their exact name/casing in the
 * output — AI evidence is only ever looked up against it, never the
 * reverse. This means:
 *   - evidence for a skill that isn't required is ignored (cannot inflate
 *     the score);
 *   - a duplicate evidence entry for the same required skill has its
 *     first occurrence used, deterministically, and any later duplicate
 *     ignored;
 *   - skill names are compared case-insensitively and trimmed ("Node.js"
 *     and " node.js " are the same required skill) — never matched via
 *     fuzzy/semantic aliasing (e.g. "Java" is never treated as evidence
 *     for "JavaScript").
 *
 * Missing evidence for a required skill (the AI analysis is contracted to
 * return exactly one entry per required skill, but this does not trust
 * that blindly) is treated conservatively as "unclear" rather than
 * thrown as an error. This was chosen over a thrown
 * `inconsistent_analysis` error because: (1) a single incomplete AI
 * response then degrades the score gracefully instead of failing the
 * whole scoring call outright; (2) "unclear" is already exactly the
 * status this scoring system uses for "some ambiguity, don't assume
 * either way", which is a faithful description of "we don't actually
 * know if the AI found evidence for this skill"; and (3) the ticket for
 * this feature explicitly prefers avoiding new error types unless
 * necessary.
 */
export function calculateCandidateMatch(
  requiredSkillEvidence: CvAnalysisResult["requiredSkillEvidence"],
  requiredSkills: string[]
): CandidateMatchResult {
  if (requiredSkills.length === 0) {
    return {
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
    };
  }

  const evidenceBySkill = new Map<string, { status: SkillMatchStatus; evidence?: string }>();
  for (const entry of requiredSkillEvidence) {
    const key = normalizeSkillName(entry.skill);
    if (!evidenceBySkill.has(key)) {
      evidenceBySkill.set(key, { status: entry.status, evidence: entry.evidence });
    }
  }

  const breakdown = requiredSkills.map((skill): SkillMatchBreakdownEntry => {
    const matched = evidenceBySkill.get(normalizeSkillName(skill));
    const status: SkillMatchStatus = matched?.status ?? "unclear";
    return { skill, status, weight: SKILL_WEIGHTS[status], evidence: matched?.evidence };
  });

  const totalWeight = breakdown.reduce((sum, entry) => sum + entry.weight, 0);
  const score = Math.round((totalWeight / requiredSkills.length) * 100);

  const byStatus = (status: SkillMatchStatus) => breakdown.filter((entry) => entry.status === status);

  return {
    score,
    scorable: true,
    totalRequiredSkills: requiredSkills.length,
    foundSkills: byStatus("found").length,
    unclearSkills: byStatus("unclear").length,
    missingSkills: byStatus("not_found").length,
    matchedSkills: byStatus("found").map((entry) => entry.skill),
    unclearRequiredSkills: byStatus("unclear").map((entry) => entry.skill),
    missingRequiredSkills: byStatus("not_found").map((entry) => entry.skill),
    breakdown,
  };
}

export interface ApplicationMatchResult {
  match: CandidateMatchResult;
  analysis: CvAnalysisResult;
}

/**
 * Orchestration only: resolves the Application's Job to get
 * `required_skills`, runs the existing AI CV analysis (no AI call happens
 * here directly — analyzeApplicationCv() is the only thing that ever
 * calls aiService.generate()), and feeds its validated
 * requiredSkillEvidence into the pure calculateCandidateMatch() above.
 * Does not persist anything, does not touch the pipeline, and returns no
 * hire/reject signal of any kind.
 *
 * Application/CV/AI-analysis failures are not re-wrapped — they already
 * carry a safe, specific code from their own service and propagate
 * unchanged (same reuse-over-duplication approach as
 * cvAnalysis.service.ts).
 */
export async function scoreApplicationMatch(applicationId: string): Promise<ApplicationMatchResult> {
  const startedAt = Date.now();

  try {
    const application = await Application.findById(applicationId).select("job_id");
    if (!application) {
      throw new ApplicationCvExtractionError("application_not_found", "Application not found.");
    }

    const job = await Job.findById(application.job_id).select("required_skills");
    if (!job) {
      throw new CvAnalysisError("job_not_found", "Job not found for this application.");
    }

    const analysis = await analyzeApplicationCv(applicationId);
    const match = calculateCandidateMatch(analysis.requiredSkillEvidence, job.required_skills);

    console.log("[ai] scored application match", {
      applicationId,
      score: match.score,
      totalRequiredSkills: match.totalRequiredSkills,
      foundSkills: match.foundSkills,
      unclearSkills: match.unclearSkills,
      missingSkills: match.missingSkills,
      durationMs: Date.now() - startedAt,
    });

    return { match, analysis };
  } catch (err) {
    const code = err instanceof Error && "code" in err ? (err as { code: unknown }).code : undefined;
    console.error("[ai] failed to score application match", {
      applicationId,
      code,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}
