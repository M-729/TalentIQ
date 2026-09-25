import mongoose from "mongoose";
import {
  EmailNotification,
  emailNotificationIdentifierFilter,
  type EmailNotificationDoc,
  type OfferSnapshot,
} from "../../models/EmailNotification.model";
import { Offer, offerIdentifierFilter, type OfferDoc } from "../../models/Offer.model";
import { Application } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { attemptEmailDelivery } from "../../services/email/emailNotificationDelivery.service";
import type { EmailContent } from "../../services/email/email.types";
import { buildOfferSentEmail } from "../../services/email/templates/offerSent.template";
import { generateOfferResponseToken } from "./offerResponseToken.service";
import { env } from "../../config/env";

const NOT_RETRYABLE_MESSAGE = "Only failed notifications can be retried.";
const JOB_DELETED_MESSAGE = "Job not found";
const NOT_DRAFT_MESSAGE = "Only a draft offer can be sent.";
const SEND_CONFLICT_MESSAGE = "This offer was just sent or updated by someone else. Please refresh and try again.";

interface OfferEmailContext {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
}

async function resolveOfferEmailContext(offer: OfferDoc): Promise<OfferEmailContext | null> {
  const [candidate, job] = await Promise.all([
    Candidate.findById(offer.candidate_id).select("full_name email"),
    Job.findById(offer.job_id).select("title company_id"),
  ]);
  if (!candidate || !job) return null;

  const company = await Company.findById(job.company_id).select("name");

  return {
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    jobTitle: job.title,
    companyName: company?.name ?? "the hiring company",
  };
}

/**
 * Freezes the facts THIS ONE email event actually says, at the exact
 * moment "Send Offer" is clicked — see EmailNotification.model.ts's
 * offerSnapshotSchema doc comment. Deliberately excludes internal_notes
 * (see this ticket's explicit Part 9 rule) — that field has no place in
 * this shape at all.
 */
function buildOfferSnapshot(offer: OfferDoc, ctx: OfferEmailContext): OfferSnapshot {
  return {
    candidate_name: ctx.candidateName,
    company_name: ctx.companyName,
    job_title: ctx.jobTitle,
    offer_title: offer.title,
    salary_amount: offer.salary_amount ?? null,
    salary_currency: offer.salary_currency ?? null,
    start_date: offer.start_date ?? null,
    expires_at: offer.expires_at ?? null,
    candidate_message: offer.candidate_message ?? null,
  };
}

/** "September 23, 2026" in UTC — Offer dates are plain calendar dates with no associated timezone (unlike Interview.starts_at/ends_at), so this always renders the same regardless of server timezone. */
function formatUtcDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(date);
}

function formatSalaryLabel(amount: number | null, currency: string | null): string | null {
  if (amount == null || !currency) return null;
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

/**
 * The public candidate response page, with the token in a URL FRAGMENT
 * (never a query/path segment) — see this ticket's explicit Part 4
 * preference: a fragment is never sent to any web server (frontend or
 * backend) as part of the initial HTTP request/page load, only ever read
 * client-side by the browser's own JS, which keeps the opaque token out of
 * server access logs merely from the candidate opening the email link.
 */
export function buildOfferResponseUrl(token: string, decision: "accept" | "decline"): string {
  return `${env.FRONTEND_URL}/offer-response#token=${encodeURIComponent(token)}&decision=${decision}`;
}

/**
 * Renders the candidate email from the Offer's frozen, immutable business
 * snapshot PLUS a pair of freshly-generated response URLs — the URLs are
 * NEVER part of the snapshot itself (see EmailNotification.model.ts's
 * offerSnapshotSchema and this ticket's explicit Part 11 "do not persist
 * plaintext token or tokenized URLs in the immutable business snapshot"
 * rule): a token is delivery/security infrastructure for ONE specific
 * email event, not historical business content, so it's passed in fresh
 * by each caller (sendOffer for the initial send, retryOfferNotification
 * for every retry) rather than ever being read back off a persisted
 * snapshot.
 */
function buildContentFromSnapshot(snapshot: OfferSnapshot, responseUrls: { acceptUrl: string; declineUrl: string }): EmailContent {
  return buildOfferSentEmail({
    candidateName: snapshot.candidate_name,
    companyName: snapshot.company_name,
    jobTitle: snapshot.job_title,
    offerTitle: snapshot.offer_title,
    salaryLabel: formatSalaryLabel(snapshot.salary_amount ?? null, snapshot.salary_currency ?? null),
    startDateLabel: snapshot.start_date ? formatUtcDate(snapshot.start_date) : null,
    expiresAtLabel: snapshot.expires_at ? formatUtcDate(snapshot.expires_at) : null,
    candidateMessage: snapshot.candidate_message ?? null,
    acceptUrl: responseUrls.acceptUrl,
    declineUrl: responseUrls.declineUrl,
  });
}

/**
 * Explicit "Send Offer" action — HR/Admin only, never triggered
 * automatically by creating/editing the Draft (see this ticket's explicit
 * Part 9 "Creation of a Draft offer does NOT automatically email anyone"
 * rule). Blocked once the Job is soft-deleted (a new send is an active
 * hiring-workflow action, same lifecycle rule as
 * applicationAssessmentEmail.service.ts's sendAssessmentInvitation); NOT
 * blocked for a merely closed Job.
 *
 * Contract (documented explicitly, per this ticket's Part 10 "do not
 * pretend SMTP is exactly-once" instruction, and hardened by a real
 * production bug report — see below): the Offer transitions draft -> sent,
 * Application.status transitions to "offered", AND the EmailNotification
 * "pending" row for this send event are all created together, inside ONE
 * transaction, guarded by the exact {_id, status:"draft"} this call
 * observed (the same optimistic-concurrency shape moveApplicationStage
 * uses). This is what protects against a double "Send Offer" click (only
 * one concurrent request's guard can ever match) AND against the
 * historical bug this fixes: EmailNotification.create() used to run AFTER
 * this transaction committed, so if that create() ever threw for any
 * reason (a transient DB error, unexpected validation failure, etc.) the
 * Offer/Application had ALREADY committed to "sent"/"offered" with zero
 * notification ever persisted — a permanently stuck "Not sent" state with
 * no way to retry (the Offer was no longer "draft", and there was no
 * notification row to retry). Creating the row INSIDE the same transaction
 * makes that state structurally impossible: either all three writes commit
 * together, or none do (the whole request throws and the Offer stays
 * "draft", so HR can simply click "Send Offer" again).
 *
 * SMTP delivery itself is still attempted AFTER the transaction commits —
 * this remains genuinely best-effort (per this ticket's explicit "do not
 * introduce a queue" instruction) and its outcome (sent vs failed) is
 * recorded on the already-persisted EmailNotification row only, never
 * reverting the Offer back to "draft" or the Application back to its prior
 * status. This means "sent" describes "HR committed to sending this
 * offer, and a delivery attempt was durably recorded", not "the
 * candidate's inbox definitely received it" — a failed delivery is
 * surfaced via the notification's own status and is recoverable with
 * "Retry Email", exactly like every other EmailNotification category in
 * this codebase.
 */
export async function sendOffer(companyId: string, userId: string, offerId: string): Promise<EmailNotificationDoc> {
  const offer = await Offer.findOne({ ...offerIdentifierFilter(offerId), company_id: companyId });
  if (!offer) {
    throw new NotFoundError("Offer not found");
  }
  if (offer.status !== "draft") {
    throw new ConflictError(NOT_DRAFT_MESSAGE);
  }

  const job = await Job.findOne({ _id: offer.job_id, ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError(JOB_DELETED_MESSAGE);
  }

  const context = await resolveOfferEmailContext(offer);
  if (!context) {
    throw new NotFoundError("Offer not found");
  }

  const snapshot = buildOfferSnapshot(offer, context);
  // Subject is fully determined by the snapshot alone (candidate/company/
  // job/offer title only — never the response URLs), so it can be
  // computed once, up front, and persisted on the EmailNotification row
  // inside the transaction below before a response token (and therefore a
  // real URL) even exists yet. The placeholder URLs here are discarded —
  // only `.subject` from this call is ever used.
  const { subject } = buildContentFromSnapshot(snapshot, { acceptUrl: "", declineUrl: "" });

  const session = await mongoose.startSession();
  let notification: EmailNotificationDoc;
  let rawResponseToken: string;
  try {
    let result: { notification: EmailNotificationDoc; rawToken: string } | undefined;

    await session.withTransaction(async () => {
      const updatedOffer = await Offer.findOneAndUpdate(
        { _id: offer._id, status: "draft" },
        { $set: { status: "sent", sent_at: new Date(), updated_by_user_id: userId } },
        { new: true, session }
      );
      if (!updatedOffer) {
        throw new ConflictError(SEND_CONFLICT_MESSAGE);
      }

      // Guarded by the same broad "not yet terminal" set createOffer
      // itself required — a concurrent explicit Reject racing this exact
      // send is the only realistic way this could ever fail to match, and
      // failing loudly here (aborting the whole transaction, Offer
      // included) is correct: an offer must never end up "sent" against an
      // Application that was rejected moments before.
      const updatedApplication = await Application.findOneAndUpdate(
        { _id: updatedOffer.application_id, status: { $in: ["applied", "in_process"] } },
        { $set: { status: "offered" } },
        { session }
      );
      if (!updatedApplication) {
        throw new ConflictError(SEND_CONFLICT_MESSAGE);
      }

      // Created durably WITH the business transition (see this function's
      // own doc comment above for exactly what production bug this
      // prevents) — never after it. If this throws for any reason
      // (including the defensive duplicate-key case below), the whole
      // transaction aborts and the Offer/Application updates above are
      // rolled back with it — there is no way to end up "sent" with zero
      // notification history.
      const [createdNotification] = await EmailNotification.create(
        [
          {
            company_id: companyId,
            application_id: updatedOffer.application_id,
            candidate_id: updatedOffer.candidate_id,
            offer_id: updatedOffer.id,
            category: "offer_sent",
            recipient_email: context.candidateEmail,
            subject,
            offer_snapshot: snapshot,
            status: "pending",
            triggered_by_user_id: userId,
            // Compatibility value ONLY — see EmailNotification.model.ts's
            // own doc comment. This is NOT offer_sent's idempotency
            // mechanism (that's the Offer's own atomic draft->sent
            // transaction guard above, which makes this create() call
            // reachable at most once per Offer ever). Without a genuinely
            // distinct value here, interview_id defaulting to null for
            // every non-interview row would collide {null, "offer_sent",
            // null} against every other offer_sent row ever created,
            // system-wide, on the pre-existing {interview_id, category,
            // mutation_version_at} unique index — not a rare edge case,
            // but every SECOND offer ever sent, full stop (this was a
            // real bug, found and fixed via this exact field). Mirrors
            // applicationAssessmentEmail.service.ts's and
            // rejection.service.ts's identical fix for the same shared,
            // deliberately-unaltered legacy index.
            mutation_version_at: new Date(),
          },
        ],
        { session }
      );

      // Created inside the SAME transaction as the notification row it's
      // delivered with — see offerResponseToken.service.ts's own doc
      // comment on why a candidate email must never reference a token
      // that didn't actually get persisted.
      const rawToken = await generateOfferResponseToken(updatedOffer, createdNotification!.id, session);

      result = { notification: createdNotification!, rawToken };
    });

    notification = result!.notification;
    rawResponseToken = result!.rawToken;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // The Offer's own draft->sent atomic guard above is the real
      // double-click protection (only one concurrent request could ever
      // reach this far for the same Offer) — this is defense-in-depth for
      // the exceptionally unlikely case both still raced past it. Since
      // the create() now runs inside the transaction, this also aborts
      // the Offer/Application updates in the same request, so nothing is
      // left half-committed.
      throw new ConflictError(SEND_CONFLICT_MESSAGE);
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const content = buildContentFromSnapshot(snapshot, {
    acceptUrl: buildOfferResponseUrl(rawResponseToken, "accept"),
    declineUrl: buildOfferResponseUrl(rawResponseToken, "decline"),
  });
  await attemptEmailDelivery(notification, content);
  return notification;
}

/**
 * Explicit "Retry Email" for a failed offer notification — retries the
 * SAME row in place (there is at most one offer_sent row per Offer ever,
 * since an Offer is only ever sent once — see Offer.model.ts's own doc
 * comment), rendering from its own immutable offer_snapshot, never from a
 * fresh Offer/Candidate/Job/Company lookup and never from the Offer's
 * CURRENT terms (which cannot change after sending anyway, but this stays
 * historically faithful even if that ever changed).
 *
 * Because the ORIGINAL send's plaintext response token was never
 * persisted anywhere (only its hash — see OfferResponseToken.model.ts), a
 * retry cannot simply recover and resend it. Instead, every retry mints a
 * genuinely NEW response token for this exact delivery attempt (see this
 * ticket's explicit Part 2 "generate a NEW opaque response token for each
 * actual email delivery attempt" rule) while the email's BUSINESS content
 * stays exactly what the immutable snapshot says. Any earlier token(s)
 * from a previous send/retry attempt remain independently valid in their
 * own right for as long as Offer.status === "sent" (subject to their own
 * expiry) — this retry never revokes them, since an earlier email may
 * still have been genuinely delivered despite this notification's most
 * recent attempt failing.
 */
export async function retryOfferNotification(companyId: string, offerId: string, notificationId: string): Promise<EmailNotificationDoc> {
  const offer = await Offer.findOne({ ...offerIdentifierFilter(offerId), company_id: companyId });
  if (!offer) {
    throw new NotFoundError("Offer not found");
  }

  const notification = await EmailNotification.findOne({
    ...emailNotificationIdentifierFilter(notificationId),
    company_id: companyId,
    offer_id: offer.id,
    category: "offer_sent",
  });
  if (!notification) {
    throw new NotFoundError("Notification not found");
  }
  if (notification.status !== "failed") {
    throw new ConflictError(NOT_RETRYABLE_MESSAGE);
  }

  const rawToken = await generateOfferResponseToken(offer, notification.id);
  const content = buildContentFromSnapshot(notification.offer_snapshot!, {
    acceptUrl: buildOfferResponseUrl(rawToken, "accept"),
    declineUrl: buildOfferResponseUrl(rawToken, "decline"),
  });
  await attemptEmailDelivery(notification, content);
  return notification;
}

/**
 * Full notification history for one Offer, newest first — same tenant
 * scoping as applicationAssessmentEmail.service.ts's
 * listNotificationsForAssessment.
 */
export async function listNotificationsForOffer(companyId: string, offerId: string): Promise<EmailNotificationDoc[]> {
  const offer = await Offer.findOne({ ...offerIdentifierFilter(offerId), company_id: companyId });
  if (!offer) {
    throw new NotFoundError("Offer not found");
  }
  return EmailNotification.find({ offer_id: offer.id }).sort({ created_at: -1 });
}
