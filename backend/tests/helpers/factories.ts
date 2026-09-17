import { Company, type CompanyDoc } from "../../src/models/Company.model";
import { User, type UserDoc, type UserRole, type UserStatus } from "../../src/models/User.model";
import { hashPassword } from "../../src/security/password";

export const DEFAULT_PASSWORD = "Password123!";

export async function createCompany(name = "Test Company"): Promise<CompanyDoc> {
  return Company.create({ name, industry: "Software", status: "active" });
}

export async function createUser(params: {
  companyId: string;
  email: string;
  role: UserRole;
  password?: string;
  status?: UserStatus;
  name?: string;
}): Promise<UserDoc> {
  const password_hash = await hashPassword(params.password ?? DEFAULT_PASSWORD);
  return User.create({
    company_id: params.companyId,
    name: params.name ?? "Test User",
    email: params.email,
    password_hash,
    role: params.role,
    status: params.status ?? "active",
  });
}
