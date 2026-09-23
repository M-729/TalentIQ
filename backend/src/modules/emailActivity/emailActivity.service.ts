import { Types, type PipelineStage } from "mongoose";
import { EmailNotification, type EmailNotificationCategory } from "../../models/EmailNotification.model";
import { CompanyInvitation } from "../../models/CompanyInvitation.model";
import { escapeRegExp } from "../../utils/regex";
import { emailActivityTypeLabel, type EmailActivityRowDTO, type EmailActivityListDTO } from "./emailActivity.serializer";
import type { ListEmailActivityQuery } from "./emailActivity.validation";

const EMAIL_NOTIFICATION_CATEGORY_SET = new Set<string>([
  "interview_scheduled",
  "interview_rescheduled",
  "interview_cancelled",
  "assessment_invitation",
  "application_rejection",
  "offer_sent",
]);

/**
 * Company-scoped, read-only, unified Email Activity feed — combines two
 * genuinely different sources (see this ticket's explicit Part 6 rule
 * against forcing CompanyInvitation into EmailNotification):
 *
 *  - EmailNotification: every recruitment-domain email (interview/
 *    assessment/rejection/offer). Directly company-scoped.
 *  - CompanyInvitation: team-invitation emails, tracked via its own
 *    email_status/email_sent_at/email_failure_code/email_attempt_count
 *    fields (see CompanyInvitation.model.ts's own doc comment for why
 *    these were never forced into EmailNotification's required
 *    application_id/candidate_id shape). Directly company-scoped.
 *
 * True server-side pagination across BOTH sources uses a single Mongo
 * aggregation with $unionWith (never "fetch everything from both, sort/
 * paginate in JS") — each branch is normalized into a common shape by its
 * own $project BEFORE the union, sorted on one shared `activity_at` field
 * (sent_at, falling back to attempted_at, falling back to created_at —
 * i.e. "the most recent real thing that happened to this email"), then a
 * single $facet does skip/limit + a count together. When `type` narrows
 * the request to only one source, the OTHER branch is skipped entirely
 * (no $unionWith at all) rather than wastefully unioning in a
 * known-empty branch.
 *
 * related_label is built from each EmailNotification row's own immutable
 * snapshot (event_snapshot/assessment_snapshot/rejection_snapshot/
 * offer_snapshot) — every category's snapshot already carries
 * candidate_name + job_title, so this never requires an extra
 * Application/Candidate/Job lookup per row.
 */
export async function listEmailActivity(companyId: string, query: ListEmailActivityQuery): Promise<EmailActivityListDTO> {
  const companyObjectId = new Types.ObjectId(companyId);
  const includeEmailNotifications = !query.type || EMAIL_NOTIFICATION_CATEGORY_SET.has(query.type);
  const includeCompanyInvitations = !query.type || query.type === "company_invitation";

  const searchPattern = query.search ? new RegExp(escapeRegExp(query.search), "i") : null;
  const dateFilter: Record<string, Date> = {};
  if (query.date_from) dateFilter.$gte = query.date_from;
  if (query.date_to) dateFilter.$lte = query.date_to;

  const emailNotificationMatch: Record<string, unknown> = { company_id: companyObjectId };
  if (query.type && EMAIL_NOTIFICATION_CATEGORY_SET.has(query.type)) {
    emailNotificationMatch.category = query.type as EmailNotificationCategory;
  }
  if (query.status) emailNotificationMatch.status = query.status;
  if (searchPattern) emailNotificationMatch.recipient_email = searchPattern;
  if (Object.keys(dateFilter).length) emailNotificationMatch.created_at = dateFilter;

  const companyInvitationMatch: Record<string, unknown> = { company_id: companyObjectId };
  if (query.status) companyInvitationMatch.email_status = query.status;
  if (searchPattern) companyInvitationMatch.email = searchPattern;
  if (Object.keys(dateFilter).length) companyInvitationMatch.created_at = dateFilter;

  const emailNotificationProject = {
    $project: {
      source: { $literal: "email_notification" },
      type: "$category",
      recipient_email: 1,
      status: 1,
      sent_at: 1,
      created_at: 1,
      updated_at: 1,
      activity_at: { $ifNull: ["$sent_at", { $ifNull: ["$attempted_at", "$created_at"] }] },
      application_id: 1,
      interview_id: 1,
      application_assessment_id: 1,
      offer_id: 1,
      event_snapshot: 1,
      assessment_snapshot: 1,
      rejection_snapshot: 1,
      offer_snapshot: 1,
      invitation_role: "$$REMOVE",
    },
  };

  const companyInvitationProject = {
    $project: {
      source: { $literal: "company_invitation" },
      type: { $literal: "company_invitation" },
      recipient_email: "$email",
      status: "$email_status",
      sent_at: "$email_sent_at",
      created_at: 1,
      updated_at: 1,
      activity_at: { $ifNull: ["$email_sent_at", { $ifNull: ["$email_attempted_at", "$created_at"] }] },
      application_id: "$$REMOVE",
      interview_id: "$$REMOVE",
      application_assessment_id: "$$REMOVE",
      offer_id: "$$REMOVE",
      event_snapshot: "$$REMOVE",
      assessment_snapshot: "$$REMOVE",
      rejection_snapshot: "$$REMOVE",
      offer_snapshot: "$$REMOVE",
      invitation_role: "$role",
    },
  };

  let pipeline: PipelineStage[];
  if (includeEmailNotifications && includeCompanyInvitations) {
    pipeline = [
      { $match: emailNotificationMatch },
      emailNotificationProject,
      {
        $unionWith: {
          coll: CompanyInvitation.collection.name,
          pipeline: [{ $match: companyInvitationMatch }, companyInvitationProject],
        },
      },
    ];
  } else if (includeEmailNotifications) {
    pipeline = [{ $match: emailNotificationMatch }, emailNotificationProject];
  } else {
    pipeline = [{ $match: companyInvitationMatch }, companyInvitationProject];
  }

  pipeline.push(
    { $sort: { activity_at: -1, _id: -1 } },
    {
      $facet: {
        rows: [{ $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
        totalCount: [{ $count: "count" }],
      },
    }
  );

  const model = includeEmailNotifications ? EmailNotification : CompanyInvitation;
  const [result] = await model.aggregate<{ rows: RawUnifiedRow[]; totalCount: [{ count: number }] | [] }>(pipeline);

  const rows = result?.rows ?? [];
  const total = result?.totalCount[0]?.count ?? 0;

  return {
    emails: rows.map(serializeRow),
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

interface SnapshotLike {
  candidate_name?: string;
  job_title?: string;
}

interface RawUnifiedRow {
  _id: Types.ObjectId;
  source: "email_notification" | "company_invitation";
  type: string;
  recipient_email: string;
  status: "pending" | "sent" | "failed";
  sent_at: Date | null;
  updated_at: Date;
  application_id?: Types.ObjectId;
  interview_id?: Types.ObjectId | null;
  application_assessment_id?: Types.ObjectId;
  offer_id?: Types.ObjectId;
  event_snapshot?: SnapshotLike | null;
  assessment_snapshot?: SnapshotLike | null;
  rejection_snapshot?: SnapshotLike | null;
  offer_snapshot?: SnapshotLike | null;
  invitation_role?: string;
}

function buildRelatedLabel(row: RawUnifiedRow): string {
  if (row.source === "company_invitation") {
    return row.invitation_role ? `Invited as ${row.invitation_role}` : "Team invitation";
  }
  const snapshot = row.event_snapshot ?? row.assessment_snapshot ?? row.rejection_snapshot ?? row.offer_snapshot;
  if (!snapshot) return "—";
  const parts = [snapshot.candidate_name, snapshot.job_title].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" — ") : "—";
}

function serializeRow(row: RawUnifiedRow): EmailActivityRowDTO {
  const type = row.type as EmailActivityRowDTO["type"];
  return {
    id: row._id.toString(),
    source: row.source,
    type,
    type_label: emailActivityTypeLabel(type),
    recipient_email: row.recipient_email,
    status: row.status,
    sent_at: row.sent_at ? row.sent_at.toISOString() : null,
    updated_at: row.updated_at.toISOString(),
    related_label: buildRelatedLabel(row),
    related_application_id: row.application_id ? row.application_id.toString() : undefined,
    related_interview_id: row.interview_id ? row.interview_id.toString() : undefined,
    related_offer_id: row.offer_id ? row.offer_id.toString() : undefined,
    related_assessment_id: row.application_assessment_id ? row.application_assessment_id.toString() : undefined,
    related_invitation_id: row.source === "company_invitation" ? row._id.toString() : undefined,
  };
}
