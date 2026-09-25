import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { User } from "../src/models/User.model";
import { createCompany, createUser, DEFAULT_PASSWORD } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

const membersUrl = "/api/v1/team/members";
function deactivateUrl(userId: string) {
  return `/api/v1/team/members/${userId}/deactivate`;
}
function reactivateUrl(userId: string) {
  return `/api/v1/team/members/${userId}/reactivate`;
}

describe("Team Members management", () => {
  let companyA: CompanyDoc;
  let adminA: UserDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let adminB: UserDoc;
  let hrB: UserDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    adminA = await createUser({ companyId: companyA.id, email: "admin-a@acme.test", role: "ADMIN" });
    hrA = await createUser({ companyId: companyA.id, email: "hr-a@acme.test", role: "HR" });
    companyB = await createCompany("Company B");
    adminB = await createUser({ companyId: companyB.id, email: "admin-b@acme.test", role: "ADMIN" });
    hrB = await createUser({ companyId: companyB.id, email: "hr-b@acme.test", role: "HR" });
  });

  // 32. ADMIN lists own company members only
  describe("GET /team/members", () => {
    it("32. lists only this company's own members", async () => {
      const res = await request(app).get(membersUrl).set("Authorization", authHeaderFor(adminA, companyA.id));
      expect(res.status).toBe(200);
      const emails = res.body.members.map((m: { email: string }) => m.email);
      expect(emails).toEqual(expect.arrayContaining(["admin-a@acme.test", "hr-a@acme.test"]));
      expect(emails).not.toContain("admin-b@acme.test");
      expect(emails).not.toContain("hr-b@acme.test");
    });

    // 33. HR cannot list/manage team (admin-only policy)
    it("33. HR cannot access the team members list", async () => {
      const res = await request(app).get(membersUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(403);
    });

    it("never returns a password hash for any member", async () => {
      const res = await request(app).get(membersUrl).set("Authorization", authHeaderFor(adminA, companyA.id));
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    });
  });

  // 34. ADMIN can deactivate own-company HR / 40. self-deactivation prevented
  describe("POST /team/members/:userId/deactivate", () => {
    it("34. ADMIN can deactivate an HR user in their own company", async () => {
      const res = await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.member.status).toBe("disabled");

      const stored = await User.findById(hrA.id);
      expect(stored!.status).toBe("disabled");
    });

    // 39. cannot deactivate cross-company user
    it("39. returns 404 when trying to deactivate a user in another company", async () => {
      const res = await request(app).post(deactivateUrl(hrB.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(404);
      const stored = await User.findById(hrB.id);
      expect(stored!.status).toBe("active");
    });

    // 40. self-deactivation prevented
    it("40. an ADMIN cannot deactivate their own account from this flow", async () => {
      const res = await request(app).post(deactivateUrl(adminA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(409);
      const stored = await User.findById(adminA.id);
      expect(stored!.status).toBe("active");
    });

    it("HR cannot deactivate anyone", async () => {
      const res = await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(403);
    });

    it("refuses to deactivate an ADMIN target (only HR accounts are managed here)", async () => {
      const secondAdmin = await createUser({ companyId: companyA.id, email: "second-admin@acme.test", role: "ADMIN" });
      const res = await request(app).post(deactivateUrl(secondAdmin.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(409);
    });

    it("rejects deactivating an already-deactivated user with a clear conflict", async () => {
      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      const res = await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(409);
    });

    // 41. deactivation does not delete historical User row
    it("41. does not delete the User row — it remains queryable by id", async () => {
      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      const stored = await User.findById(hrA.id);
      expect(stored).not.toBeNull();
      expect(stored!.email).toBe("hr-a@acme.test");
    });

    // 35. deactivated HR cannot login
    it("35. a deactivated HR cannot log in afterward", async () => {
      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      const res = await request(app).post("/api/v1/auth/login").send({ email: "hr-a@acme.test", password: DEFAULT_PASSWORD });
      expect(res.status).toBe(401);
    });

    // 36. existing token from deactivated HR cannot access API
    it("36. an access token issued BEFORE deactivation is rejected on the very next request", async () => {
      const login = await request(app).post("/api/v1/auth/login").send({ email: "hr-a@acme.test", password: DEFAULT_PASSWORD });
      expect(login.status).toBe(200);

      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});

      const meRes = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);
      expect(meRes.status).toBe(401);

      const jobsRes = await request(app).get("/api/v1/jobs").set("Authorization", `Bearer ${login.body.accessToken}`);
      expect(jobsRes.status).toBe(401);
    });

    // 37. refresh blocked for deactivated HR
    it("37. refresh is blocked once the HR is deactivated", async () => {
      const login = await request(app).post("/api/v1/auth/login").send({ email: "hr-a@acme.test", password: DEFAULT_PASSWORD });
      const raw = login.headers["set-cookie"];
      const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const cookie = cookies.find((c: string) => c.startsWith("talentiq_refresh_token="))!.split(";")[0]!;

      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});

      const refreshRes = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);
      expect(refreshRes.status).toBe(401);
    });
  });

  // 38. ADMIN can reactivate HR
  describe("POST /team/members/:userId/reactivate", () => {
    it("38. ADMIN can reactivate a previously-deactivated HR", async () => {
      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});

      const res = await request(app).post(reactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(200);
      expect(res.body.member.status).toBe("active");

      const loginAfter = await request(app).post("/api/v1/auth/login").send({ email: "hr-a@acme.test", password: DEFAULT_PASSWORD });
      expect(loginAfter.status).toBe(200);
    });

    // 39. cannot reactivate cross-company user
    it("39. returns 404 when trying to reactivate a user in another company", async () => {
      await request(app).post(deactivateUrl(hrB.public_id!)).set("Authorization", authHeaderFor(adminB, companyB.id)).send({});
      const res = await request(app).post(reactivateUrl(hrB.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(404);
    });

    it("rejects reactivating an already-active user with a clear conflict", async () => {
      const res = await request(app).post(reactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(409);
    });

    it("HR cannot reactivate anyone", async () => {
      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      // A DIFFERENT, still-active HR performs the attempt — hrA itself is
      // now deactivated and would fail authentication before the role
      // check ever ran, which would test the wrong thing.
      const anotherActiveHr = await createUser({ companyId: companyA.id, email: "another-hr@acme.test", role: "HR" });
      const res = await request(app).post(reactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(anotherActiveHr, companyA.id)).send({});
      expect(res.status).toBe(403);
    });
  });

  // ===== Phase 1 opaque public ID migration =====
  describe("public_id", () => {
    it("is assigned automatically on creation with the user_ prefix and 24-char hex suffix", async () => {
      expect(hrA.public_id).toMatch(/^user_[a-f0-9]{24}$/);
    });

    it("deactivates a member looked up by their public_id", async () => {
      const res = await request(app)
        .post(deactivateUrl(hrA.public_id!))
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({});
      expect(res.status).toBe(200);
      const stored = await User.findById(hrA.id);
      expect(stored!.status).toBe("disabled");
    });

    it("rejects a deactivation addressed by legacy Mongo ObjectId", async () => {
      const res = await request(app).post(deactivateUrl(hrA.id)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(400);
    });

    it("returns 404 for another company's member looked up by public_id", async () => {
      const res = await request(app)
        .post(deactivateUrl(hrB.public_id!))
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({});
      expect(res.status).toBe(404);
    });

    it("reactivates a member looked up by their public_id", async () => {
      await request(app).post(deactivateUrl(hrA.public_id!)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});

      const res = await request(app)
        .post(reactivateUrl(hrA.public_id!))
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({});
      expect(res.status).toBe(200);
      const stored = await User.findById(hrA.id);
      expect(stored!.status).toBe("active");
    });

    // Regression coverage: the self-deactivation guard must compare the
    // RESOLVED target's real id against the acting user's real id, never
    // the raw (possibly public_id) URL param directly — otherwise an
    // Admin submitting their own public_id would never match their own
    // JWT-derived actingUserId and could deactivate themselves.
    it("still blocks an ADMIN from deactivating their own account when addressed by public_id", async () => {
      // adminA targeting themselves is blocked by the HR-only-target rule
      // regardless of self-check ordering (see member.service.ts) — this
      // still proves the public_id path resolves to the exact same real
      // user, not a silently-unmatched no-op that would 404 instead.
      const res = await request(app)
        .post(deactivateUrl(adminA.public_id!))
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({});
      expect(res.status).toBe(409);
      const stored = await User.findById(adminA.id);
      expect(stored!.status).toBe("active");
    });
  });
});
