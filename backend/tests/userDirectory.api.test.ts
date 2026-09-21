import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

const USERS_URL = "/api/v1/users";

describe("Interviewer directory API (GET /api/v1/users)", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR", name: "Hana HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).get(USERS_URL);
    expect(res.status).toBe(401);
  });

  it("returns active Users in the caller's company", async () => {
    const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN", name: "Amir Admin" });

    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    const emails = res.body.users.map((user: { email: string }) => user.email);
    expect(emails).toEqual(expect.arrayContaining(["hr@a.test", "admin@a.test"]));
    expect(res.body.users.find((u: { id: string }) => u.id === admin.id)).toBeDefined();
  });

  it("returns id, name, email only — never password/role/status/company internals", async () => {
    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.status).toBe(200);
    for (const user of res.body.users) {
      expect(Object.keys(user).sort()).toEqual(["email", "id", "name"]);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/password|company_id/i);
  });

  it("excludes disabled Users", async () => {
    const disabled = await createUser({ companyId: companyA.id, email: "disabled@a.test", role: "HR", status: "disabled" });

    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.users.find((u: { id: string }) => u.id === disabled.id)).toBeUndefined();
  });

  it("excludes invited (not-yet-active) Users", async () => {
    const invited = await createUser({ companyId: companyA.id, email: "invited@a.test", role: "HR", status: "invited" });

    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrA, companyA.id));
    expect(res.body.users.find((u: { id: string }) => u.id === invited.id)).toBeUndefined();
  });

  it("never returns Users from another company", async () => {
    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrA, companyA.id));
    const emails = res.body.users.map((user: { email: string }) => user.email);
    expect(emails).not.toContain(hrB.email);
  });

  it("scopes to exactly the caller's own company for a different caller too", async () => {
    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrB, companyB.id));
    const emails = res.body.users.map((user: { email: string }) => user.email);
    expect(emails).toEqual([hrB.email]);
  });

  it("orders results by name", async () => {
    await createUser({ companyId: companyA.id, email: "zed@a.test", role: "HR", name: "Zed" });
    await createUser({ companyId: companyA.id, email: "amy@a.test", role: "HR", name: "Amy" });

    const res = await request(app).get(USERS_URL).set("Authorization", authHeaderFor(hrA, companyA.id));
    const names = res.body.users.map((user: { name: string }) => user.name);
    expect(names).toEqual([...names].sort());
  });
});
