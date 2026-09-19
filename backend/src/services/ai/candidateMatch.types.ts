export type SkillMatchStatus = "found" | "unclear" | "not_found";
export type SkillMatchWeight = 1 | 0.5 | 0;

export interface SkillMatchBreakdownEntry {
  /** The required skill's name exactly as configured on the Job — never the AI's echoed casing. */
  skill: string;
  status: SkillMatchStatus;
  weight: SkillMatchWeight;
  evidence?: string;
}

/**
 * The output of the deterministic, explainable required-skill coverage
 * score.
 *
 * IMPORTANT — what `score` means and does not mean:
 * `score` is the percentage (0-100) of the Job's configured required
 * skills for which the AI's CV analysis found supporting evidence,
 * weighted by how strong that evidence was (found = full weight, unclear
 * = half weight, not_found = no weight). For example, a score of 80 means
 * approximately "80% weighted coverage of the configured required-skill
 * evidence" — NOT "80% chance of being hired", not an employee-quality or
 * performance estimate, not a recommendation, and not a ranking against
 * other candidates. It reflects skill-evidence coverage only; experience,
 * education, strengths, and gaps deliberately do not affect it (see
 * candidateMatch.service.ts for why).
 */
export interface CandidateMatchResult {
  /** null when the Job has no required_skills configured — see `scorable`/`reason`. */
  score: number | null;
  /** false only when there is no meaningful skill-based denominator (zero required_skills). */
  scorable: boolean;
  reason?: "no_required_skills";

  totalRequiredSkills: number;
  foundSkills: number;
  unclearSkills: number;
  missingSkills: number;

  matchedSkills: string[];
  unclearRequiredSkills: string[];
  missingRequiredSkills: string[];

  breakdown: SkillMatchBreakdownEntry[];
}
