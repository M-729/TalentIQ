import mongoose from "mongoose";
import { CompanyInvitation, type CompanyInvitationDoc } from "../../models/CompanyInvitation.model";
import { Company } from "../../models/Company.model";
import { User, type UserDoc } from "../../models/User.model";
import { ConflictError } from "../../security/AppError";
import { hashPassword } from "../../security/password";
import { issueTokens, toSafeUser, type AuthTokens, type SafeUser } from "../auth/auth.service";
import { hashInvitationToken } from "../team/companyInvitationToken.service";
import {
  INVALID_INVITATION_RESULT,
  serializeInvitationResponse,
  type CompanyInvitationResponseDTO,
} from "./companyInvitationResponse.serializer";

const EMAIL_TAKEN_MESSAGE = "This invitation can no longer be used. Please contact your administrator.";
const RACE_LOST_MESSAGE = "__company_invitation_accept_race_lost__";

async function resolveCompanyName(companyId: unknown): Promise<string> {
  const company = await Company.findById(companyId).select("name");
  return company?.name ?? "this company";
}

async function resolveInvitationFromToken(rawToken: string): Promise<CompanyInvitationDoc | null> {
  const tokenHash = hashInvitationToken(rawToken);
  return CompanyInvitation.findOne({ token_hash: tokenHash });
}

async function buildResultForInvitation(invitation: CompanyInvitationDoc): Promise<CompanyInvitationResponseDTO> {
  const companyName = await resolveCompanyName(invitation.company_id);
  return serializeInvitationResponse(invitation, companyName);
}

/**
 * Read-only lookup — a GET-equivalent (POST only to keep the opaque token
 * out of URL paths/query strings/logs, same rationale as
 * offerResponse.service.ts's lookupOfferResponse) that never mutates
 * anything. Opening the email link/loading the accept-invitation page
 * only ever calls this.
 */
export async function lookupCompanyInvitation(rawToken: string): Promise<CompanyInvitationResponseDTO> {
  const invitation = await resolveInvitationFromToken(rawToken);
  if (!invitation) return INVALID_INVITATION_RESULT;
  return buildResultForInvitation(invitation);
}

export type AcceptCompanyInvitationResult =
  | { outcome: "accepted"; user: SafeUser; tokens: AuthTokens }
  | { outcome: "not_eligible"; dto: CompanyInvitationResponseDTO };

/**
 * The only place a Company Invitation actually mutates anything — reached
 * exclusively by the invitee's own explicit "Join company" submit (see
 * this ticket's explicit Part 6 scanner-safety rule). Atomically (Part 8):
 * validates the token, confirms the invitation is still pending/not
 * revoked/not expired, confirms the email isn't already registered
 * elsewhere, creates the User with the invitation's OWN email/company_id/
 * role (never client-supplied), hashes the password via the same
 * hashPassword() every other account-creation path uses, and marks the
 * invitation accepted — all inside one Mongo transaction, mirroring
 * auth.service.ts's signupCompany and offer.service.ts's applyOfferResponse
 * exactly. Either membership is fully created or nothing is.
 *
 * Race safety (Part 8/24): the atomic
 * `{status:"pending", expires_at:{$gt: now}}` guard on the invitation
 * means only one of two concurrent accept attempts (or an accept racing an
 * Admin's revoke) can ever win — the loser's transaction throws and rolls
 * back cleanly, so double acceptance can never create two Users. The
 * caller (companyInvitationResponse.controller.ts) never sees a bare
 * error for a lost race; it always gets back the invitation's real current
 * state, the same reflective-state pattern offerResponse.service.ts's
 * respondToOfferResponse established.
 */
export async function acceptCompanyInvitation(
  rawToken: string,
  input: { fullName: string; password: string },
  ip?: string
): Promise<AcceptCompanyInvitationResult> {
  const invitation = await resolveInvitationFromToken(rawToken);
  if (!invitation) return { outcome: "not_eligible", dto: INVALID_INVITATION_RESULT };

  const preCheck = await buildResultForInvitation(invitation);
  if (preCheck.state !== "valid") return { outcome: "not_eligible", dto: preCheck };

  const session = await mongoose.startSession();
  let createdUser: UserDoc | undefined;
  try {
    await session.withTransaction(async () => {
      // The atomic invitation guard runs FIRST and is the sole
      // synchronization point between two concurrent accept attempts:
      // MongoDB's write-write conflict handling on this exact document
      // means the loser deterministically observes {status!=="pending"}
      // once the winner commits, and reliably takes the RACE_LOST_MESSAGE
      // path below with a clear, reflective response — rather than racing
      // against wall-clock timing on a separate read (checking email
      // uniqueness first was tried and found nondeterministic: whichever
      // request's User.findOne happened to run after the other's User.create
      // committed would get a generic conflict instead of a proper
      // "already accepted" state, and which one that was depended on
      // timing, not on which request actually lost the invitation race).
      const guarded = await CompanyInvitation.findOneAndUpdate(
        { _id: invitation._id, status: "pending", expires_at: { $gt: new Date() } },
        { $set: { status: "accepted", accepted_at: new Date() } },
        { session, new: true }
      );
      if (!guarded) throw new ConflictError(RACE_LOST_MESSAGE);

      // Part 8 step 3 / Part 16: the invited email may have become
      // registered elsewhere in the time between invite and accept (email
      // is globally unique — see User.model.ts). Checked fresh, inside
      // the transaction, immediately before creating anything, now that
      // this request has confirmed it actually won the invitation race.
      const existingUser = await User.findOne({ email: invitation.email }).session(session).select("_id");
      if (existingUser) throw new ConflictError(EMAIL_TAKEN_MESSAGE);

      const passwordHash = await hashPassword(input.password);
      const [user] = await User.create(
        [
          {
            company_id: guarded.company_id,
            name: input.fullName,
            email: guarded.email,
            password_hash: passwordHash,
            role: guarded.role,
            status: "active",
          },
        ],
        { session }
      );

      await CompanyInvitation.updateOne({ _id: guarded._id }, { $set: { accepted_user_id: user!._id } }, { session });

      createdUser = user;
    });
  } catch (err) {
    if (err instanceof ConflictError && err.message === RACE_LOST_MESSAGE) {
      const current = await CompanyInvitation.findById(invitation._id);
      const dto = current ? await buildResultForInvitation(current) : INVALID_INVITATION_RESULT;
      return { outcome: "not_eligible", dto };
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const safeUser = toSafeUser(createdUser!);
  const tokens = await issueTokens(safeUser, ip);
  return { outcome: "accepted", user: safeUser, tokens };
}
