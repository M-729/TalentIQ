import type { ApplicationDetail, ApplicationListRow } from "@/types/application";
import type { HiringStep } from "@/types/hiringStep";
import type {
  HiringPipelineApplicationCard,
  HiringPipelineBoard,
  HiringPipelineBoardColumn,
  HiringPipelineNeedsAttentionApplication,
} from "@/types/hiringPipelineBoard";
import type { Screening } from "@/types/screening";

export function buildScreening(overrides: Partial<Screening> = {}): Screening {
  return {
    id: "screening-1",
    application_id: "application-1",
    job_id: "job-1",
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
    created_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function buildApplicationListRow(overrides: Partial<ApplicationListRow> = {}): ApplicationListRow {
  return {
    id: "application-1",
    status: "applied",
    applied_at: "2024-01-15T00:00:00.000Z",
    candidate: {
      id: "candidate-1",
      full_name: "Sarah Ahmed",
      email: "sarah@example.test",
    },
    job: {
      id: "job-1",
      title: "Backend Developer",
      department: "Engineering",
      status: "active",
    },
    screening: { has_screening: false },
    ...overrides,
  };
}

export function buildHiringStep(overrides: Partial<HiringStep> = {}): HiringStep {
  return {
    id: "step-1",
    name: "Application Review",
    type: "review",
    description: null,
    position: 0,
    ...overrides,
  };
}

export function buildHiringPipelineApplicationCard(
  overrides: Partial<HiringPipelineApplicationCard> = {}
): HiringPipelineApplicationCard {
  return {
    id: "application-1",
    candidate: { id: "candidate-1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
    status: "applied",
    applied_at: "2024-01-15T00:00:00.000Z",
    screening: { has_screening: false },
    ...overrides,
  };
}

export function buildHiringPipelineNeedsAttentionApplication(
  overrides: Partial<HiringPipelineNeedsAttentionApplication> = {}
): HiringPipelineNeedsAttentionApplication {
  return {
    ...buildHiringPipelineApplicationCard(),
    current_step_id: null,
    ...overrides,
  };
}

export function buildHiringPipelineBoardColumn(overrides: Partial<HiringPipelineBoardColumn> = {}): HiringPipelineBoardColumn {
  return {
    id: "step-1",
    name: "Application Review",
    type: "review",
    description: null,
    position: 0,
    count: 0,
    applications: [],
    ...overrides,
  };
}

export function buildHiringPipelineBoard(overrides: Partial<HiringPipelineBoard> = {}): HiringPipelineBoard {
  return {
    job: { id: "job-a", title: "Backend Developer", status: "active" },
    unassigned: { count: 0, applications: [] },
    stages: [buildHiringPipelineBoardColumn()],
    needs_attention: [],
    ...overrides,
  };
}

export function buildApplicationDetail(overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: "application-1",
    status: "applied",
    applied_at: "2024-01-15T00:00:00.000Z",
    candidate: {
      id: "candidate-1",
      full_name: "Sarah Ahmed",
      email: "sarah@example.test",
    },
    job: {
      id: "job-1",
      title: "Backend Developer",
      department: "Engineering",
      required_skills: ["Node.js", "TypeScript"],
      status: "active",
    },
    cv: {
      original_name: "resume.pdf",
      mime_type: "application/pdf",
      size_bytes: 253952,
    },
    screening: { has_screening: false },
    ...overrides,
  };
}
