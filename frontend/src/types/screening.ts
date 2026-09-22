// Mirrors backend/src/modules/screenings/screening.serializer.ts exactly.
// Keep in sync if the backend serializer changes.
//
// `match.score` is a required-skill-evidence COVERAGE percentage only —
// never render it as a hiring probability, candidate quality, or
// recommendation. See ScoreCoverageCard for the only place it's displayed.
export const SKILL_MATCH_STATUSES = ["found", "not_found", "unclear"] as const;
export type SkillMatchStatus = (typeof SKILL_MATCH_STATUSES)[number];

export interface ScreeningSkill {
  name: string;
  evidence?: string;
}

export interface ScreeningExperience {
  yearsMentioned: number | null;
  summary: string;
}

export interface RequiredSkillEvidence {
  skill: string;
  status: SkillMatchStatus;
  evidence?: string;
}

export interface ScreeningAnalysis {
  summary: string;
  skills: ScreeningSkill[];
  experience: ScreeningExperience;
  education: string[];
  strengths: string[];
  gaps: string[];
  requiredSkillEvidence: RequiredSkillEvidence[];
}

export interface ScreeningMatchBreakdownEntry {
  skill: string;
  status: SkillMatchStatus;
  weight: number;
  evidence?: string;
}

export interface ScreeningMatch {
  score: number | null;
  scorable: boolean;
  reason?: "no_required_skills";
  totalRequiredSkills: number;
  foundSkills: number;
  unclearSkills: number;
  missingSkills: number;
  matchedSkills: string[];
  unclearRequiredSkills: string[];
  missingRequiredSkills: string[];
  breakdown: ScreeningMatchBreakdownEntry[];
}

export interface ScreeningAiMetadata {
  provider: string;
  model?: string;
}

export interface Screening {
  id: string;
  application_id: string;
  job_id: string;
  analysis: ScreeningAnalysis;
  match: ScreeningMatch;
  ai_metadata: ScreeningAiMetadata;
  score_formula_version: string;
  created_at: string;
}

// Mirrors backend screeningRun.service.ts's ReportedScreeningStatus, plus
// "not_started" for a legacy Application that predates automatic
// screening and has never been screened at all — see
// screening.service.ts's getLatestScreening. Screening happens once,
// automatically, right after a candidate applies; this is the current
// state of that ONE initial attempt, never recomputed on read.
//
// "stale_processing" is a DERIVED overlay, never a value the backend
// actually persists: a "processing" run stuck past the configured
// timeout (e.g. a backend crash mid-screening) with no completed result
// yet — recoverable via an explicit Retry, unlike normal "processing".
export const SCREENING_STATUSES = ["not_started", "pending", "processing", "stale_processing", "completed", "failed"] as const;
export type ScreeningStatus = (typeof SCREENING_STATUSES)[number];
