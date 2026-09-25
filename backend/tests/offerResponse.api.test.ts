import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate, type CandidateDoc } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { Offer } from "../src/models/Offer.model";
import { OfferResponseToken } from "../src/models/OfferResponseToken.model";
import { EmailNotification } from "../src/models/EmailNotification.model";
import { createCompany, createUser } from "./helpers/factories";
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

function createUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/offer`;
}
function sendUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/send`;
}
function retryUrl(offerId: string, notificationId: string) {
  return `/api/v1/offers/${offerId}/notifications/${notificationId}/retry`;
}
function withdrawUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/withdraw`;
}
function acceptUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/accept`;
}
function declineUrl(offerId: string) {
  return `/api/v1/offers/${offerId}/decline`;
}
const lookupUrl = "/api/v1/public/offer-response/lookup";
const respondUrl = "/api/v1/public/offer-response/respond";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Backend Engineer",
    salary_amount: 90000,
    salary_currency: "USD",
    ...overrides,
  };
}

/** Extracts a token from the last email the mock captured, for the given decision link. */
function extractTokenFromLastEmail(decision: "Accept" | "Decline"): string {
  const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
  const text = lastCall[0].text as string;
  const match = text.match(new RegExp(`${decision} Offer: (\\S+)`));
  if (!match) throw new Error(`No ${decision} link found in email text: ${text}`);
  const url = match[1]!;
  const tokenMatch = url.match(/token=([^&]+)/);
  if (!tokenMatch) throw new Error(`No token found in url: ${url}`);
  return decodeURIComponent(tokenMatch[1]!);
}

describe("Offer Response API (candidate accept/decline via email)", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let candidate: CandidateDoc;
  let application: ApplicationDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });

    candidate = await Candidate.create({
      full_name: "Ahmad Khalil",
      email: `ahmad-${new Types.ObjectId().toString()}@candidate.test`,
    });
    application = await Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
    });

    mockSend.mockReset();
  });

  // Returns both `.id` (raw Mongo ObjectId, for internal DB assertions like
  // findById/relation-field queries) and `.publicId` (for building admin
  // URLs) — Phase 2 cutover means only the latter resolves against the API.
  async function createDraft(overrides: Record<string, unknown> = {}, applicationPublicId = application.public_id!) {
    const res = await request(app).post(createUrl(applicationPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody(overrides));
    return { id: res.body.offer.id as string, publicId: res.body.offer.public_id as string };
  }

  async function sendAndCaptureAcceptToken(offerPublicId: string) {
    mockSend.mockResolvedValueOnce(undefined);
    await request(app).post(sendUrl(offerPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
    return extractTokenFromLastEmail("Accept");
  }

  async function createSecondApplicationAndOffer(overrides: Record<string, unknown> = {}) {
    const secondCandidate = await Candidate.create({ full_name: "Second Candidate", email: `second-${new Types.ObjectId().toString()}@candidate.test` });
    const secondApplication = await Application.create({
      job_id: jobA.id,
      candidate_id: secondCandidate._id,
      cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
      status: "in_process",
    });
    const offer = await createDraft(overrides, secondApplication.public_id!);
    return { offerId: offer.id, offerPublicId: offer.publicId, applicationId: secondApplication.id };
  }

  // ===== TOKEN =====
  describe("token generation and storage", () => {
    // 1. sending Offer generates secure response token
    it("1. generates a response token when the offer is sent", async () => {
      const { id, publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);
      expect(await OfferResponseToken.countDocuments({ offer_id: id })).toBe(1);
    });

    // 2. plaintext token never stored
    it("2. never stores the plaintext token anywhere", async () => {
      const { id, publicId } = await createDraft();
      const rawToken = await sendAndCaptureAcceptToken(publicId);

      const stored = await OfferResponseToken.findOne({ offer_id: id });
      expect(JSON.stringify(stored)).not.toContain(rawToken);

      const offer = await Offer.findById(id);
      expect(JSON.stringify(offer)).not.toContain(rawToken);

      const notification = await EmailNotification.findOne({ offer_id: id });
      expect(JSON.stringify(notification)).not.toContain(rawToken);
    });

    // 3. hash stored
    it("3. stores a SHA-256 hash of the token, distinct from the raw value", async () => {
      const { id, publicId } = await createDraft();
      const rawToken = await sendAndCaptureAcceptToken(publicId);

      const stored = await OfferResponseToken.findOne({ offer_id: id });
      expect(stored!.token_hash).not.toBe(rawToken);
      expect(stored!.token_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    // 4. token expiry stored
    it("4. stores a future expires_at roughly matching the configured TTL", async () => {
      const { id, publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);

      const stored = await OfferResponseToken.findOne({ offer_id: id });
      const expectedMs = 14 * 24 * 60 * 60 * 1000;
      const actualMs = stored!.expires_at.getTime() - Date.now();
      expect(actualMs).toBeGreaterThan(expectedMs - 60_000);
      expect(actualMs).toBeLessThan(expectedMs + 60_000);
    });

    // 5. token expiry respects earlier Offer.expires_at
    it("5. caps token expiry at the Offer's own expires_at when it is earlier than the TTL", async () => {
      const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const { id, publicId } = await createDraft({ expires_at: soon });
      await sendAndCaptureAcceptToken(publicId);

      const stored = await OfferResponseToken.findOne({ offer_id: id });
      expect(stored!.expires_at.toISOString()).toBe(soon);
    });

    // 6. invalid token safe
    it("6. returns a safe invalid response_state for a garbage token", async () => {
      const res = await request(app).post(lookupUrl).send({ token: "not-a-real-token" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("invalid");
    });

    // 7. cross-offer token cannot access another Offer
    it("7. one offer's token only ever affects that exact offer", async () => {
      const offerA = await createDraft({ title: "Offer A" });
      const tokenA = await sendAndCaptureAcceptToken(offerA.publicId);
      const { offerId: offerBId, offerPublicId: offerBPublicId } = await createSecondApplicationAndOffer({ title: "Offer B" });
      await sendAndCaptureAcceptToken(offerBPublicId);

      const res = await request(app).post(respondUrl).send({ token: tokenA, decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.offer_title).toBe("Offer A");

      expect((await Offer.findById(offerA.id))!.status).toBe("accepted");
      expect((await Offer.findById(offerBId))!.status).toBe("sent");
    });

    // 8. public DTO contains no internal IDs/notes
    it("8. the lookup DTO never includes internal ids or notes", async () => {
      const { id, publicId } = await createDraft({ internal_notes: "Candidate negotiated hard" });
      const token = await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(lookupUrl).send({ token });
      const bodyText = JSON.stringify(res.body);
      expect(bodyText).not.toContain(id);
      expect(bodyText).not.toContain(application.id);
      expect(bodyText).not.toContain(companyA.id);
      expect(bodyText).not.toContain(candidate.id);
      expect(bodyText).not.toMatch(/negotiated hard/);
      expect(res.body).not.toHaveProperty("internal_notes");
    });
  });

  // ===== EMAIL =====
  describe("offer email content", () => {
    // 9 & 10. Accept Offer / Decline Offer present
    it("9/10. includes Accept Offer and Decline Offer actions, never the word Reject", async () => {
      const { publicId } = await createDraft();
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const [sendCall] = mockSend.mock.calls;
      expect(sendCall[0].text).toMatch(/Accept Offer/);
      expect(sendCall[0].text).toMatch(/Decline Offer/);
      expect(sendCall[0].html).toMatch(/Accept Offer/);
      expect(sendCall[0].html).toMatch(/Decline Offer/);
      expect(sendCall[0].text).not.toMatch(/Reject/i);
      expect(sendCall[0].html).not.toMatch(/Reject/i);
    });

    // 11. tokenized actions point to candidate response frontend
    it("11. both links point at the public /offer-response page with a token in the fragment", async () => {
      const { publicId } = await createDraft();
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const [sendCall] = mockSend.mock.calls;
      expect(sendCall[0].text).toMatch(/\/offer-response#token=\S+&decision=accept\b/);
      expect(sendCall[0].text).toMatch(/\/offer-response#token=\S+&decision=decline\b/);
    });

    // 12. internal notes excluded
    it("12. never includes internal_notes in the email", async () => {
      const { publicId } = await createDraft({ internal_notes: "Do not exceed 100k" });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const [sendCall] = mockSend.mock.calls;
      expect(sendCall[0].text).not.toMatch(/100k/);
      expect(sendCall[0].html).not.toMatch(/100k/);
    });

    // 13. Retry generates fresh token
    it("13. generates a brand-new token on Retry Email, distinct from the original", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const originalToken = await (async () => {
        await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
        return extractTokenFromLastEmail("Accept");
      })();

      const notification = await EmailNotification.findOne({ offer_id: id });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(publicId, notification!.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const retryToken = extractTokenFromLastEmail("Accept");

      expect(retryToken).not.toBe(originalToken);
      expect(await OfferResponseToken.countDocuments({ offer_id: id })).toBe(2);
    });

    // 14. old still-valid token remains usable while Offer sent
    it("14. the original token from a failed send remains usable after a successful retry", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const originalToken = extractTokenFromLastEmail("Accept");

      const notification = await EmailNotification.findOne({ offer_id: id });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(publicId, notification!.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      // The ORIGINAL (pre-retry) token still works.
      const res = await request(app).post(respondUrl).send({ token: originalToken, decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("accepted");
    });

    // 15. no plaintext token persisted in EmailNotification snapshot
    it("15. the EmailNotification's offer_snapshot never contains a token or url field", async () => {
      const { id, publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);

      const notification = await EmailNotification.findOne({ offer_id: id });
      const snapshotKeys = Object.keys(JSON.parse(JSON.stringify(notification!.offer_snapshot)));
      expect(snapshotKeys).not.toContain("token");
      expect(snapshotKeys).not.toContain("accept_url");
      expect(snapshotKeys).not.toContain("decline_url");
      expect(snapshotKeys).not.toContain("acceptUrl");
      expect(snapshotKeys).not.toContain("declineUrl");
    });
  });

  // ===== SCANNER SAFETY =====
  describe("email scanner safety — zero mutation on lookup", () => {
    // 16 & 17. lookup/page load causes zero Offer mutation
    it("16/17. calling lookup any number of times never changes Offer state", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      const before = await Offer.findById(id);

      for (let i = 0; i < 5; i++) {
        const res = await request(app).post(lookupUrl).send({ token });
        expect(res.status).toBe(200);
        expect(res.body.response_state).toBe("awaiting_response");
      }

      const after = await Offer.findById(id);
      expect(after!.status).toBe("sent");
      expect(after!.updated_at!.getTime()).toBe(before!.updated_at!.getTime());
      expect(after!.accepted_at).toBeNull();
      expect(after!.declined_at).toBeNull();
    });

    // 18. only explicit POST respond mutates
    it("18. only the respond call actually mutates the Offer", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);

      await request(app).post(lookupUrl).send({ token });
      await request(app).post(lookupUrl).send({ token });
      expect((await Offer.findById(id))!.status).toBe("sent");

      await request(app).post(respondUrl).send({ token, decision: "accepted" });
      expect((await Offer.findById(id))!.status).toBe("accepted");
    });
  });

  // ===== RESPONSE =====
  describe("candidate response", () => {
    // 19. valid sent Offer can accept
    it("19. accepts a valid sent offer", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(respondUrl).send({ token, decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("accepted");
      expect((await Offer.findById(id))!.status).toBe("accepted");
    });

    // 20. valid sent Offer can decline
    it("20. declines a valid sent offer", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(respondUrl).send({ token, decision: "declined" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("declined");
      expect((await Offer.findById(id))!.status).toBe("declined");
    });

    // 21. accepted cannot decline afterward
    it("21. cannot decline an already-accepted offer, and safely reports the accepted state", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(respondUrl).send({ token, decision: "accepted" });

      const res = await request(app).post(respondUrl).send({ token, decision: "declined" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("accepted");
      expect((await Offer.findById(id))!.status).toBe("accepted");
    });

    // 22. declined cannot accept afterward
    it("22. cannot accept an already-declined offer, and safely reports the declined state", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(respondUrl).send({ token, decision: "declined" });

      const res = await request(app).post(respondUrl).send({ token, decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("declined");
      expect((await Offer.findById(id))!.status).toBe("declined");
    });

    // 23. accept-vs-decline race has exactly one winner
    it("23. an accept-vs-decline race resolves to exactly one winner", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);

      const [acceptRes, declineRes] = await Promise.all([
        request(app).post(respondUrl).send({ token, decision: "accepted" }),
        request(app).post(respondUrl).send({ token, decision: "declined" }),
      ]);

      const states = [acceptRes.body.response_state, declineRes.body.response_state];
      // Both responses always agree on the SAME final winning state.
      expect(states[0]).toBe(states[1]);
      expect(["accepted", "declined"]).toContain(states[0]);

      const stored = await Offer.findById(id);
      expect(stored!.status).toBe(states[0]);
    });

    // 24. candidate accepted leaves Application.status offered
    it("24. leaves Application.status as offered after candidate acceptance", async () => {
      const { publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(respondUrl).send({ token, decision: "accepted" });

      expect((await Application.findById(application.id))!.status).toBe("offered");
    });

    // 25. candidate accepted does NOT hire
    it("25. never hires the application on candidate acceptance", async () => {
      const { publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(respondUrl).send({ token, decision: "accepted" });

      const stored = await Application.findById(application.id);
      expect(stored!.status).not.toBe("hired");
      expect(stored!.final_decision).toBeNull();
      expect(stored!.hired_at).toBeNull();
    });

    // 26. candidate declined sets final_decision declined
    it("26. sets Application.final_decision to declined on candidate decline", async () => {
      const { publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(respondUrl).send({ token, decision: "declined" });

      expect((await Application.findById(application.id))!.final_decision).toBe("declined");
    });

    // 27. candidate response_source recorded
    it("27. records response_source as candidate with no responded_by user", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(respondUrl).send({ token, decision: "accepted" });

      const stored = await Offer.findById(id);
      expect(stored!.response_source).toBe("candidate");
      expect(stored!.responded_by_user_id).toBeNull();
      expect(stored!.responded_at).not.toBeNull();
    });

    // 28. withdrawn Offer cannot respond
    it("28. reports a withdrawn offer as unavailable and never mutates it", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(respondUrl).send({ token, decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("withdrawn");
      expect((await Offer.findById(id))!.status).toBe("withdrawn");
    });

    // 29. expired Offer cannot respond
    it("29. reports an offer whose expires_at has passed as expired and never mutates it", async () => {
      const { id, publicId } = await createDraft({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
      const token = await sendAndCaptureAcceptToken(publicId);
      // Simulate time passing: the OFFER's own deadline has now passed,
      // while the response token (minted with a real future expiry at
      // send time) is still technically valid.
      await Offer.updateOne({ _id: id }, { $set: { expires_at: new Date(Date.now() - 1000) } });

      const res = await request(app).post(respondUrl).send({ token, decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("expired");
      expect((await Offer.findById(id))!.status).toBe("sent");
    });

    // 30. invalid token cannot respond
    it("30. never mutates anything for an invalid token", async () => {
      const { id, publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(respondUrl).send({ token: "garbage-token", decision: "accepted" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("invalid");
      expect((await Offer.findById(id))!.status).toBe("sent");
    });
  });

  // ===== HR FALLBACK =====
  describe("HR manual fallback", () => {
    // 31. HR manual Accepted still works
    it("31. HR can still manually mark an offer accepted", async () => {
      const { publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("accepted");
    });

    // 32. HR manual Declined still works
    it("32. HR can still manually mark an offer declined", async () => {
      const { publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(declineUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe("declined");
    });

    // 33. HR response_source recorded as HR
    it("33. records response_source as hr with the acting user attributed", async () => {
      const { id, publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const stored = await Offer.findById(id);
      expect(stored!.response_source).toBe("hr");
      expect(stored!.responded_by_user_id!.toString()).toBe(hrA.id);
    });

    // 34. candidate-vs-HR race safe
    it("34. a candidate-vs-HR race resolves to exactly one winner", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);

      const [candidateRes, hrRes] = await Promise.all([
        request(app).post(respondUrl).send({ token, decision: "declined" }),
        request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)),
      ]);

      const finalStatus = (await Offer.findById(id))!.status;
      expect(["accepted", "declined"]).toContain(finalStatus);
      // Whichever one actually won matches the stored state; the loser
      // gets a safe conflict (HR: 409) or a safe already-responded report
      // (candidate: 200 reflecting the real outcome) — never both winning.
      if (finalStatus === "accepted") {
        expect(hrRes.status).toBe(200);
        expect(candidateRes.body.response_state).toBe("accepted");
      } else {
        expect(hrRes.status).toBe(409);
        expect(candidateRes.body.response_state).toBe("declined");
      }
    });
  });

  // ===== TOKEN INVALIDATION =====
  describe("token invalidation by business state", () => {
    // 35. accepted state blocks all other valid tokens
    it("35. a second still-valid token cannot decline an already-accepted offer", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const token1 = extractTokenFromLastEmail("Accept");

      const notification = await EmailNotification.findOne({ offer_id: id });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(publicId, notification!.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const token2 = extractTokenFromLastEmail("Accept");

      await request(app).post(respondUrl).send({ token: token1, decision: "accepted" });

      const res = await request(app).post(respondUrl).send({ token: token2, decision: "declined" });
      expect(res.body.response_state).toBe("accepted");
      expect((await Offer.findById(id))!.status).toBe("accepted");
    });

    // 36. declined state blocks all other valid tokens
    it("36. a second still-valid token cannot accept an already-declined offer", async () => {
      const { id, publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const token1 = extractTokenFromLastEmail("Accept");

      const notification = await EmailNotification.findOne({ offer_id: id });
      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(publicId, notification!.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const token2 = extractTokenFromLastEmail("Accept");

      await request(app).post(respondUrl).send({ token: token1, decision: "declined" });

      const res = await request(app).post(respondUrl).send({ token: token2, decision: "accepted" });
      expect(res.body.response_state).toBe("declined");
      expect((await Offer.findById(id))!.status).toBe("declined");
    });

    // 37. withdrawn Offer blocks token
    it("37. a valid token cannot mutate a withdrawn offer", async () => {
      const { publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(withdrawUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(respondUrl).send({ token, decision: "accepted" });
      expect(res.body.response_state).toBe("withdrawn");
    });

    // 38. hired state blocks token
    it("38. a valid token cannot mutate an offer whose application has since been hired", async () => {
      const { publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      await request(app).post(acceptUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      await request(app).post(`/api/v1/offers/${publicId}/hire`).set("Authorization", authHeaderFor(hrA, companyA.id));

      const res = await request(app).post(respondUrl).send({ token, decision: "declined" });
      expect(res.status).toBe(200);
      expect(res.body.response_state).toBe("accepted");
      expect((await Application.findById(application.id))!.status).toBe("hired");
    });
  });

  // ===== SECURITY =====
  describe("security", () => {
    // 40. raw token/provider/internal data never returned/logged as appropriate
    it("40. never exposes a raw SMTP error or internal data through the public endpoints", async () => {
      const { id, publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);

      const res = await request(app).post(respondUrl).send({ token, decision: "accepted" });
      const bodyText = JSON.stringify(res.body);
      expect(bodyText).not.toMatch(/ECONNREFUSED|smtp|nodemailer/i);
      expect(bodyText).not.toContain(id);
    });

    it("returns 400 for a malformed respond payload (unknown decision value)", async () => {
      const { publicId } = await createDraft();
      const token = await sendAndCaptureAcceptToken(publicId);
      const res = await request(app).post(respondUrl).send({ token, decision: "maybe" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when the token field is missing", async () => {
      const res = await request(app).post(lookupUrl).send({});
      expect(res.status).toBe(400);
    });
  });

  // ===== REGRESSION =====
  describe("regression", () => {
    // 41. Mark as Hired still only after accepted
    it("41. still blocks Mark as Hired from a merely-sent offer", async () => {
      const { publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);
      const res = await request(app).post(`/api/v1/offers/${publicId}/hire`).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(409);
    });

    // 42. Offer email retry still works
    it("42. offer email retry still recovers from a failed send", async () => {
      const { publicId } = await createDraft();
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(sendRes.body.notification.status).toBe("failed");

      mockSend.mockResolvedValueOnce(undefined);
      const retryRes = await request(app)
        .post(retryUrl(publicId, sendRes.body.notification.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(retryRes.body.notification.status).toBe("sent");
    });

    // 43. Offer notification durability invariant unchanged
    it("43. still persists exactly one notification the moment Send Offer succeeds", async () => {
      const { id, publicId } = await createDraft();
      await sendAndCaptureAcceptToken(publicId);
      expect(await EmailNotification.countDocuments({ offer_id: id, category: "offer_sent" })).toBe(1);
    });

    // 44. Rejection email unaffected
    it("44. rejection email flow is unaffected by the response-token infrastructure", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const res = await request(app)
        .post(`/api/v1/applications/${application.public_id}/reject`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ send_email: true });
      expect(res.status).toBe(200);
      expect(res.body.notification.status).toBe("sent");
      expect(await OfferResponseToken.countDocuments()).toBe(0);
    });
  });

  // ===== Cross-company isolation for the public endpoint's underlying data =====
  it("a token generated for Company A's offer never leaks Company B context (structural — public endpoint has no auth to test cross-company against directly)", async () => {
    const { publicId } = await createDraft();
    const token = await sendAndCaptureAcceptToken(publicId);
    const res = await request(app).post(lookupUrl).send({ token });
    expect(JSON.stringify(res.body)).not.toContain(companyB.id);
    void hrB;
  });
});
