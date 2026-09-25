import { Types } from "mongoose";
import { InterviewFeedback, type InterviewFeedbackDoc } from "../../models/InterviewFeedback.model";
import type { InterviewDoc } from "../../models/Interview.model";
import { User } from "../../models/User.model";
import { ConflictError, ForbiddenError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { getAccessibleInterview } from "./interviewAccess.service";
import type { SaveFeedbackDraftInput, SubmitFeedbackInput } from "./interviewFeedback.validation";

const NOT_ASSIGNED_MESSAGE = "Only an interviewer assigned to this interview may submit feedback for it.";
const NOT_COMPLETED_MESSAGE = "Feedback can only be recorded once this interview has been marked as completed.";
const ALREADY_SUBMITTED_MESSAGE = "This feedback has already been submitted and cannot be edited.";

function assertAssignedInterviewer(interview: InterviewDoc, userId: string): void {
  const assigned = interview.interviewer_user_ids.some((id) => id.toString() === userId);
  if (!assigned) {
    throw new ForbiddenError(NOT_ASSIGNED_MESSAGE);
  }
}

export interface FeedbackRosterEntry {
  interviewerId: string;
  name: string;
  email: string;
  record: InterviewFeedbackDoc | null;
}

export interface FeedbackForInterviewResult {
  interview: InterviewDoc;
  roster: FeedbackRosterEntry[];
}

/**
 * Read-only: assembles the full interviewer roster for this Interview
 * (assigned interviewer -> their feedback status/record, or "not_started"
 * if they haven't begun) in two queries total, regardless of how many
 * interviewers are assigned — never one lookup per interviewer. Uses the
 * HISTORICAL access variant (works after Job soft-delete/closure), since
 * feedback is retrospective documentation, not new active pipeline
 * progression (see this ticket's Job lifecycle rules, which only gate
 * completion itself). Draft-vs-submitted visibility shaping happens in
 * interviewFeedback.serializer.ts, not here — this only returns the raw
 * data a caller needs to build that view.
 */
export async function getFeedbackForInterview(interviewId: string, companyId: string): Promise<FeedbackForInterviewResult> {
  const interview = await getAccessibleInterview(interviewId, companyId);
  const interviewerIds = interview.interviewer_user_ids.map((id) => id.toString());

  const records = interviewerIds.length > 0 ? await InterviewFeedback.find({ interview_id: interview.id }) : [];
  const recordByInterviewerId = new Map(records.map((record) => [record.interviewer_user_id.toString(), record]));

  const missingIds = interviewerIds.filter((id) => !recordByInterviewerId.has(id));
  const users = missingIds.length > 0 ? await User.find({ _id: { $in: missingIds } }).select("name email") : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const roster: FeedbackRosterEntry[] = interviewerIds.map((id) => {
    const record = recordByInterviewerId.get(id) ?? null;
    if (record) {
      return { interviewerId: id, name: record.interviewer_snapshot.name, email: record.interviewer_snapshot.email, record };
    }
    const user = userById.get(id);
    return { interviewerId: id, name: user?.name ?? "Unknown", email: user?.email ?? "", record: null };
  });

  return { interview, roster };
}

/**
 * Assigned-interviewer-only, and only once the Interview is completed (see
 * assertAssignedInterviewer / the completed-status gate below — both
 * checked server-side from req.auth.userId, never a client-supplied
 * interviewer_user_id, so no interviewer can impersonate another). A draft
 * may be saved repeatedly; only the fields actually present in `input` are
 * written ($set is built from present keys only), so saving one section
 * never blanks out previously-saved content in another (this ticket's
 * explicit "preserve input" requirement). Once submitted, a record is
 * immutable — this function refuses to touch it further.
 *
 * Race-safety mirrors scheduleInterview()'s own pattern: a fast pre-check
 * (does a record already exist?) for the common case, plus a duplicate-key
 * catch on create as the actual safety net for two concurrent first-saves
 * by the same interviewer (InterviewFeedback.model.ts's unique
 * {interview_id, interviewer_user_id} index is what makes this safe).
 */
export async function saveFeedbackDraft(
  companyId: string,
  userId: string,
  interviewId: string,
  input: SaveFeedbackDraftInput
): Promise<InterviewFeedbackDoc> {
  const interview = await getAccessibleInterview(interviewId, companyId);
  assertAssignedInterviewer(interview, userId);
  if (interview.status !== "completed") {
    throw new ConflictError(NOT_COMPLETED_MESSAGE);
  }

  const setFields: Record<string, unknown> = {};
  if (input.recommendation !== undefined) setFields.recommendation = input.recommendation;
  if (input.summary !== undefined) setFields.summary = input.summary;
  if (input.strengths !== undefined) setFields.strengths = input.strengths;
  if (input.concerns !== undefined) setFields.concerns = input.concerns;
  if (input.private_notes !== undefined) setFields.private_notes = input.private_notes;

  const existing = await InterviewFeedback.findOne({ interview_id: interview.id, interviewer_user_id: userId });
  if (existing) {
    if (existing.status === "submitted") {
      throw new ConflictError(ALREADY_SUBMITTED_MESSAGE);
    }
    if (Object.keys(setFields).length === 0) {
      return existing;
    }
    const updated = await InterviewFeedback.findOneAndUpdate({ _id: existing._id, status: "draft" }, { $set: setFields }, { new: true });
    // Extremely unlikely race (submitted concurrently between our read and
    // this write) — falling back to the pre-write doc is safe for a draft
    // save; there is nothing destructive to roll back.
    return updated ?? existing;
  }

  const user = await User.findById(userId).select("name email");
  try {
    return await InterviewFeedback.create({
      company_id: companyId,
      interview_id: interview.id,
      application_id: interview.application_id,
      interviewer_user_id: userId,
      interviewer_snapshot: { name: user!.name, email: user!.email },
      status: "draft",
      recommendation: setFields.recommendation ?? null,
      summary: setFields.summary ?? "",
      strengths: setFields.strengths ?? "",
      concerns: setFields.concerns ?? "",
      private_notes: setFields.private_notes ?? "",
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Another concurrent draft-save request for this same interviewer
      // already created the record first — apply this save on top of it
      // rather than losing the caller's input.
      const created = await InterviewFeedback.findOne({ interview_id: interview.id, interviewer_user_id: userId });
      if (created && created.status === "draft" && Object.keys(setFields).length > 0) {
        const merged = await InterviewFeedback.findOneAndUpdate({ _id: created._id, status: "draft" }, { $set: setFields }, { new: true });
        return merged ?? created;
      }
      return created!;
    }
    throw err;
  }
}

/**
 * Requires a real recommendation and a meaningful summary (enforced by
 * interviewFeedback.validation.ts's submitFeedbackSchema before this ever
 * runs). Once accepted, status becomes "submitted" and submitted_at is
 * populated; this ticket treats the record as immutable from then on — a
 * second submit attempt (by anyone, including the original author) is
 * rejected as a conflict rather than silently re-writing already-submitted
 * content.
 *
 * Never touches Application.status or Application.current_step_id — see
 * this ticket's Part 17: feedback submission must never move the pipeline,
 * regardless of the recommendation value.
 */
export async function submitFeedback(
  companyId: string,
  userId: string,
  interviewId: string,
  input: SubmitFeedbackInput
): Promise<InterviewFeedbackDoc> {
  const interview = await getAccessibleInterview(interviewId, companyId);
  assertAssignedInterviewer(interview, userId);
  if (interview.status !== "completed") {
    throw new ConflictError(NOT_COMPLETED_MESSAGE);
  }

  const content = {
    recommendation: input.recommendation,
    summary: input.summary,
    strengths: input.strengths ?? "",
    concerns: input.concerns ?? "",
    private_notes: input.private_notes ?? "",
  };

  const existing = await InterviewFeedback.findOne({ interview_id: interview.id, interviewer_user_id: userId });
  if (existing) {
    if (existing.status === "submitted") {
      throw new ConflictError(ALREADY_SUBMITTED_MESSAGE);
    }
    const updated = await InterviewFeedback.findOneAndUpdate(
      { _id: existing._id, status: "draft" },
      { $set: { ...content, status: "submitted", submitted_at: new Date() } },
      { new: true }
    );
    if (!updated) {
      // Race: submitted by a concurrent request between our read and this write.
      throw new ConflictError(ALREADY_SUBMITTED_MESSAGE);
    }
    return updated;
  }

  const user = await User.findById(userId).select("name email");
  try {
    return await InterviewFeedback.create({
      company_id: companyId,
      interview_id: interview.id,
      application_id: interview.application_id,
      interviewer_user_id: userId,
      interviewer_snapshot: { name: user!.name, email: user!.email },
      status: "submitted",
      ...content,
      submitted_at: new Date(),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(ALREADY_SUBMITTED_MESSAGE);
    }
    throw err;
  }
}

export interface FeedbackProgressSummary {
  submitted: number;
  total: number;
}

/**
 * Batches "how many assigned interviewers have submitted feedback" across a
 * whole list of Interviews into ONE aggregation query — never one lookup
 * per Interview. Mirrors interviewNotification.service.ts's
 * batchLatestNotificationStatus exactly. Only ever computed for completed
 * Interviews (a scheduled/cancelled Interview can have no feedback yet by
 * construction), so callers may skip calling this entirely for responses
 * that structurally can't include a completed Interview (e.g. reschedule/
 * cancel, which only ever act on a "scheduled" one).
 */
export async function batchFeedbackProgress(interviews: InterviewDoc[]): Promise<Map<string, FeedbackProgressSummary>> {
  const completedInterviews = interviews.filter((interview) => interview.status === "completed");
  if (completedInterviews.length === 0) {
    return new Map();
  }

  const results = await InterviewFeedback.aggregate<{ _id: Types.ObjectId; submitted: number }>([
    {
      $match: {
        interview_id: { $in: completedInterviews.map((interview) => new Types.ObjectId(interview.id)) },
        status: "submitted",
      },
    },
    { $group: { _id: "$interview_id", submitted: { $sum: 1 } } },
  ]);
  const submittedByInterviewId = new Map(results.map((result) => [result._id.toString(), result.submitted]));

  const progress = new Map<string, FeedbackProgressSummary>();
  for (const interview of completedInterviews) {
    progress.set(interview.id, {
      submitted: submittedByInterviewId.get(interview.id) ?? 0,
      total: interview.interviewer_user_ids.length,
    });
  }
  return progress;
}
