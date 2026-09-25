import { User, userIdentifierFilter, type UserDoc } from "../../models/User.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";

const NOT_FOUND_MESSAGE = "User not found";
const SELF_DEACTIVATE_MESSAGE = "You cannot deactivate your own account.";
// Deliberately restricts this ticket's Deactivate/Reactivate actions to HR
// targets only (see this ticket's own literal scope: "Admin can:
// Deactivate HR / Reactivate HR"). Under this ticket's flows there is
// exactly one ADMIN per company (the signup creator; invitations only ever
// grant "HR" — see INVITABLE_ROLES), so this also defensively prevents
// ever locking a company out of its only ADMIN account, which this ticket
// provides no recovery path for.
const NOT_HR_TARGET_MESSAGE = "Only HR accounts can be deactivated or reactivated from this page.";
const ALREADY_DEACTIVATED_MESSAGE = "This account is already deactivated.";
const ALREADY_ACTIVE_MESSAGE = "This account is already active.";

export async function listCompanyMembers(companyId: string): Promise<UserDoc[]> {
  return User.find(companyFilter(companyId)).sort({ created_at: 1 });
}

async function getOwnedHrTarget(companyId: string, targetUserId: string): Promise<UserDoc> {
  await assertOwnedByCompany(User, userIdentifierFilter(targetUserId), companyId, { notFoundMessage: NOT_FOUND_MESSAGE });
  const target = await User.findOne(userIdentifierFilter(targetUserId));
  if (!target) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (target.role !== "HR") throw new ConflictError(NOT_HR_TARGET_MESSAGE);
  return target;
}

export async function deactivateMember(companyId: string, actingUserId: string, targetUserId: string): Promise<UserDoc> {
  const target = await getOwnedHrTarget(companyId, targetUserId);
  // Compared against the RESOLVED target's real id, never the raw
  // (possibly public_id) targetUserId param — actingUserId is always a
  // real Mongo _id (from the JWT's own `sub` claim), so comparing it
  // against an unresolved public_id string would never match even when
  // they refer to the same user, silently defeating this guard.
  if (target.id === actingUserId) throw new ConflictError(SELF_DEACTIVATE_MESSAGE);

  if (target.status === "disabled") throw new ConflictError(ALREADY_DEACTIVATED_MESSAGE);

  target.status = "disabled";
  await target.save();
  return target;
}

export async function reactivateMember(companyId: string, targetUserId: string): Promise<UserDoc> {
  const target = await getOwnedHrTarget(companyId, targetUserId);
  if (target.status === "active") throw new ConflictError(ALREADY_ACTIVE_MESSAGE);

  target.status = "active";
  await target.save();
  return target;
}
