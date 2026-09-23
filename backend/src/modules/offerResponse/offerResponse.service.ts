import { OfferResponseToken } from "../../models/OfferResponseToken.model";
import { Offer, type OfferDoc, type OfferStatus } from "../../models/Offer.model";
import { Job } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { ConflictError } from "../../security/AppError";
import { applyOfferResponse } from "../offers/offer.service";
import { hashResponseToken } from "../offers/offerResponseToken.service";
import { serializeOfferPublicDetails, type OfferResponseDTO } from "./offerResponse.serializer";

const INVALID_RESULT: OfferResponseDTO = { response_state: "invalid" };

async function resolveCompanyAndJobNames(offer: OfferDoc): Promise<{ companyName: string; jobTitle: string }> {
  const job = await Job.findById(offer.job_id).select("title company_id");
  const company = job ? await Company.findById(job.company_id).select("name") : null;
  return {
    companyName: company?.name ?? "the hiring company",
    jobTitle: job?.title ?? "",
  };
}

/**
 * Maps an Offer's CURRENT live status to the public response_state — the
 * one place this mapping happens, reused by both lookup and respond so
 * they can never disagree on what a given Offer status means to the
 * candidate.
 */
async function buildResultForOffer(offer: OfferDoc): Promise<OfferResponseDTO> {
  const { companyName, jobTitle } = await resolveCompanyAndJobNames(offer);
  const details = serializeOfferPublicDetails({ companyName, jobTitle, offer });

  switch (offer.status) {
    case "accepted":
      return { response_state: "accepted", ...details };
    case "declined":
      return { response_state: "declined", ...details };
    case "withdrawn":
      return { response_state: "withdrawn", ...details };
    case "draft":
      // Structurally unreachable through a real token — a token is only
      // ever minted at Send Offer time (see offerEmail.service.ts), by
      // which point the Offer is already "sent". Treated as invalid
      // defensively rather than assumed impossible.
      return INVALID_RESULT;
    case "sent":
      if (offer.expires_at && offer.expires_at.getTime() < Date.now()) {
        return { response_state: "expired", ...details };
      }
      return { response_state: "awaiting_response", ...details };
    default: {
      const _exhaustive: never = offer.status;
      return _exhaustive;
    }
  }
}

/**
 * Resolves a raw response token to its Offer, or null for every invalid
 * case alike (not found, expired) — callers never distinguish which, so a
 * caller probing with garbage token values learns nothing about why a
 * given attempt failed (same "constant, safe generic not-found behavior"
 * precedent as googleCalendarOAuthState.service.ts's consumeOAuthState).
 * Read-only — never mutates the token or the Offer. `used_at` is
 * deliberately NOT checked here: a token that was already used to make a
 * successful decision must still resolve normally on a later open/reload
 * of the same email link — the CURRENT Offer status (already
 * accepted/declined by then) is what correctly informs the candidate,
 * not the token's own used_at bookkeeping.
 */
async function resolveOfferFromToken(rawToken: string): Promise<OfferDoc | null> {
  const tokenHash = hashResponseToken(rawToken);
  const token = await OfferResponseToken.findOne({ token_hash: tokenHash, expires_at: { $gt: new Date() } });
  if (!token) return null;

  const offer = await Offer.findById(token.offer_id);
  return offer ?? null;
}

/**
 * Public "open the email link" read — GET-equivalent (see this ticket's
 * explicit, critical "opening the email link must only display a
 * confirmation page, ZERO mutation" rule). Never writes to the Offer, the
 * token, or anything else.
 */
export async function lookupOfferResponse(rawToken: string): Promise<OfferResponseDTO> {
  const offer = await resolveOfferFromToken(rawToken);
  if (!offer) return INVALID_RESULT;
  return buildResultForOffer(offer);
}

/**
 * Public "Confirm acceptance"/"Confirm decline" mutation — the ONLY
 * action in this entire flow that may change Offer state. Reuses
 * offer.service.ts's applyOfferResponse, the EXACT same core transition
 * HR's manual Mark Accepted/Mark Declined endpoints use (see this
 * ticket's explicit Part 7/19 "reuse the same core transition logic"
 * rule) — the atomic {_id, status:"sent"} guard inside it is what makes a
 * concurrent accept-vs-decline (candidate vs candidate, candidate vs HR,
 * or any combination) resolve to exactly one winner, regardless of source.
 *
 * A losing/redundant respond attempt (the Offer already moved on to
 * accepted/declined/withdrawn by the time this runs, via ANY path) is
 * never an error from the candidate's perspective — it safely reports
 * back whatever the Offer's actual current state now is, which is
 * exactly "This offer has already been accepted/declined" (see this
 * ticket's explicit Part 9 messaging).
 */
export async function respondToOfferResponse(rawToken: string, decision: Extract<OfferStatus, "accepted" | "declined">): Promise<OfferResponseDTO> {
  const offer = await resolveOfferFromToken(rawToken);
  if (!offer) return INVALID_RESULT;

  // Pre-check the same non-"sent" cases lookup already reports, so an
  // Offer that's already withdrawn/decided/expired never even attempts
  // the transition — buildResultForOffer is the single source of truth
  // for what each live status means to the candidate.
  const preCheck = await buildResultForOffer(offer);
  if (preCheck.response_state !== "awaiting_response") {
    return preCheck;
  }

  let updated: OfferDoc;
  try {
    updated = await applyOfferResponse(offer.id, decision, { source: "candidate", userId: null });
  } catch (err) {
    if (err instanceof ConflictError) {
      // Someone else (HR's manual fallback, or a genuinely concurrent
      // second candidate request) won the race between our pre-check and
      // the atomic guard above — re-resolve and report the Offer's real,
      // current, winning state rather than a generic error.
      const current = await Offer.findById(offer.id);
      return current ? buildResultForOffer(current) : INVALID_RESULT;
    }
    throw err;
  }

  // Informational/audit only — see OfferResponseToken.model.ts's own doc
  // comment on why Offer.status remains the actual business guard
  // regardless of this. Never fatal: the Offer transition above already
  // committed successfully by this point.
  const tokenHash = hashResponseToken(rawToken);
  await OfferResponseToken.updateOne({ token_hash: tokenHash, used_at: null }, { $set: { used_at: new Date() } });

  return buildResultForOffer(updated);
}
