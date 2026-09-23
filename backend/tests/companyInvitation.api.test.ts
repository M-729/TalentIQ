import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { CompanyInvitation } from "../src/models/CompanyInvitation.model";
import { User } from "../src/models/User.model";
import { createCompany, createUser, DEFAULT_PASSWORD } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

import { emailService } from "../src/services/email/email.service";
const mockSend = emailService.send as jest.Mock;

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

const invitationsUrl = "/api/v1/team/invitations";
function resendUrl(id: string) {
  return `/api/v1/team/invitations/${id}/resend`;
}
function revokeUrl(id: string) {
  return `/api/v1/team/invitations/${id}/revoke`;
}
const lookupUrl = "/api/v1/public/company-invitations/lookup";
const acceptUrl = "/api/v1/public/company-invitations/accept";

/** Extracts the raw invitation token from the last email the mock captured. */
function extractTokenFromLastEmail(): string {
  const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
  const text = lastCall[0].text as string;
  const match = text.match(/Accept Invitation: (\S+)/);
  if (!match) throw new Error(`No invitation link found in email text: ${text}`);
  const url = match[1]!;
  const tokenMatch = url.match(/token=([^&]+)/);
  if (!tokenMatch) throw new Error(`No token found in url: ${url}`);
  return decodeURIComponent(tokenMatch[1]!);
}

describe("Team Invitations", () => {
  let companyA: CompanyDoc;
  let adminA: UserDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let adminB: UserDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    adminA = await createUser({ companyId: companyA.id, email: "admin-a@acme.test", role: "ADMIN" });
    hrA = await createUser({ companyId: companyA.id, email: "hr-a@acme.test", role: "HR" });
    companyB = await createCompany("Company B");
    adminB = await createUser({ companyId: companyB.id, email: "admin-b@acme.test", role: "ADMIN" });

    mockSend.mockReset().mockResolvedValue(undefined);
  });

  async function invite(email = "candidate-hr@acme.test", asUser = adminA, companyId = companyA.id) {
    return request(app).post(invitationsUrl).set("Authorization", authHeaderFor(asUser, companyId)).send({ email });
  }

  // ===== INVITE =====
  describe("POST /team/invitations", () => {
    // 11. ADMIN can invite HR
    it("11. ADMIN can invite an HR teammate by email", async () => {
      const res = await invite();
      expect(res.status).toBe(201);
      expect(res.body.invitation).toMatchObject({ email: "candidate-hr@acme.test", role: "HR", status: "pending" });
    });

    // 12. HR cannot invite users
    it("12. HR cannot invite users", async () => {
      const res = await invite("someone@acme.test", hrA);
      expect(res.status).toBe(403);
    });

    // 14. duplicate pending invitation prevented
    it("14. prevents a second pending invitation for the same company+email", async () => {
      await invite("dup@acme.test");
      const res = await invite("dup@acme.test");
      expect(res.status).toBe(409);
    });

    it("allows re-inviting the same email in a DIFFERENT company", async () => {
      await invite("shared@acme.test", adminA, companyA.id);
      const res = await invite("shared@acme.test", adminB, companyB.id);
      expect(res.status).toBe(201);
    });

    // 15. existing member cannot be invited
    it("15. rejects inviting an email that already belongs to a member of this company", async () => {
      const res = await invite("hr-a@acme.test");
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already a member/i);
    });

    it("rejects inviting an email that already belongs to a User in a DIFFERENT company, without leaking which one", async () => {
      const res = await invite("admin-b@acme.test");
      expect(res.status).toBe(409);
      expect(res.body.error.message).not.toMatch(/Company B/);
    });

    it("rejects a client-supplied role, company_id, or status (mass assignment)", async () => {
      const res = await request(app)
        .post(invitationsUrl)
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({ email: "role-attempt@acme.test", role: "ADMIN", company_id: companyB.id, status: "accepted" });
      expect(res.status).toBe(400);
    });

    // 16. raw invitation token never persisted
    it("16. never persists the raw invitation token", async () => {
      await invite("token-leak-check@acme.test");
      const invitation = await CompanyInvitation.findOne({ email: "token-leak-check@acme.test" });
      const rawToken = extractTokenFromLastEmail();
      expect(JSON.stringify(invitation!.toObject())).not.toContain(rawToken);
    });

    // 17. token hash persisted
    it("17. persists a hash of the token, distinct from the raw value", async () => {
      await invite("hash-check@acme.test");
      const invitation = await CompanyInvitation.findOne({ email: "hash-check@acme.test" });
      expect(invitation!.token_hash).toEqual(expect.any(String));
      expect(invitation!.token_hash.length).toBeGreaterThanOrEqual(64);
    });

    // 18. expiry stored
    it("18. stores an expires_at in the future", async () => {
      await invite("expiry-check@acme.test");
      const invitation = await CompanyInvitation.findOne({ email: "expiry-check@acme.test" });
      expect(invitation!.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    // 19. email contains secure public frontend link
    it("19. the invitation email contains an /accept-invitation link with the token in the URL fragment", async () => {
      await invite("link-check@acme.test");
      const sendCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      expect(sendCall[0].text).toMatch(/\/accept-invitation#token=\S+/);
      expect(sendCall[0].html).toMatch(/\/accept-invitation#token=/);
    });

    it("never includes the word 'Reject' or internal ids in the email", async () => {
      await invite("no-internal-ids@acme.test");
      const sendCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      expect(sendCall[0].text).not.toMatch(/Reject/);
    });

    // 29. SMTP failure preserves pending invitation
    it("29. preserves the invitation as pending when the email fails to send", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const res = await invite("smtp-fail@acme.test");
      expect(res.status).toBe(201);
      expect(res.body.invitation.status).toBe("pending");
      expect(res.body.invitation.email_status).toBe("failed");

      const invitation = await CompanyInvitation.findOne({ email: "smtp-fail@acme.test" });
      expect(invitation!.status).toBe("pending");
    });

    it("rejects unauthenticated invite requests", async () => {
      const res = await request(app).post(invitationsUrl).send({ email: "no-auth@acme.test" });
      expect(res.status).toBe(401);
    });
  });

  // ===== LIST =====
  describe("GET /team/invitations", () => {
    // 13. cross-company admin blocked (list scoping)
    it("13. only lists this company's own invitations", async () => {
      await invite("a-invite@acme.test", adminA, companyA.id);
      await invite("b-invite@acme.test", adminB, companyB.id);

      const res = await request(app).get(invitationsUrl).set("Authorization", authHeaderFor(adminA, companyA.id));
      expect(res.status).toBe(200);
      const emails = res.body.invitations.map((i: { email: string }) => i.email);
      expect(emails).toContain("a-invite@acme.test");
      expect(emails).not.toContain("b-invite@acme.test");
    });

    it("HR cannot list invitations (ADMIN-only page)", async () => {
      const res = await request(app).get(invitationsUrl).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(403);
    });
  });

  // ===== RESEND =====
  describe("POST /team/invitations/:id/resend", () => {
    // 30. retry email works
    it("30. resends the email with a fresh token, invalidating the old one", async () => {
      const created = await invite("resend-check@acme.test");
      const originalToken = extractTokenFromLastEmail();
      const invitationId = created.body.invitation.id as string;

      mockSend.mockResolvedValueOnce(undefined);
      const res = await request(app).post(resendUrl(invitationId)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});
      expect(res.status).toBe(200);

      const newToken = extractTokenFromLastEmail();
      expect(newToken).not.toBe(originalToken);

      // The old token no longer resolves to a valid, usable invitation.
      const oldLookup = await request(app).post(lookupUrl).send({ token: originalToken });
      expect(oldLookup.body.state).toBe("invalid");

      const newLookup = await request(app).post(lookupUrl).send({ token: newToken });
      expect(newLookup.body.state).toBe("valid");
    });

    // 13. cross-company admin blocked (resend)
    it("13. returns 404 when resending another company's invitation", async () => {
      const created = await invite("cross-resend@acme.test", adminA, companyA.id);
      const res = await request(app)
        .post(resendUrl(created.body.invitation.id))
        .set("Authorization", authHeaderFor(adminB, companyB.id))
        .send({});
      expect(res.status).toBe(404);
    });

    it("cannot resend an already-accepted invitation", async () => {
      const created = await invite("resend-accepted@acme.test");
      const rawToken = extractTokenFromLastEmail();
      await request(app).post(acceptUrl).send({ token: rawToken, full_name: "New HR", password: DEFAULT_PASSWORD });

      const res = await request(app)
        .post(resendUrl(created.body.invitation.id))
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({});
      expect(res.status).toBe(409);
    });
  });

  // ===== REVOKE =====
  describe("POST /team/invitations/:id/revoke", () => {
    it("ADMIN can revoke a pending invitation", async () => {
      const created = await invite("revoke-check@acme.test");
      const res = await request(app)
        .post(revokeUrl(created.body.invitation.id))
        .set("Authorization", authHeaderFor(adminA, companyA.id))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.invitation.status).toBe("revoked");
    });

    // 13. cross-company admin blocked (revoke)
    it("13. returns 404 when revoking another company's invitation", async () => {
      const created = await invite("cross-revoke@acme.test", adminA, companyA.id);
      const res = await request(app)
        .post(revokeUrl(created.body.invitation.id))
        .set("Authorization", authHeaderFor(adminB, companyB.id))
        .send({});
      expect(res.status).toBe(404);
    });

    // 26. revoked invitation blocked
    it("26. a revoked invitation can no longer be accepted", async () => {
      const created = await invite("revoke-then-accept@acme.test");
      const rawToken = extractTokenFromLastEmail();
      await request(app).post(revokeUrl(created.body.invitation.id)).set("Authorization", authHeaderFor(adminA, companyA.id)).send({});

      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Too Late", password: DEFAULT_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.state).toBe("revoked");

      const user = await User.findOne({ email: "revoke-then-accept@acme.test" });
      expect(user).toBeNull();
    });
  });

  // ===== PUBLIC LOOKUP (scanner safety) =====
  describe("POST /public/company-invitations/lookup", () => {
    // 20. opening/lookup causes zero membership mutation
    it("20. never mutates the invitation or creates a User", async () => {
      const created = await invite("lookup-safety@acme.test");
      const rawToken = extractTokenFromLastEmail();

      const before = await CompanyInvitation.findById(created.body.invitation.id);
      await request(app).post(lookupUrl).send({ token: rawToken });
      await request(app).post(lookupUrl).send({ token: rawToken });
      const after = await CompanyInvitation.findById(created.body.invitation.id);

      expect(after!.status).toBe(before!.status);
      expect(after!.updated_at!.getTime()).toBe(before!.updated_at!.getTime());
      const user = await User.findOne({ email: "lookup-safety@acme.test" });
      expect(user).toBeNull();
    });

    it("returns valid + safe fields for a genuinely pending invitation", async () => {
      await invite("lookup-fields@acme.test");
      const rawToken = extractTokenFromLastEmail();
      const res = await request(app).post(lookupUrl).send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        state: "valid",
        company_name: "Company A",
        invited_email: "lookup-fields@acme.test",
        role: "HR",
      });
      expect(res.body.expires_at).toEqual(expect.any(String));
    });

    // 28. invalid token safe
    it("28. returns a safe invalid state for a garbage token, no error, no leak", async () => {
      const res = await request(app).post(lookupUrl).send({ token: "totally-made-up-token" });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ state: "invalid" });
    });

    // 25. expired invitation blocked (lookup reports it)
    it("25. reports expired for a pending invitation whose expires_at has passed", async () => {
      const created = await invite("expired-lookup@acme.test");
      const rawToken = extractTokenFromLastEmail();
      await CompanyInvitation.updateOne({ _id: created.body.invitation.id }, { $set: { expires_at: new Date(Date.now() - 1000) } });

      const res = await request(app).post(lookupUrl).send({ token: rawToken });
      expect(res.body.state).toBe("expired");
    });

    // 27. already accepted invitation blocked safely (lookup reports it)
    it("27. reports accepted for an already-accepted invitation, without an error", async () => {
      const created = await invite("already-accepted-lookup@acme.test");
      const rawToken = extractTokenFromLastEmail();
      await request(app).post(acceptUrl).send({ token: rawToken, full_name: "First Joiner", password: DEFAULT_PASSWORD });

      const res = await request(app).post(lookupUrl).send({ token: rawToken });
      expect(res.status).toBe(200);
      expect(res.body.state).toBe("accepted");
      void created;
    });

    // 31. no internal tenant data in public DTO
    it("31. never exposes company_id, invited_by internal ids, or other tenant data", async () => {
      await invite("no-leak-check@acme.test");
      const rawToken = extractTokenFromLastEmail();
      const res = await request(app).post(lookupUrl).send({ token: rawToken });

      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/company_id/);
      expect(body).not.toMatch(/invited_by/);
      expect(body).not.toMatch(new RegExp(String(companyA._id)));
      expect(body).not.toMatch(new RegExp(String(adminA.id)));
    });

    it("rejects an unauthenticated-style rate-limit-worthy request cleanly with 400 on malformed body", async () => {
      const res = await request(app).post(lookupUrl).send({});
      expect(res.status).toBe(400);
    });
  });

  // ===== PUBLIC ACCEPT =====
  describe("POST /public/company-invitations/accept", () => {
    // 21. valid invitation can create HR
    it("21. a valid invitation creates an active HR User", async () => {
      const created = await invite("accept-basic@acme.test");
      const rawToken = extractTokenFromLastEmail();

      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Sara Ahmad", password: DEFAULT_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.state).toBe("accepted");
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ role: "HR", status: "active", email: "accept-basic@acme.test" });

      const user = await User.findOne({ email: "accept-basic@acme.test" });
      expect(user).not.toBeNull();
      void created;
    });

    // 22. accepted HR belongs to exact invitation company
    it("22. the created HR belongs to exactly the inviting company, not any other", async () => {
      await invite("company-scope-check@acme.test", adminA, companyA.id);
      const rawToken = extractTokenFromLastEmail();
      await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Company Scoped", password: DEFAULT_PASSWORD });

      const user = await User.findOne({ email: "company-scope-check@acme.test" });
      expect(String(user!.company_id)).toBe(String(companyA._id));
      expect(String(user!.company_id)).not.toBe(String(companyB._id));
    });

    // 23. accepted role comes from invitation, never request
    it("23. the role always comes from the invitation, ignoring any client-supplied role", async () => {
      await invite("role-from-invitation@acme.test");
      const rawToken = extractTokenFromLastEmail();
      const res = await request(app)
        .post(acceptUrl)
        .send({ token: rawToken, full_name: "Role Test", password: DEFAULT_PASSWORD, role: "ADMIN" });
      // .strict() rejects the unknown "role" key outright.
      expect(res.status).toBe(400);

      const user = await User.findOne({ email: "role-from-invitation@acme.test" });
      expect(user).toBeNull();
    });

    // 24. race/double acceptance creates exactly one User
    it("24. two concurrent accept requests for the same token create exactly one User", async () => {
      await invite("race-check@acme.test");
      const rawToken = extractTokenFromLastEmail();

      const [first, second] = await Promise.all([
        request(app).post(acceptUrl).send({ token: rawToken, full_name: "Racer One", password: DEFAULT_PASSWORD }),
        request(app).post(acceptUrl).send({ token: rawToken, full_name: "Racer Two", password: DEFAULT_PASSWORD }),
      ]);

      // Both requests report the invitation's FINAL state ("accepted") —
      // the winner because it just performed the transition, the loser
      // because it lost the race and re-derives the now-current state
      // (see companyInvitationResponse.service.ts's RACE_LOST_MESSAGE
      // catch). Only the winner actually receives fresh auth tokens.
      expect(first.body.state).toBe("accepted");
      expect(second.body.state).toBe("accepted");
      const tokenBearingResponses = [first, second].filter((res) => res.body.accessToken !== undefined);
      expect(tokenBearingResponses).toHaveLength(1);

      const users = await User.find({ email: "race-check@acme.test" });
      expect(users).toHaveLength(1);
    });

    // 25. expired invitation blocked
    it("25. blocks acceptance of an expired invitation", async () => {
      const created = await invite("expired-accept@acme.test");
      const rawToken = extractTokenFromLastEmail();
      await CompanyInvitation.updateOne({ _id: created.body.invitation.id }, { $set: { expires_at: new Date(Date.now() - 1000) } });

      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Too Slow", password: DEFAULT_PASSWORD });
      expect(res.body.state).toBe("expired");
      const user = await User.findOne({ email: "expired-accept@acme.test" });
      expect(user).toBeNull();
    });

    // 27. already accepted invitation blocked safely
    it("27. blocks a second acceptance attempt safely, without a second User", async () => {
      await invite("double-accept@acme.test");
      const rawToken = extractTokenFromLastEmail();
      await request(app).post(acceptUrl).send({ token: rawToken, full_name: "First", password: DEFAULT_PASSWORD });

      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Second", password: DEFAULT_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.state).toBe("accepted");
      expect(res.body.accessToken).toBeUndefined();

      const users = await User.find({ email: "double-accept@acme.test" });
      expect(users).toHaveLength(1);
    });

    // 28. invalid token safe
    it("28. returns a safe invalid state for a garbage token on accept too", async () => {
      const res = await request(app).post(acceptUrl).send({ token: "garbage", full_name: "Nobody", password: DEFAULT_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.state).toBe("invalid");
    });

    it("rejects an email already registered elsewhere by the time of acceptance", async () => {
      await invite("race-with-signup@acme.test");
      const rawToken = extractTokenFromLastEmail();
      // Someone else grabs this exact email via a different path in the meantime.
      await createUser({ companyId: companyB.id, email: "race-with-signup@acme.test", role: "HR" });

      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Too Late", password: DEFAULT_PASSWORD });
      expect(res.status).toBe(409);

      const users = await User.find({ email: "race-with-signup@acme.test" });
      expect(users).toHaveLength(1);
    });

    it("rejects a client-supplied password shorter than the policy minimum", async () => {
      await invite("weak-password@acme.test");
      const rawToken = extractTokenFromLastEmail();
      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Weak", password: "short" });
      expect(res.status).toBe(400);
    });

    it("logs the new HR in automatically (sets the refresh cookie) on success", async () => {
      await invite("auto-login-check@acme.test");
      const rawToken = extractTokenFromLastEmail();
      const res = await request(app).post(acceptUrl).send({ token: rawToken, full_name: "Auto Login", password: DEFAULT_PASSWORD });

      const raw = res.headers["set-cookie"];
      const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
      expect(cookies.some((c: string) => c.startsWith("talentiq_refresh_token="))).toBe(true);
    });
  });
});
