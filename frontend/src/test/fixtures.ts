import type { ApplicationDetail, ApplicationListRow } from "@/types/application";
import type { HiringStep } from "@/types/hiringStep";
import type {
  HiringPipelineApplicationCard,
  HiringPipelineBoard,
  HiringPipelineBoardColumn,
  HiringPipelineNeedsAttentionApplication,
} from "@/types/hiringPipelineBoard";
import type { Interview, InterviewListRow } from "@/types/interview";
import type { Screening } from "@/types/screening";
import type { ApplicationAssessment, AssessmentHistoryItem, AssessmentListRow, AssessmentNotification } from "@/types/applicationAssessment";
import type { Offer, OfferListRow, OfferNotification } from "@/types/offer";
import type { RejectionInfo, RejectionNotification } from "@/types/rejection";

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
    public_id: "application-1-public",
    status: "applied",
    final_decision: null,
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
    screening: { status: "not_started", has_screening: false },
    current_step: null,
    ...overrides,
  };
}

export function buildHiringStep(overrides: Partial<HiringStep> = {}): HiringStep {
  return {
    id: "step-1",
    public_id: "step-1-public",
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
    public_id: "application-1-public",
    candidate: { id: "candidate-1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
    status: "applied",
    applied_at: "2024-01-15T00:00:00.000Z",
    screening: { status: "not_started", has_screening: false },
    interview_summary: null,
    assessment_summary: null,
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
    public_id: "application-1-public",
    status: "applied",
    final_decision: null,
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
    screening: { status: "not_started", has_screening: false },
    current_step: null,
    ...overrides,
  };
}

export function buildApplicationAssessment(overrides: Partial<ApplicationAssessment> = {}): ApplicationAssessment {
  return {
    id: "assessment-1",
    public_id: "assessment-1-public",
    application_id: "application-1",
    job_id: "job-1",
    hiring_step_id: "step-1",
    name: "Backend Technical Test",
    external_url: "https://external-platform.example/test/abc",
    status: "pending",
    grade: null,
    notes: null,
    sent_at: null,
    result_recorded_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// Defaults to is_current: true — the common case in tests that exercise
// the ACTIVE assessment controls (mirroring the pre-history-feature
// buildApplicationAssessment fixture's own implicit "this is the current
// one" assumption). Pass is_current: false to build a historical item.
export function buildAssessmentHistoryItem(overrides: Partial<AssessmentHistoryItem> = {}): AssessmentHistoryItem {
  return {
    ...buildApplicationAssessment(),
    stage: { id: "step-1", name: "Technical Assessment", type: "assessment" },
    is_current: true,
    email_status: null,
    ...overrides,
  };
}

export function buildAssessmentNotification(overrides: Partial<AssessmentNotification> = {}): AssessmentNotification {
  return {
    id: "assessment-notification-1",
    public_id: "assessment-notification-1-public",
    status: "sent",
    subject: "Assessment Invitation – Backend Developer",
    recipient_email: "sarah@candidate.test",
    attempted_at: "2026-01-02T00:00:00.000Z",
    sent_at: "2026-01-02T00:00:00.000Z",
    failure_code: null,
    attempt_count: 1,
    created_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

export function buildAssessmentListRow(overrides: Partial<AssessmentListRow> = {}): AssessmentListRow {
  return {
    id: "assessment-1",
    public_id: "assessment-1-public",
    application_id: "application-1",
    application_public_id: "app-1-public",
    candidate: { id: "candidate-1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
    job: { id: "job-1", title: "Backend Developer" },
    name: "Backend Technical Test",
    status: "pending",
    grade: null,
    email_status: null,
    application_status: "in_process",
    current_step: { id: "step-1", name: "Technical Assessment", type: "assessment" },
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function buildOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-1",
    public_id: "offer-1-public",
    application_id: "application-1",
    candidate_id: "candidate-1",
    job_id: "job-1",
    status: "draft",
    title: "Backend Engineer",
    salary_amount: 90000,
    salary_currency: "USD",
    employment_type: "Full-time",
    start_date: null,
    expires_at: null,
    candidate_message: null,
    internal_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    sent_at: null,
    accepted_at: null,
    declined_at: null,
    withdrawn_at: null,
    response_source: null,
    responded_at: null,
    responded_by: null,
    ...overrides,
  };
}

export function buildOfferNotification(overrides: Partial<OfferNotification> = {}): OfferNotification {
  return {
    id: "offer-notification-1",
    public_id: "offer-notification-1-public",
    status: "sent",
    subject: "Job Offer – Backend Developer at Acme Recruiting Co",
    recipient_email: "sarah@candidate.test",
    attempted_at: "2026-01-02T00:00:00.000Z",
    sent_at: "2026-01-02T00:00:00.000Z",
    failure_code: null,
    attempt_count: 1,
    created_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

export function buildOfferListRow(overrides: Partial<OfferListRow> = {}): OfferListRow {
  return {
    id: "offer-1",
    public_id: "offer-1-public",
    application_id: "application-1",
    application_public_id: "app-1-public",
    candidate: { id: "candidate-1", full_name: "Sarah Ahmed", email: "sarah@example.test" },
    job: { id: "job-1", title: "Backend Developer" },
    title: "Backend Engineer",
    status: "sent",
    salary_amount: 90000,
    salary_currency: "USD",
    start_date: null,
    sent_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

export function buildRejectionInfo(overrides: Partial<RejectionInfo> = {}): RejectionInfo {
  return {
    rejected_at: "2026-01-03T00:00:00.000Z",
    rejected_by: { id: "user-1", name: "Hana HR" },
    rejection_reason: null,
    email_status: null,
    ...overrides,
  };
}

export function buildRejectionNotification(overrides: Partial<RejectionNotification> = {}): RejectionNotification {
  return {
    id: "rejection-notification-1",
    status: "sent",
    subject: "Update on your application – Backend Developer",
    recipient_email: "sarah@candidate.test",
    attempted_at: "2026-01-03T00:00:00.000Z",
    sent_at: "2026-01-03T00:00:00.000Z",
    failure_code: null,
    attempt_count: 1,
    created_at: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

export function buildInterview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: "interview-1",
    public_id: "interview-1-public",
    title: "Technical Interview",
    stage: { id: "step-1", name: "Technical Interview", type: "interview" },
    starts_at: "2024-02-01T10:00:00.000Z",
    ends_at: "2024-02-01T11:00:00.000Z",
    timezone: "Asia/Beirut",
    status: "scheduled",
    interviewers: [{ id: "user-1", name: "Alex Interviewer", email: "alex@example.test" }],
    scheduled_by: { id: "user-2", name: "Hana HR" },
    cancellation: null,
    completion: null,
    calendar: null,
    latest_notification: null,
    feedback_progress: null,
    created_at: "2024-01-20T00:00:00.000Z",
    updated_at: "2024-01-20T00:00:00.000Z",
    ...overrides,
  };
}

export function buildInterviewListRow(overrides: Partial<InterviewListRow> = {}): InterviewListRow {
  return {
    ...buildInterview(),
    candidate: { id: "candidate-1", name: "Sarah Ahmed", email: "sarah@example.test" },
    job: { id: "job-1", title: "Backend Developer" },
    ...overrides,
  };
}
