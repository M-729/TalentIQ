import { Types } from "mongoose";
import { assertOwnedByCompany, companyFilter } from "../src/security/companyScope";
import { NotFoundError } from "../src/security/AppError";
import { User } from "../src/models/User.model";
import { createCompany, createUser } from "./helpers/factories";

describe("assertOwnedByCompany", () => {
  it("resolves when the resource belongs to the given company", async () => {
    const companyA = await createCompany("Company A");
    const userA = await createUser({ companyId: companyA.id, email: "a@companya.test", role: "HR" });

    await expect(assertOwnedByCompany(User, { _id: userA._id }, companyA.id)).resolves.toBeUndefined();
  });

  it("throws NotFoundError (not Forbidden) when the resource belongs to a different company", async () => {
    const companyA = await createCompany("Company A");
    const companyB = await createCompany("Company B");
    const userA = await createUser({ companyId: companyA.id, email: "a2@companya.test", role: "HR" });

    // Company B must not be able to distinguish "not mine" from "doesn't exist".
    await expect(assertOwnedByCompany(User, { _id: userA._id }, companyB.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError when the resource does not exist at all", async () => {
    const companyA = await createCompany("Company A");
    const randomId = new Types.ObjectId();

    await expect(assertOwnedByCompany(User, { _id: randomId }, companyA.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("companyFilter", () => {
  it("builds a filter scoped to the given company id", () => {
    expect(companyFilter("abc123")).toEqual({ company_id: "abc123" });
    expect(companyFilter("abc123", "owner_company_id")).toEqual({ owner_company_id: "abc123" });
  });

  it("real-world use: only returns users belonging to the caller's company", async () => {
    const companyA = await createCompany("Company A");
    const companyB = await createCompany("Company B");
    await createUser({ companyId: companyA.id, email: "u1@companya.test", role: "HR" });
    await createUser({ companyId: companyA.id, email: "u2@companya.test", role: "ADMIN" });
    await createUser({ companyId: companyB.id, email: "u1@companyb.test", role: "HR" });

    const usersForA = await User.find(companyFilter(companyA.id));
    expect(usersForA).toHaveLength(2);
    expect(usersForA.every((u) => u.company_id.toString() === companyA.id)).toBe(true);
  });
});
