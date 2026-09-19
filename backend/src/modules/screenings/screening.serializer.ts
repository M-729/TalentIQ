import type { AIScreeningDoc } from "../../models/AIScreening.model";

export interface SerializedScreening {
  id: string;
  application_id: string;
  job_id: string;
  analysis: {
    summary: string;
    skills: Array<{ name: string; evidence?: string }>;
    experience: { yearsMentioned: number | null; summary: string };
    education: string[];
    strengths: string[];
    gaps: string[];
    requiredSkillEvidence: Array<{ skill: string; status: string; evidence?: string }>;
  };
  match: {
    score: number | null;
    scorable: boolean;
    reason?: string;
    totalRequiredSkills: number;
    foundSkills: number;
    unclearSkills: number;
    missingSkills: number;
    matchedSkills: string[];
    unclearRequiredSkills: string[];
    missingRequiredSkills: string[];
    breakdown: Array<{ skill: string; status: string; weight: number; evidence?: string }>;
  };
  ai_metadata: { provider: string; model?: string };
  score_formula_version: string;
  created_at: string;
}

/**
 * Explicit DTO — never returns a raw Mongoose document. Every field is
 * hand-picked, so nothing added to the AIScreening schema later (and no
 * Mongoose internal like __v or _id) can leak into an HR-facing response
 * without a deliberate change here. Top-level field names follow this
 * codebase's existing snake_case API/model-field convention; the
 * analysis/match sub-objects keep the camelCase already established by
 * CvAnalysisResult/CandidateMatchResult (see cvAnalysis.schema.ts,
 * candidateMatch.types.ts) since AIScreening.model.ts already stores them
 * that way — nothing here renames them either direction.
 *
 * Deliberately excludes everything the ticket calls out: no CV storage
 * key, no CV filename, no signed URL, no prompt, no raw provider
 * response, no API key, no candidate email/phone, no auth data — none of
 * that exists on AIScreeningDoc in the first place (see
 * AIScreening.model.ts), so there is nothing to accidentally include.
 */
export function serializeScreening(doc: AIScreeningDoc): SerializedScreening {
  return {
    id: doc.id,
    application_id: doc.application_id.toString(),
    job_id: doc.job_id.toString(),
    analysis: {
      summary: doc.analysis.summary,
      skills: doc.analysis.skills.map((skill) => ({ name: skill.name, evidence: skill.evidence ?? undefined })),
      experience: {
        yearsMentioned: doc.analysis.experience.yearsMentioned ?? null,
        summary: doc.analysis.experience.summary,
      },
      education: [...doc.analysis.education],
      strengths: [...doc.analysis.strengths],
      gaps: [...doc.analysis.gaps],
      requiredSkillEvidence: doc.analysis.requiredSkillEvidence.map((entry) => ({
        skill: entry.skill,
        status: entry.status,
        evidence: entry.evidence ?? undefined,
      })),
    },
    match: {
      score: doc.match.score ?? null,
      scorable: doc.match.scorable,
      reason: doc.match.reason ?? undefined,
      totalRequiredSkills: doc.match.totalRequiredSkills,
      foundSkills: doc.match.foundSkills,
      unclearSkills: doc.match.unclearSkills,
      missingSkills: doc.match.missingSkills,
      matchedSkills: [...doc.match.matchedSkills],
      unclearRequiredSkills: [...doc.match.unclearRequiredSkills],
      missingRequiredSkills: [...doc.match.missingRequiredSkills],
      breakdown: doc.match.breakdown.map((entry) => ({
        skill: entry.skill,
        status: entry.status,
        weight: entry.weight,
        evidence: entry.evidence ?? undefined,
      })),
    },
    ai_metadata: { provider: doc.ai_metadata.provider, model: doc.ai_metadata.model ?? undefined },
    score_formula_version: doc.score_formula_version,
    // Always set by Mongoose (timestamps: { createdAt: "created_at" }) —
    // the schema-inferred type just doesn't capture that as non-optional.
    created_at: doc.created_at!.toISOString(),
  };
}
