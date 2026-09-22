import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { InterviewFeedback } from "../src/models/InterviewFeedback.model";
import { User } from "../src/models/User.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

jest.mock("../src/services/email/email.service", () => ({
  emailService: { send: jest.fn() },
}));

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function scheduleUrl(applicationId: string) {
  return `/api/v1/applications/${applicationId}/interviews`;
}
function interviewUrl(interviewId: string) {
  return `/api/v1/interviews/${interviewId}`;
}
function feedbackUrl(interviewId: string) {
  return `${interviewUrl(interviewId)}/feedback`;
}
function feedbackMeUrl(interviewId: string) {
  return `${feedbackUrl(interviewId)}/me`;
}
function feedbackSubmitUrl(interviewId: string) {
  return `${feedbackMeUrl(interviewId)}/submit`;
}

function validScheduleBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Backend Technical Interview",
    starts_at: hoursFromNow(24),
    ends_at: hoursFromNow(25),
    timezone: "Asia/Beirut",
    interviewer_user_ids: [],
    ...overrides,
  };
}

describe("Interview Feedback API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let aliceA: UserDoc;
  let bobA: UserDoc;
  let carolA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let interviewStage: HiringStepDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR", name: "Hana HR" });
    aliceA = await createUser({ companyId: companyA.id, email: "alice@a.test", role: "HR", name: "Alice Interviewer" });
    bobA = await createUser({ companyId: companyA.id, email: "bob@a.test", role: "HR", name: "Bob Interviewer" });
    carolA = await createUser({ companyId: companyA.id, email: "carol@a.test", role: "HR", name: "Carol HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    interviewStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 0 });
  });

  async function createApplicationInInterviewStage(): Promise<ApplicationDoc> {
    const candidate = await Candidate.create({
      full_name: "Sarah Ahmed",
      email: `sarah-${new Types.ObjectId().toString()}@candidate.test`,
    });
    return Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
      current_step_id: interviewStage._id,
    });
  }

  async function scheduleOnly(interviewerIds: string[] = [aliceA.id, bobA.id]) {
    const application = await createApplicationInInterviewStage();
    const res = await request(app)
      .post(scheduleUrl(application.id))
      .set("Authorization", authHeaderFor(hrA, companyA.id))
      .send(validScheduleBody({ interviewer_user_ids: interviewerIds }));
    return { application, interviewId: res.body.interview.id as string };
  }

  async function scheduleAndComplete(interviewerIds: string[] = [aliceA.id, bobA.id]) {
    const { application, interviewId } = await scheduleOnly(interviewerIds);
    await request(app).patch(`${interviewUrl(interviewId)}/complete`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
    return { application, interviewId };
  }

  // ===== PERMISSIONS =====
  describe("permissions", () => {
    // 16. assigned interviewer can create draft
    it("allows an assigned interviewer to create a draft", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Good start" });
      expect(res.status).toBe(200);
      expect(res.body.feedback.status).toBe("draft");
    });

    // 17. unassigned same-company User cannot create feedback
    it("rejects an unassigned same-company User with 403", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(carolA, companyA.id))
        .send({ summary: "I was not assigned to this" });
      expect(res.status).toBe(403);
    });

    it("does not create a record for an unassigned User who was rejected", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(carolA, companyA.id))
        .send({ summary: "I was not assigned to this" });
      expect(await InterviewFeedback.countDocuments({ interview_id: interviewId, interviewer_user_id: carolA.id })).toBe(0);
    });

    // 18. cross-company -> 404
    it("returns 404 for a cross-company draft-save attempt", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({ summary: "x" });
      expect(res.status).toBe(404);
    });

    it("returns 404 for a cross-company feedback list request", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(hrB, companyB.id));
      expect(res.status).toBe(404);
    });

    // 19. client cannot submit interviewer_user_id to impersonate another User
    it("rejects a request body that supplies interviewer_user_id (impersonation attempt)", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "x", interviewer_user_id: bobA.id });
      expect(res.status).toBe(400);
    });

    it("always attributes the saved draft to the authenticated caller, never a body field", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Alice wrote this" });
      const bobRecord = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: bobA.id });
      expect(bobRecord).toBeNull();
    });

    // 20. candidate/public route does not exist
    it("rejects an unauthenticated request to the feedback list with 401", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app).get(feedbackUrl(interviewId));
      expect(res.status).toBe(401);
    });

    it("rejects an unauthenticated draft save with 401", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app).put(feedbackMeUrl(interviewId)).send({ summary: "x" });
      expect(res.status).toBe(401);
    });
  });

  // ===== STATE GATING =====
  describe("state gating", () => {
    // 21. scheduled Interview feedback blocked
    it("blocks draft save while the Interview is still scheduled", async () => {
      const { interviewId } = await scheduleOnly();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Too early" });
      expect(res.status).toBe(409);
    });

    it("reports can_edit: false on the roster while the Interview is still scheduled", async () => {
      const { interviewId } = await scheduleOnly();
      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(aliceA, companyA.id));
      expect(res.body.viewer.assigned).toBe(true);
      expect(res.body.viewer.can_edit).toBe(false);
    });

    // 22. cancelled Interview feedback blocked
    it("blocks draft save once the Interview is cancelled", async () => {
      const { interviewId } = await scheduleOnly();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Too late" });
      expect(res.status).toBe(409);
    });

    it("blocks submission once the Interview is cancelled", async () => {
      const { interviewId } = await scheduleOnly();
      await request(app).patch(`${interviewUrl(interviewId)}/cancel`).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Too late" });
      expect(res.status).toBe(409);
    });

    // 23. completed Interview feedback allowed
    it("allows draft save once the Interview is completed", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Now it works" });
      expect(res.status).toBe(200);
    });
  });

  // ===== DRAFT =====
  describe("draft", () => {
    // 24. partial draft saved
    it("saves a partial draft without requiring every field", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Good communicator" });
      expect(res.status).toBe(200);
      expect(res.body.feedback.summary).toBe("Good communicator");
      expect(res.body.feedback.recommendation).toBeNull();
      expect(res.body.feedback.strengths).toBe("");
    });

    // 25. same interviewer updates same draft
    it("updates the SAME draft record on a second save, never creating a duplicate", async () => {
      const { interviewId } = await scheduleAndComplete();
      const first = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Draft v1" });
      const second = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ strengths: "Great communicator" });

      expect(second.body.feedback.id).toBe(first.body.feedback.id);
      // Omitted field from the second save is preserved, not blanked.
      expect(second.body.feedback.summary).toBe("Draft v1");
      expect(second.body.feedback.strengths).toBe("Great communicator");
      expect(await InterviewFeedback.countDocuments({ interview_id: interviewId, interviewer_user_id: aliceA.id })).toBe(1);
    });

    // 26. own draft visible to author
    it("shows the author their own draft content", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "My private draft" });

      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(aliceA, companyA.id));
      expect(res.body.viewer.feedback.summary).toBe("My private draft");
      expect(res.body.viewer.assigned).toBe(true);
      expect(res.body.viewer.can_edit).toBe(true);
    });

    // 27. another HR cannot see unfinished draft
    it("never exposes another interviewer's unfinished draft content to a same-company HR", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "My private draft" });

      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(carolA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.viewer.assigned).toBe(false);
      expect(res.body.viewer.feedback).toBeNull();

      const aliceEntry = res.body.interviewers.find((entry: { interviewer: { id: string } }) => entry.interviewer.id === aliceA.id);
      expect(aliceEntry.status).toBe("draft");
      expect(aliceEntry.feedback).toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/My private draft/);
    });

    it("never exposes another interviewer's draft to a different ASSIGNED interviewer either", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Alice's private draft" });

      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(bobA, companyA.id));
      expect(res.body.viewer.feedback).toBeNull();
      expect(JSON.stringify(res.body)).not.toMatch(/Alice's private draft/);
    });

    it("shows not_started for an assigned interviewer who has not begun feedback", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const bobEntry = res.body.interviewers.find((entry: { interviewer: { id: string } }) => entry.interviewer.id === bobA.id);
      expect(bobEntry.status).toBe("not_started");
      expect(bobEntry.feedback).toBeNull();
    });
  });

  // ===== SUBMISSION =====
  describe("submission", () => {
    // 28. recommendation required
    it("rejects submission without a recommendation", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Great candidate" });
      expect(res.status).toBe(400);
    });

    // 29. summary required
    it("rejects submission without a summary", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes" });
      expect(res.status).toBe(400);
    });

    it("rejects an invalid recommendation value", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "super_yes", summary: "x" });
      expect(res.status).toBe(400);
    });

    // 30. submit changes status to submitted
    it("changes status to submitted on success", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "strong_yes", summary: "Excellent candidate." });
      expect(res.status).toBe(200);
      expect(res.body.feedback.status).toBe("submitted");
    });

    // 31. submitted_at populated
    it("populates submitted_at", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Solid." });
      expect(res.body.feedback.submitted_at).toEqual(expect.any(String));
    });

    // 32. submitted feedback visible to same-company HR
    it("makes submitted feedback visible to a same-company, unassigned HR", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Solid.", strengths: "Communicates well", concerns: "None", private_notes: "Would hire" });

      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(carolA, companyA.id));
      const aliceEntry = res.body.interviewers.find((entry: { interviewer: { id: string } }) => entry.interviewer.id === aliceA.id);
      expect(aliceEntry.status).toBe("submitted");
      expect(aliceEntry.feedback.summary).toBe("Solid.");
      expect(aliceEntry.feedback.strengths).toBe("Communicates well");
      expect(aliceEntry.feedback.concerns).toBe("None");
      expect(aliceEntry.feedback.private_notes).toBe("Would hire");
      expect(aliceEntry.feedback.recommendation).toBe("yes");
    });

    // 33. submitted feedback becomes immutable
    it("refuses a draft-save attempt on an already-submitted record", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Solid." });

      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Changed my mind" });
      expect(res.status).toBe(409);

      const stored = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: aliceA.id });
      expect(stored?.summary).toBe("Solid.");
    });

    // 34. second submit safe/conflict according to chosen contract
    it("rejects a second submit attempt with a conflict, never silently re-writing content", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Solid." });

      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "no", summary: "Changed my mind." });
      expect(res.status).toBe(409);

      const stored = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: aliceA.id });
      expect(stored?.recommendation).toBe("yes");
      expect(stored?.summary).toBe("Solid.");
    });

    // 35. another User cannot edit submitted feedback
    it("never lets one interviewer's submit touch another interviewer's record", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Alice's real feedback." });

      const bobRes = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ recommendation: "no", summary: "Bob's own feedback." });
      expect(bobRes.status).toBe(200);

      const aliceRecord = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: aliceA.id });
      expect(aliceRecord?.recommendation).toBe("yes");
      expect(aliceRecord?.summary).toBe("Alice's real feedback.");
    });
  });

  // ===== MULTI-INTERVIEWER =====
  describe("multiple interviewers", () => {
    // 36. Alice and Bob each have independent feedback
    it("keeps Alice's and Bob's feedback fully independent", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Alice's notes" });
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ summary: "Bob's notes" });

      const aliceRecord = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: aliceA.id });
      const bobRecord = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: bobA.id });
      expect(aliceRecord?.summary).toBe("Alice's notes");
      expect(bobRecord?.summary).toBe("Bob's notes");
    });

    // 37. Alice cannot change Bob's feedback
    it("never lets Alice's draft save touch Bob's record", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ summary: "Bob's original" });
      await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "Alice's own" });

      const bobRecord = await InterviewFeedback.findOne({ interview_id: interviewId, interviewer_user_id: bobA.id });
      expect(bobRecord?.summary).toBe("Bob's original");
    });

    // 38. feedback status/progress accurately shows 1/2 and 2/2
    it("reports feedback_progress as 0/2, then 1/2, then 2/2", async () => {
      const { interviewId } = await scheduleAndComplete();

      let detail = await request(app).get(interviewUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detail.body.interview.feedback_progress).toEqual({ submitted: 0, total: 2 });

      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Good." });
      detail = await request(app).get(interviewUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detail.body.interview.feedback_progress).toEqual({ submitted: 1, total: 2 });

      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(bobA, companyA.id))
        .send({ recommendation: "mixed", summary: "OK." });
      detail = await request(app).get(interviewUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detail.body.interview.feedback_progress).toEqual({ submitted: 2, total: 2 });
    });

    it("reports feedback_progress as null for a still-scheduled Interview", async () => {
      const { interviewId } = await scheduleOnly();
      const detail = await request(app).get(interviewUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(detail.body.interview.feedback_progress).toBeNull();
    });
  });

  // ===== PIPELINE (feedback never moves the Application) =====
  describe("pipeline behavior", () => {
    // 41. feedback submission does not move stage
    it("does not change Application.status or Application.current_step_id on submission", async () => {
      const { application, interviewId } = await scheduleAndComplete();
      const before = await Application.findById(application.id);

      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Good." });

      const after = await Application.findById(application.id);
      expect(after?.status).toBe(before?.status);
      expect(after?.current_step_id?.toString()).toBe(before?.current_step_id?.toString());
    });

    // 42. recommendation "strong_yes" produces zero pipeline mutation
    it("produces zero pipeline mutation for a strong_yes recommendation", async () => {
      const { application, interviewId } = await scheduleAndComplete();
      const before = await Application.findById(application.id);

      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "strong_yes", summary: "Amazing candidate, hire immediately." });

      const after = await Application.findById(application.id);
      expect(after?.status).toBe(before?.status);
      expect(after?.current_step_id?.toString()).toBe(before?.current_step_id?.toString());
    });

    // 43. recommendation "no" produces zero rejection/final-decision mutation
    it("produces zero rejection/final-decision mutation for a no recommendation", async () => {
      const { application, interviewId } = await scheduleAndComplete();
      const before = await Application.findById(application.id);

      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "no", summary: "Not a fit for this role." });

      const after = await Application.findById(application.id);
      expect(after?.status).toBe(before?.status);
      expect(after?.current_step_id?.toString()).toBe(before?.current_step_id?.toString());
    });
  });

  // ===== HISTORY =====
  describe("history", () => {
    // 44. interviewer snapshot remains after User profile/name changes
    it("keeps the original interviewer snapshot after the User's name/email later change", async () => {
      const { interviewId } = await scheduleAndComplete();
      await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "Good." });

      await User.updateOne({ _id: aliceA.id }, { $set: { name: "Alice Renamed", email: "alice-new@example.test" } });

      const res = await request(app).get(feedbackUrl(interviewId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      const aliceEntry = res.body.interviewers.find((entry: { interviewer: { id: string } }) => entry.interviewer.id === aliceA.id);
      expect(aliceEntry.interviewer.name).toBe("Alice Interviewer");
      expect(aliceEntry.feedback.interviewer.name).toBe("Alice Interviewer");
      expect(aliceEntry.feedback.interviewer.email).toBe("alice@a.test");
    });
  });

  // ===== VALIDATION =====
  describe("validation", () => {
    it("rejects a summary over the max length on submit", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .post(feedbackSubmitUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ recommendation: "yes", summary: "x".repeat(4001) });
      expect(res.status).toBe(400);
    });

    it("rejects an unexpected field on draft save", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "x", score: 5 });
      expect(res.status).toBe(400);
    });

    it("trims whitespace on saved text fields", async () => {
      const { interviewId } = await scheduleAndComplete();
      const res = await request(app)
        .put(feedbackMeUrl(interviewId))
        .set("Authorization", authHeaderFor(aliceA, companyA.id))
        .send({ summary: "   Trimmed please   " });
      expect(res.body.feedback.summary).toBe("Trimmed please");
    });
  });
});
