import mongoose, { Types, type FilterQuery } from "mongoose";
import { Offer, type OfferDoc, type OfferResponseSource, type OfferStatus } from "../../models/Offer.model";
import { Application, type ApplicationDoc } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { BadRequestError, ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { getAccessibleApplication, getAccessibleApplicationForActiveJob } from "../applications/applicationAccess.service";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";
import { escapeRegExp } from "../../utils/regex";
import { TERMINAL_STATUSES, TERMINAL_STATE_MESSAGE } from "../stageTransitions/stageTransition.service";
import type { CreateOfferInput, UpdateOfferInput } from "./offer.validation";
import { serializeOfferListRow, type OfferListRowDTO } from "./offer.serializer";

const ALREADY_EXISTS_MESSAGE = "An active offer already exists for this application. Withdraw it before creating a new one.";
const NOT_DRAFT_MESSAGE = "Only a draft offer can be edited.";
const SALARY_PAIRING_MESSAGE = "Salary amount and currency must be provided together.";
const NOT_SENT_MESSAGE = "Only a sent offer can be marked accepted or declined.";
const NOT_WITHDRAWABLE_MESSAGE = "Only a draft or sent offer can be withdrawn.";
const NOT_ACCEPTED_MESSAGE = "Only an accepted offer can be marked as hired.";
const CONCURRENT_UPDATE_MESSAGE = "This offer was just updated by someone else. Please refresh and try again.";

function toDateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

/**
 * Creates a Draft Offer for an Application's CURRENT hiring status — see
 * this ticket's explicit Part 6 eligibility rules, reused rather than
 * re-implemented: getAccessibleApplicationForActiveJob is the exact same
 * tenant + "Job not soft-deleted" gate createAssessment/moveApplicationStage
 * already use (a closed-but-not-deleted Job still permits this), and
 * TERMINAL_STATUSES is the exact same rejected/offered/hired guard.
 *
 * Never sends anything — this is purely a database write (see this
 * ticket's explicit Part 7 "Creation of a Draft offer does NOT
 * automatically email anyone" rule). Offer.model.ts's own partial unique
 * index enforces "at most one live (non-withdrawn) Offer per Application"
 * atomically — a duplicate-key error here means a live Offer already
 * exists, surfaced as a safe 409.
 */
export async function createOffer(
  companyId: string,
  userId: string,
  applicationId: string,
  input: CreateOfferInput
): Promise<OfferDoc> {
  const application = await getAccessibleApplicationForActiveJob(applicationId, companyId);

  if (TERMINAL_STATUSES.has(application.status)) {
    throw new ConflictError(TERMINAL_STATE_MESSAGE);
  }

  try {
    return await Offer.create({
      company_id: companyId,
      application_id: application.id,
      candidate_id: application.candidate_id,
      job_id: application.job_id,
      status: "draft",
      title: input.title,
      salary_amount: input.salary_amount ?? null,
      salary_currency: input.salary_currency ?? null,
      employment_type: input.employment_type ?? null,
      start_date: toDateOrNull(input.start_date) ?? null,
      expires_at: toDateOrNull(input.expires_at) ?? null,
      candidate_message: input.candidate_message ?? null,
      internal_notes: input.internal_notes ?? null,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(ALREADY_EXISTS_MESSAGE);
    }
    throw err;
  }
}

async function getOwnedOffer(companyId: string, offerId: string): Promise<OfferDoc> {
  const offer = await Offer.findOne({ _id: offerId, company_id: companyId });
  if (!offer) {
    throw new NotFoundError("Offer not found");
  }
  return offer;
}

/**
 * The Application Detail page's current-offer read — the one LIVE
 * (non-withdrawn) Offer for this Application, if any. Uses the HISTORICAL
 * access variant (works after Job soft-delete), matching every other read
 * of terminal-outcome-adjacent data meant to remain viewable as history.
 * Returns null once nothing live remains (e.g. withdrawn) — the frontend
 * then falls back to "no current offer" (Create Offer / Reject Candidate),
 * matching this ticket's explicit Part 17 UI states. A withdrawn Offer
 * itself is never deleted — see listOffers below for where it remains
 * fully visible, company-wide.
 */
export async function getCurrentOfferForApplication(companyId: string, applicationId: string): Promise<OfferDoc | null> {
  await getAccessibleApplication(applicationId, companyId);
  return Offer.findOne({ application_id: applicationId, status: { $ne: "withdrawn" } });
}

/**
 * Corrects a Draft offer's terms — locked the moment status is no longer
 * "draft" (see this ticket's explicit Part 16 "sent offer locks core
 * terms for historical integrity" rule). The salary amount/currency
 * pairing rule is checked against the FINAL merged state (not just this
 * request's fields — see offer.validation.ts's own doc comment on why),
 * so a request that only touches ONE of the two while the other already
 * has a stored value from a previous edit is still valid.
 */
export async function updateOffer(companyId: string, userId: string, offerId: string, input: UpdateOfferInput): Promise<OfferDoc> {
  const offer = await getOwnedOffer(companyId, offerId);
  if (offer.status !== "draft") {
    throw new ConflictError(NOT_DRAFT_MESSAGE);
  }

  if (input.title !== undefined) offer.title = input.title;
  if (input.salary_amount !== undefined) offer.salary_amount = input.salary_amount;
  if (input.salary_currency !== undefined) offer.salary_currency = input.salary_currency;
  if (input.employment_type !== undefined) offer.employment_type = input.employment_type;
  if (input.start_date !== undefined) offer.start_date = toDateOrNull(input.start_date) ?? null;
  if (input.expires_at !== undefined) offer.expires_at = toDateOrNull(input.expires_at) ?? null;
  if (input.candidate_message !== undefined) offer.candidate_message = input.candidate_message;
  if (input.internal_notes !== undefined) offer.internal_notes = input.internal_notes;

  const hasAmount = offer.salary_amount != null;
  const hasCurrency = offer.salary_currency != null;
  if (hasAmount !== hasCurrency) {
    throw new BadRequestError(SALARY_PAIRING_MESSAGE);
  }

  offer.updated_by_user_id = new Types.ObjectId(userId);
  await offer.save();
  return offer;
}

/**
 * "Withdraw Offer" — allowed only from draft or sent (never
 * accepted/declined/already-withdrawn, see this ticket's explicit Part
 * 15). A withdrawn Offer remains permanently historical: this never
 * deletes it, and the Candidate's Application is never automatically
 * rejected or otherwise mutated beyond the specific reversal below.
 *
 * If the Offer was "sent" (meaning Application.status was flipped to
 * "offered" when it was sent), withdrawing it reverts Application.status
 * back to "in_process" — deliberately, so HR CAN create a replacement
 * Offer afterward (createOffer's own eligibility check requires a
 * non-terminal status; see this ticket's explicit Part 16 "prefer Withdraw
 * + new Offer" guidance, which only works if withdrawal un-terminals the
 * Application). current_step_id is left completely untouched — reverting
 * status is never a pipeline movement (see this ticket's explicit Part 25
 * "no automatic pipeline movement" rule). A "draft" Offer never changed
 * Application.status in the first place, so nothing is reverted for that
 * case.
 *
 * Runs both writes (Offer + Application) inside one transaction, guarded
 * by the exact status this call observed — the same optimistic-concurrency
 * shape as stageTransition.service.ts's moveApplicationStage.
 */
export async function withdrawOffer(companyId: string, userId: string, offerId: string): Promise<OfferDoc> {
  const offer = await getOwnedOffer(companyId, offerId);
  if (offer.status !== "draft" && offer.status !== "sent") {
    throw new ConflictError(NOT_WITHDRAWABLE_MESSAGE);
  }
  const wasSent = offer.status === "sent";
  const observedStatus = offer.status;

  const session = await mongoose.startSession();
  try {
    let result: OfferDoc | undefined;

    await session.withTransaction(async () => {
      const updatedOffer = await Offer.findOneAndUpdate(
        { _id: offerId, status: observedStatus },
        { $set: { status: "withdrawn", is_live: false, withdrawn_at: new Date(), updated_by_user_id: userId } },
        { new: true, session }
      );
      if (!updatedOffer) {
        throw new ConflictError(CONCURRENT_UPDATE_MESSAGE);
      }

      if (wasSent) {
        await Application.findOneAndUpdate(
          { _id: updatedOffer.application_id, status: "offered" },
          { $set: { status: "in_process" } },
          { session }
        );
        // Deliberately not guarded as fatal if this doesn't match — a
        // concurrent explicit Reject/Hire on the same Application already
        // moved it somewhere else, which is a real, valid outcome that
        // must not be silently overwritten back to "in_process". The
        // Offer withdrawal itself still succeeds either way.
      }

      result = updatedOffer;
    });

    return result!;
  } finally {
    await session.endSession();
  }
}

export interface OfferResponder {
  source: OfferResponseSource;
  /** null for a candidate response — no TalentIQ user is involved. */
  userId: string | null;
}

/**
 * THE single core Offer accept/decline transition — called by BOTH the
 * authenticated HR manual-fallback endpoints below (markOfferAccepted/
 * markOfferDeclined) AND the public candidate response flow
 * (offerResponse.service.ts), so the actual business rules can never
 * drift between the two entry points (see this ticket's explicit Part 7
 * "candidate response must reuse the same core transition logic as HR
 * manual recording" and Part 19 requirements).
 *
 * Allowed only from "sent" — never accepted->declined or declined->
 * accepted (both are terminal for this Offer, see Offer.model.ts's own
 * doc comment). Deliberately does NOT touch Application.status — Accepted
 * is not yet a final outcome (see this ticket's explicit "Accepted does
 * NOT automatically Hire" rule); Application.status stays "offered" until
 * the separate, explicit "Mark as Hired" action, regardless of who
 * recorded the acceptance. A decline sets Application.final_decision to
 * "declined" — APPLICATION_STATUSES has no dedicated "declined" value,
 * and reusing "rejected" would misrepresent the actual fact (a candidate
 * declining an offer is materially different from HR rejecting a
 * candidate).
 *
 * Atomic guard: findOneAndUpdate keyed on {_id, status:"sent"} (optionally
 * further scoped by company_id for the HR path — the candidate path has
 * already proven company ownership via its own token lookup, so it omits
 * that extra filter) — this is what makes "accepted racing declined" (or
 * two concurrent requests from ANY combination of candidate/HR sources)
 * resolve to exactly one winner: whichever commits first wins, and the
 * loser's guard matches nothing, regardless of which source or which
 * token/session triggered each request.
 */
export async function applyOfferResponse(
  offerId: string,
  decision: Extract<OfferStatus, "accepted" | "declined">,
  responder: OfferResponder,
  companyId?: string
): Promise<OfferDoc> {
  const filter: FilterQuery<OfferDoc> = { _id: offerId, status: "sent" };
  if (companyId) filter.company_id = companyId;

  const now = new Date();
  const update: Record<string, unknown> = {
    status: decision,
    [decision === "accepted" ? "accepted_at" : "declined_at"]: now,
    response_source: responder.source,
    responded_at: now,
    responded_by_user_id: responder.userId,
  };
  // Only an HR responder is a real TalentIQ user who "touched" the record
  // — a candidate response has no user id to attribute this to, so
  // updated_by_user_id simply keeps whatever value it already had (e.g.
  // the HR user who sent the offer) rather than being cleared to null.
  if (responder.userId) {
    update.updated_by_user_id = responder.userId;
  }

  const updated = await Offer.findOneAndUpdate(filter, { $set: update }, { new: true });
  if (!updated) {
    throw new ConflictError(NOT_SENT_MESSAGE);
  }

  if (decision === "declined") {
    await Application.updateOne({ _id: updated.application_id }, { $set: { final_decision: "declined" } });
  }
  return updated;
}

/**
 * "Mark Accepted" — the authenticated HR/Admin manual fallback for a
 * response received outside TalentIQ (phone, ordinary email, ...; see
 * this ticket's explicit "HR must still have a MANUAL fallback" rule).
 * Thin wrapper around applyOfferResponse — see its own doc comment for
 * the actual transition/concurrency rules, shared verbatim with the
 * public candidate response flow.
 */
export async function markOfferAccepted(companyId: string, userId: string, offerId: string): Promise<OfferDoc> {
  await getOwnedOffer(companyId, offerId);
  return applyOfferResponse(offerId, "accepted", { source: "hr", userId }, companyId);
}

/**
 * "Mark Declined" — same HR manual-fallback model as markOfferAccepted.
 */
export async function markOfferDeclined(companyId: string, userId: string, offerId: string): Promise<OfferDoc> {
  await getOwnedOffer(companyId, offerId);
  return applyOfferResponse(offerId, "declined", { source: "hr", userId }, companyId);
}

export interface MarkHiredResult {
  application: ApplicationDoc;
  offer: OfferDoc;
}

/**
 * "Mark as Hired" — the one explicit, HR-only transition that completes
 * the hiring workflow (see this ticket's explicit Part 13). Allowed only
 * when Offer.status === "accepted" — never directly from "sent" (Accepted
 * is a required intermediate step, see this ticket's explicit Part 29 "sent
 * cannot directly become hired" rule).
 *
 * Both writes (Application.status -> "hired" and — deliberately — the
 * Offer stays "accepted" forever, since "hired" is an Application-level
 * fact, not a further Offer status; see Offer.model.ts's own doc comment)
 * happen inside one transaction, guarded by the exact statuses this call
 * observed. A duplicate/concurrent "Mark as Hired" click finds the
 * Application no longer "offered" (or the Offer no longer "accepted") and
 * safely conflicts rather than double-writing hired_at.
 */
export async function markApplicationHired(companyId: string, userId: string, offerId: string): Promise<MarkHiredResult> {
  const offer = await getOwnedOffer(companyId, offerId);
  if (offer.status !== "accepted") {
    throw new ConflictError(NOT_ACCEPTED_MESSAGE);
  }

  const session = await mongoose.startSession();
  try {
    let result: MarkHiredResult | undefined;

    await session.withTransaction(async () => {
      const updatedApplication = await Application.findOneAndUpdate(
        { _id: offer.application_id, status: "offered" },
        { $set: { status: "hired", final_decision: "hired", hired_at: new Date(), hired_by_user_id: userId } },
        { new: true, session }
      );
      if (!updatedApplication) {
        throw new ConflictError(CONCURRENT_UPDATE_MESSAGE);
      }

      result = { application: updatedApplication, offer };
    });

    return result!;
  } finally {
    await session.endSession();
  }
}

export interface ListOffersFilters {
  jobId?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ListOffersResult {
  offers: OfferListRowDTO[];
  total: number;
}

/**
 * Company-scoped /offers page — same batching discipline as
 * applicationAssessment.service.ts's listAssessments: a small, FIXED
 * number of queries regardless of page size, never one lookup per row.
 */
export async function listOffers(companyId: string, filters: ListOffersFilters): Promise<ListOffersResult> {
  if (filters.jobId) {
    await assertOwnedByCompany(Job, { _id: filters.jobId }, companyId, { notFoundMessage: "Job not found" });
  }

  let searchFilter: FilterQuery<OfferDoc> = {};
  if (filters.search) {
    const pattern = new RegExp(escapeRegExp(filters.search), "i");
    const matchingCandidates = await Candidate.find({ full_name: pattern }).select("_id").lean();
    // An empty $in correctly matches nothing (never "no filter").
    searchFilter = { $or: [{ title: pattern }, { candidate_id: { $in: matchingCandidates.map((c) => c._id) } }] };
  }

  const filter: FilterQuery<OfferDoc> = {
    ...companyFilter(companyId),
    ...(filters.jobId ? { job_id: filters.jobId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...searchFilter,
  };

  const [offers, total] = await Promise.all([
    Offer.find(filter)
      .sort({ updated_at: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit),
    Offer.countDocuments(filter),
  ]);

  const candidateIds = [...new Set(offers.map((o) => o.candidate_id.toString()))];
  const jobIds = [...new Set(offers.map((o) => o.job_id.toString()))];

  const [candidates, jobs] = await Promise.all([
    Candidate.find({ _id: { $in: candidateIds } }),
    Job.find({ _id: { $in: jobIds } }),
  ]);
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const rows: OfferListRowDTO[] = [];
  for (const offer of offers) {
    const candidate = candidateById.get(offer.candidate_id.toString());
    const job = jobById.get(offer.job_id.toString());
    if (!candidate || !job) continue;
    rows.push(serializeOfferListRow(offer, candidate, job));
  }

  return { offers: rows, total };
}
