import type { InterviewFeedbackDoc, InterviewFeedbackStatus } from "../../models/InterviewFeedback.model";
import type { FeedbackForInterviewResult } from "./interviewFeedback.service";

export interface FeedbackInterviewerDTO {
  id: string;
  name: string;
  email: string;
}

export interface InterviewFeedbackDTO {
  id: string;
  interviewer: FeedbackInterviewerDTO;
  status: InterviewFeedbackStatus;
  recommendation: string | null;
  summary: string;
  strengths: string;
  concerns: string;
  private_notes: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Explicit DTO — never a raw Mongoose document. `interviewer` always comes
 * from the record's own frozen interviewer_snapshot (see
 * InterviewFeedback.model.ts), never a fresh User lookup, so historical
 * feedback keeps identifying its author correctly even after that User's
 * name/email later changes. Deliberately excludes company_id/
 * application_id/interview_id (internal relational ids not yet useful to a
 * client here) and __v.
 */
export function serializeInterviewFeedback(doc: InterviewFeedbackDoc): InterviewFeedbackDTO {
  return {
    id: doc.id,
    interviewer: {
      id: doc.interviewer_user_id.toString(),
      name: doc.interviewer_snapshot.name,
      email: doc.interviewer_snapshot.email,
    },
    status: doc.status,
    recommendation: doc.recommendation ?? null,
    summary: doc.summary,
    strengths: doc.strengths,
    concerns: doc.concerns,
    private_notes: doc.private_notes,
    submitted_at: doc.submitted_at ? doc.submitted_at.toISOString() : null,
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
  };
}

export interface InterviewFeedbackRosterEntryDTO {
  interviewer: FeedbackInterviewerDTO;
  status: "not_started" | InterviewFeedbackStatus;
  /** Full content only once submitted — a draft (even an assigned peer's own) is never exposed through this roster entry. */
  feedback: InterviewFeedbackDTO | null;
}

export interface InterviewFeedbackListDTO {
  interviewers: InterviewFeedbackRosterEntryDTO[];
  viewer: {
    /** Whether the authenticated caller is one of this Interview's assigned interviewers. */
    assigned: boolean;
    /** True only when assigned AND the Interview is completed AND the viewer's own record (if any) is still a draft. */
    can_edit: boolean;
    /** The viewer's OWN record (draft or submitted), full content — never another interviewer's draft. Null if the viewer hasn't started feedback (or isn't assigned). */
    feedback: InterviewFeedbackDTO | null;
  };
}

/**
 * Builds the full feedback roster + the viewer's own scoped view in one
 * pass — see interviewFeedback.service.ts's getFeedbackForInterview for how
 * `result.roster` is assembled without N+1 queries. A same-company HR/Admin
 * who is not the viewer only ever sees SUBMITTED entries here; an
 * unfinished draft is never visible to anyone but its author (via
 * `viewer.feedback`), matching this ticket's explicit draft-visibility
 * rule.
 */
export function serializeInterviewFeedbackList(result: FeedbackForInterviewResult, viewerUserId: string): InterviewFeedbackListDTO {
  const ownEntry = result.roster.find((entry) => entry.interviewerId === viewerUserId) ?? null;
  const assigned = ownEntry !== null;
  const ownRecord = ownEntry?.record ?? null;
  const canEdit = assigned && result.interview.status === "completed" && (!ownRecord || ownRecord.status === "draft");

  const interviewers: InterviewFeedbackRosterEntryDTO[] = result.roster.map((entry) => {
    const status: "not_started" | InterviewFeedbackStatus = entry.record?.status ?? "not_started";
    return {
      interviewer: { id: entry.interviewerId, name: entry.name, email: entry.email },
      status,
      feedback: entry.record && entry.record.status === "submitted" ? serializeInterviewFeedback(entry.record) : null,
    };
  });

  return {
    interviewers,
    viewer: {
      assigned,
      can_edit: canEdit,
      feedback: ownRecord ? serializeInterviewFeedback(ownRecord) : null,
    },
  };
}
