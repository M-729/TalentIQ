import { Application } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { HiringStep } from "../../models/HiringStep.model";
import { Interview } from "../../models/Interview.model";
import { InterviewFeedback } from "../../models/InterviewFeedback.model";
import { Offer } from "../../models/Offer.model";
import { ApplicationAssessment } from "../../models/ApplicationAssessment.model";
import { EmailNotification } from "../../models/EmailNotification.model";
import { CompanyInvitation } from "../../models/CompanyInvitation.model";
import { Job } from "../../models/Job.model";
import { companyFilter } from "../../security/companyScope";
import { resolveCompanyJobScope } from "../reporting/reporting.service";
import {
  serializeDashboardApplicationRow,
  serializeDashboardInterviewRow,
  type DashboardDTO,
} from "./dashboard.serializer";

const RECENT_APPLICATIONS_LIMIT = 5;
const UPCOMING_INTERVIEWS_LIMIT = 5;
const OFFERS_EXPIRING_SOON_DAYS = 7;

/**
 * "What needs my attention today" — one company-scoped read. Every
 * metric/list here is defined once, explicitly, and documented at its own
 * query (see this ticket's Part 3 "define every KPI explicitly and
 * consistently" rule):
 *
 * - open_jobs: Job.status === "active" among this company's non-deleted Jobs.
 * - new_applicants: Application.status === "applied" AND current_step_id
 *   === null — the exact same "unassigned" definition
 *   hiringPipelineBoard.service.ts's board uses for its own "New
 *   Applicants" virtual column, reused here rather than redefined.
 * - upcoming_interviews: Interview.status === "scheduled" with
 *   starts_at in the future.
 * - pending_offers: Offer.status === "sent" (awaiting the candidate's response).
 * - hired: Application.status === "hired" (all-time, not time-windowed —
 *   this ticket's own Part 3 gives no time window for this KPI).
 *
 * Application and Interview have no direct company_id (see
 * security/companyScope.ts's "indirectly-owned" pattern) — every count/
 * list touching them is scoped through resolveCompanyJobScope's job id
 * list, resolved ONCE and reused, never per-metric.
 */
export async function getDashboard(companyId: string): Promise<DashboardDTO> {
  const { jobIds, openJobsCount } = await resolveCompanyJobScope(companyId);
  const now = new Date();
  const expiringSoonThreshold = new Date(now.getTime() + OFFERS_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

  const [
    newApplicantsCount,
    upcomingInterviewsCount,
    pendingOffersCount,
    hiredCount,
    failedEmailNotificationsCount,
    failedInvitationEmailsCount,
    assessmentsAwaitingResultCount,
    offersExpiringSoonCount,
    recentApplications,
    upcomingInterviewDocs,
    completedInterviewsForFeedback,
  ] = await Promise.all([
    Application.countDocuments({ job_id: { $in: jobIds }, status: "applied", current_step_id: null }),
    Interview.countDocuments({ job_id: { $in: jobIds }, status: "scheduled", starts_at: { $gte: now } }),
    Offer.countDocuments({ ...companyFilter(companyId), status: "sent" }),
    Application.countDocuments({ job_id: { $in: jobIds }, status: "hired" }),
    EmailNotification.countDocuments({ ...companyFilter(companyId), status: "failed" }),
    CompanyInvitation.countDocuments({ ...companyFilter(companyId), email_status: "failed" }),
    ApplicationAssessment.countDocuments({ ...companyFilter(companyId), status: "pending" }),
    Offer.countDocuments({
      ...companyFilter(companyId),
      status: "sent",
      expires_at: { $gte: now, $lte: expiringSoonThreshold },
    }),
    Application.find({ job_id: { $in: jobIds } }).sort({ applied_at: -1 }).limit(RECENT_APPLICATIONS_LIMIT),
    Interview.find({ job_id: { $in: jobIds }, status: "scheduled", starts_at: { $gte: now } })
      .sort({ starts_at: 1 })
      .limit(UPCOMING_INTERVIEWS_LIMIT),
    Interview.find({ job_id: { $in: jobIds }, status: "completed" }).select("interviewer_user_ids"),
  ]);

  // interviews_awaiting_feedback: a completed Interview where not every
  // assigned interviewer has SUBMITTED feedback yet — one batched
  // aggregation across every completed Interview, never one query per
  // Interview. Mirrors hiringPipelineBoard.service.ts's own
  // feedback_submitted_count/feedback_total_count comparison.
  const completedInterviewIds = completedInterviewsForFeedback.map((interview) => interview._id);
  const submittedCounts = completedInterviewIds.length
    ? await InterviewFeedback.aggregate<{ _id: unknown; count: number }>([
        { $match: { interview_id: { $in: completedInterviewIds }, status: "submitted" } },
        { $group: { _id: "$interview_id", count: { $sum: 1 } } },
      ])
    : [];
  const submittedCountByInterviewId = new Map(submittedCounts.map((row) => [String(row._id), row.count]));
  const interviewsAwaitingFeedbackCount = completedInterviewsForFeedback.filter(
    (interview) => (submittedCountByInterviewId.get(interview.id) ?? 0) < interview.interviewer_user_ids.length
  ).length;

  // ===== Batched resolution for recent_applications + upcoming_interviews =====
  const applicationCandidateIds = recentApplications.map((application) => application.candidate_id.toString());
  const applicationJobIds = recentApplications.map((application) => application.job_id.toString());
  const applicationStepIds = recentApplications
    .filter((application) => application.current_step_id)
    .map((application) => application.current_step_id!.toString());

  const interviewApplicationIds = [...new Set(upcomingInterviewDocs.map((interview) => interview.application_id.toString()))];
  const interviewJobIds = upcomingInterviewDocs.map((interview) => interview.job_id.toString());

  const [
    applicationCandidates,
    applicationJobs,
    currentSteps,
    interviewApplications,
    interviewJobs,
  ] = await Promise.all([
    Candidate.find({ _id: { $in: [...new Set(applicationCandidateIds)] } }),
    Job.find({ _id: { $in: [...new Set(applicationJobIds)] } }),
    applicationStepIds.length ? HiringStep.find({ _id: { $in: [...new Set(applicationStepIds)] } }) : Promise.resolve([]),
    Application.find({ _id: { $in: interviewApplicationIds } }).select("candidate_id"),
    Job.find({ _id: { $in: [...new Set(interviewJobIds)] } }),
  ]);

  const candidateById = new Map(applicationCandidates.map((candidate) => [candidate.id, candidate]));
  const jobById = new Map(applicationJobs.map((job) => [job.id, job]));
  const stepById = new Map(currentSteps.map((step) => [step.id, step]));

  const recentApplicationRows = recentApplications
    .map((application) => {
      const candidate = candidateById.get(application.candidate_id.toString());
      const job = jobById.get(application.job_id.toString());
      if (!candidate || !job) return null;
      const step = application.current_step_id ? (stepById.get(application.current_step_id.toString()) ?? null) : null;
      return serializeDashboardApplicationRow(application, candidate, job, step);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const interviewJobById = new Map(interviewJobs.map((job) => [job.id, job]));
  const candidateIdByApplicationId = new Map(
    interviewApplications.map((application) => [application.id, application.candidate_id.toString()])
  );
  const interviewCandidateIds = [...new Set(interviewApplications.map((application) => application.candidate_id.toString()))];
  const interviewCandidates = interviewCandidateIds.length ? await Candidate.find({ _id: { $in: interviewCandidateIds } }) : [];
  const interviewCandidateById = new Map(interviewCandidates.map((candidate) => [candidate.id, candidate]));

  const upcomingInterviewRows = upcomingInterviewDocs
    .map((interview) => {
      const candidateId = candidateIdByApplicationId.get(interview.application_id.toString());
      const candidate = candidateId ? interviewCandidateById.get(candidateId) : undefined;
      const job = interviewJobById.get(interview.job_id.toString());
      if (!candidate || !job) return null;
      return serializeDashboardInterviewRow(interview, candidate, job);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    metrics: {
      open_jobs: openJobsCount,
      new_applicants: newApplicantsCount,
      upcoming_interviews: upcomingInterviewsCount,
      pending_offers: pendingOffersCount,
      hired: hiredCount,
    },
    recent_applications: recentApplicationRows,
    upcoming_interviews: upcomingInterviewRows,
    attention: {
      failed_emails: failedEmailNotificationsCount + failedInvitationEmailsCount,
      assessments_awaiting_result: assessmentsAwaitingResultCount,
      interviews_awaiting_feedback: interviewsAwaitingFeedbackCount,
      offers_awaiting_response: pendingOffersCount,
      offers_expiring_soon: offersExpiringSoonCount,
    },
  };
}
