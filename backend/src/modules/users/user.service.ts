import { User } from "../../models/User.model";

export interface UserDirectoryEntryDTO {
  id: string;
  name: string;
  email: string;
}

/**
 * The smallest read-only endpoint needed for interview-scheduling's
 * interviewer picker — NOT a general Admin/User Management listing (no
 * role/status management here, no invited/disabled users). Returns only
 * ACTIVE Users in the caller's own company, since only they are valid
 * interviewer candidates (an invited-but-not-yet-active or disabled User
 * has no business being assignable to a live interview). Tenant isolation
 * is enforced by construction: the query is always scoped to the caller's
 * own companyId, never a caller-supplied one.
 */
export async function listCompanyInterviewerCandidates(companyId: string): Promise<UserDirectoryEntryDTO[]> {
  const users = await User.find({ company_id: companyId, status: "active" })
    .select("name email")
    .sort({ name: 1 });

  return users.map((user) => ({ id: user.id, name: user.name, email: user.email }));
}
