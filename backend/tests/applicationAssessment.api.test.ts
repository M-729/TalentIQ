import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job, type JobDoc } from "../src/models/Job.model";
import { Candidate, type CandidateDoc } from "../src/models/Candidate.model";
import { Application, type ApplicationDoc } from "../src/models/Application.model";
import { HiringStep, type HiringStepDoc } from "../src/models/HiringStep.model";
import { ApplicationAssessment } from "../src/models/ApplicationAssessment.model";
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
  return `/api/v1/applications/${applicationId}/assessment`;
}
function assessmentUrl(assessmentId: string) {
  return `/api/v1/application-assessments/${assessmentId}`;
}
function resultUrl(assessmentId: string) {
  return `/api/v1/application-assessments/${assessmentId}/result`;
}
function sendUrl(assessmentId: string) {
  return `/api/v1/application-assessments/${assessmentId}/send`;
}
function notificationsUrl(assessmentId: string) {
  return `/api/v1/application-assessments/${assessmentId}/notifications`;
}
function retryUrl(assessmentId: string, notificationId: string) {
  return `/api/v1/application-assessments/${assessmentId}/notifications/${notificationId}/retry`;
}
function listUrl(query = "") {
  return `/api/v1/application-assessments${query}`;
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Backend Technical Test",
    external_url: "https://external-platform.example/test/abc",
    ...overrides,
  };
}

describe("External Assessment API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;
  let jobA: JobDoc;
  let review: HiringStepDoc;
  let interviewStage: HiringStepDoc;
  let assessmentStage: HiringStepDoc;
  let candidate: CandidateDoc;
  let application: ApplicationDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });

    jobA = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Backend Developer", status: "active" });
    review = await HiringStep.create({ job_id: jobA.id, name: "Application Review", type: "review", position: 0 });
    interviewStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Interview", type: "interview", position: 1 });
    assessmentStage = await HiringStep.create({ job_id: jobA.id, name: "Technical Assessment", type: "assessment", position: 2 });

    candidate = await Candidate.create({
      full_name: "Ahmad Khalil",
      email: `ahmad-${new Types.ObjectId().toString()}@candidate.test`,
    });
    application = await Application.create({
      job_id: jobA.id,
      candidate_id: candidate._id,
      cv_file: { storage_key: "talentiq/cvs/x", original_name: "resume.pdf", mime_type: "application/pdf", size_bytes: 100 },
      status: "in_process",
      current_step_id: assessmentStage._id,
    });

    mockSend.mockReset();
  });

  // ===== 1-10: ASSESSMENT CREATION =====
  describe("creation eligibility", () => {
    it("1. allows creation for an application currently in an assessment-type stage", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(201);
      expect(res.body.assessment.name).toBe("Backend Technical Test");
      expect(res.body.assessment.status).toBe("pending");
      expect(res.body.assessment.hiring_step_id).toBe(assessmentStage.id);
    });

    it("2. blocks creation when the application is in a review-type stage", async () => {
      await Application.updateOne({ _id: application.id }, { $set: { current_step_id: review._id } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
      expect(await ApplicationAssessment.countDocuments()).toBe(0);
    });

    it("3. blocks creation when the application is in an interview-type stage", async () => {
      await Application.updateOne({ _id: application.id }, { $set: { current_step_id: interviewStage._id } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
    });

    it("4. blocks creation when the assessment-type stage belongs to a different Job", async () => {
      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Other Job", status: "active" });
      const foreignStep = await HiringStep.create({ job_id: otherJob.id, name: "Foreign Assessment", type: "assessment", position: 0 });
      // Simulates corrupted/legacy cross-job current_step_id — never reachable through the normal API.
      await Application.updateOne({ _id: application.id }, { $set: { current_step_id: foreignStep._id } });

      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
    });

    it.each(["rejected", "offered", "hired"] as const)("5. blocks creation for a(n) %s (terminal) application", async (status) => {
      await Application.updateOne({ _id: application.id }, { $set: { status } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(409);
    });

    it("6. blocks creation for an application whose Job is soft-deleted", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(404);
    });

    it("7. allows creation for an existing candidate when the Job is closed (not deleted)", async () => {
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(201);
    });

    it("8. prevents a duplicate assessment for the same application + stage", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ name: "A different name" }));
      expect(res.status).toBe(409);
      expect(await ApplicationAssessment.countDocuments()).toBe(1);
    });

    it.each(["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://external-platform.example/test"])(
      "9. rejects an unsafe external_url scheme (%s)",
      async (unsafeUrl) => {
        const res = await request(app)
          .post(createUrl(application.public_id!))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send(validBody({ external_url: unsafeUrl }));
        expect(res.status).toBe(400);
        expect(await ApplicationAssessment.countDocuments()).toBe(0);
      }
    );

    it("10. returns 404 for a cross-company application (tenant isolation)", async () => {
      const otherJob = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Job B", status: "active" });
      const otherCandidate = await Candidate.create({ full_name: "Other Candidate", email: "other@candidate.test" });
      const otherStage = await HiringStep.create({ job_id: otherJob.id, name: "Assessment", type: "assessment", position: 0 });
      const otherApplication = await Application.create({
        job_id: otherJob.id,
        candidate_id: otherCandidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
        current_step_id: otherStage._id,
      });

      const res = await request(app).post(createUrl(otherApplication.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.status).toBe(404);
    });

    it("rejects a name over the max length", async () => {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ name: "a".repeat(151) }));
      expect(res.status).toBe(400);
    });

    it("rejects unknown fields on the request body", async () => {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody({ status: "passed", company_id: companyB.id }));
      expect(res.status).toBe(400);
    });

    it("GET returns null when no assessment exists for the current stage yet", async () => {
      const res = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.assessment).toBeNull();
    });

    it("GET returns the assessment for the current stage once created", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const res = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessment.name).toBe("Backend Technical Test");
    });
  });

  // ===== ASSESSMENT HISTORY (preserved after pipeline movement) =====
  describe("GET /api/v1/applications/:applicationId/assessment/history", () => {
    function historyUrl(applicationId: string) {
      return `/api/v1/applications/${applicationId}/assessment/history`;
    }
    function moveReq(applicationId: string, stepId: string) {
      return request(app)
        .patch(`/api/v1/applications/${applicationId}/hiring-step`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ step_id: stepId });
    }

    it("returns an empty array (never 404) when no assessment has ever been created", async () => {
      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.assessments).toEqual([]);
    });

    // 1 & 2 (covered by existing GET .../assessment tests above) + is_current wiring
    it("marks the current-stage record is_current: true while still on that stage", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.body.assessments).toHaveLength(1);
      expect(res.body.assessments[0].id).toBe(createRes.body.assessment.id);
      expect(res.body.assessments[0].is_current).toBe(true);
      expect(res.body.assessments[0].stage).toEqual({ id: assessmentStage.id, name: "Technical Assessment", type: "assessment" });
    });

    // 3. candidate moves from Assessment to Interview -> previous assessment remains visible
    it("keeps a historical assessment visible after the candidate moves to a different stage", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      await moveReq(application.public_id!, interviewStage.id);

      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments).toHaveLength(1);
      expect(res.body.assessments[0].name).toBe("Backend Technical Test");
      expect(res.body.assessments[0].is_current).toBe(false);
    });

    // 4. historical Passed + grade remains visible
    it("keeps a historical Passed result and grade visible after the candidate moves on", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      await request(app)
        .patch(resultUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed", grade: 87 });
      await moveReq(application.public_id!, interviewStage.id);

      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments[0].status).toBe("passed");
      expect(res.body.assessments[0].grade).toBe(87);
    });

    // 5. historical notes remain visible
    it("keeps historical notes visible after the candidate moves on", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      await request(app)
        .patch(resultUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed", notes: "Strong result" });
      await moveReq(application.public_id!, interviewStage.id);

      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments[0].notes).toBe("Strong result");
    });

    // 7. multiple historical assessment-stage records render deterministically
    it("returns multiple historical assessment records, newest first", async () => {
      const createRes1 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "First Assessment" }));
      await request(app).patch(resultUrl(createRes1.body.assessment.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed" });
      await moveReq(application.public_id!, review.id);

      const secondStage = await HiringStep.create({ job_id: jobA.id, name: "Follow-up Assessment", type: "assessment", position: 3 });
      await moveReq(application.public_id!, secondStage.id);
      const createRes2 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "Second Assessment" }));

      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments).toHaveLength(2);
      expect(res.body.assessments.map((a: { id: string }) => a.id)).toEqual([createRes2.body.assessment.id, createRes1.body.assessment.id]);
      expect(res.body.assessments[0].is_current).toBe(true);
      expect(res.body.assessments[1].is_current).toBe(false);
    });

    // 8/9. no N+1 — every record here has its own stage_snapshot, so the
    // legacy live-HiringStep fallback should never even run.
    it("does not issue any HiringStep query when every historical record has a stage_snapshot (no N+1)", async () => {
      const createRes1 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "First" }));
      await request(app).patch(resultUrl(createRes1.body.assessment.id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed" });
      await moveReq(application.public_id!, review.id);
      const secondStage = await HiringStep.create({ job_id: jobA.id, name: "Second Assessment Stage", type: "assessment", position: 3 });
      await moveReq(application.public_id!, secondStage.id);
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "Second" }));

      const findSpy = jest.spyOn(HiringStep, "find");
      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.assessments).toHaveLength(2);
      expect(findSpy).not.toHaveBeenCalled();
      findSpy.mockRestore();
    });

    // 9. no N+1 even when legacy (snapshot-less) records are mixed in with
    // snapshot-bearing ones — the fallback batches by distinct stage, not
    // once per record.
    it("batches the legacy-fallback HiringStep lookup instead of issuing one query per legacy record (no N+1)", async () => {
      const createRes1 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "First" }));
      await moveReq(application.public_id!, review.id);
      const secondStage = await HiringStep.create({ job_id: jobA.id, name: "Second Assessment Stage", type: "assessment", position: 3 });
      await moveReq(application.public_id!, secondStage.id);
      const createRes2 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "Second" }));

      // Simulate legacy data: strip stage_snapshot from both existing records.
      await ApplicationAssessment.updateMany(
        { _id: { $in: [createRes1.body.assessment.id, createRes2.body.assessment.id] } },
        { $unset: { stage_snapshot: "" } }
      );

      const findSpy = jest.spyOn(HiringStep, "find");
      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.assessments).toHaveLength(2);
      expect(findSpy).toHaveBeenCalledTimes(1);
      findSpy.mockRestore();
    });

    // 9. company isolation unchanged
    it("returns 404 for a cross-company application", async () => {
      const otherJob = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Job B", status: "active" });
      const otherCandidate = await Candidate.create({ full_name: "Other Candidate", email: "other-hist@candidate.test" });
      const otherStage = await HiringStep.create({ job_id: otherJob.id, name: "Assessment", type: "assessment", position: 0 });
      const otherApplication = await Application.create({
        job_id: otherJob.id,
        candidate_id: otherCandidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
        current_step_id: otherStage._id,
      });

      const res = await request(app).get(historyUrl(otherApplication.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("remains readable even after the Job is soft-deleted (historical read, not a new write)", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.assessments).toHaveLength(1);
    });

    // Stage snapshot immutability (ticket C)
    describe("stage_snapshot immutability", () => {
      // 1. assessment creation persists stage_snapshot
      it("persists a stage_snapshot at creation time", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const stored = await ApplicationAssessment.findById(createRes.body.assessment.id);
        expect(stored!.stage_snapshot).toEqual(
          expect.objectContaining({ id: assessmentStage._id, name: "Technical Assessment", type: "assessment" })
        );
      });

      // 2. stage renamed later -> assessment history still shows original name
      it("keeps showing the original stage name in history after the HiringStep is renamed", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        await HiringStep.updateOne({ _id: assessmentStage.id }, { $set: { name: "Renamed Assessment Stage" } });

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        expect(res.body.assessments[0].id).toBe(createRes.body.assessment.id);
        expect(res.body.assessments[0].stage).toEqual({ id: assessmentStage.id, name: "Technical Assessment", type: "assessment" });
      });

      // 3. stage type/name changes do not mutate the historical snapshot
      it("does not mutate the stored stage_snapshot when the live HiringStep's name/type change", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        await HiringStep.updateOne({ _id: assessmentStage.id }, { $set: { name: "Totally Different Name" } });

        const stored = await ApplicationAssessment.findById(createRes.body.assessment.id);
        expect(stored!.stage_snapshot!.name).toBe("Technical Assessment");
      });

      // 4. stage deleted later -> history still shows original snapshot
      it("keeps showing the original stage identity in history after the HiringStep is deleted", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        // Move away first so the stage is no longer referenced by
        // current_step_id (the existing deletion-in-use rule only guards
        // that reference, not ApplicationAssessment.hiring_step_id).
        await moveReq(application.public_id!, review.id);
        await request(app)
          .delete(`/api/v1/jobs/${jobA.public_id}/hiring-steps/${assessmentStage.public_id}`)
          .set("Authorization", authHeaderFor(hrA, companyA.id));

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        expect(res.body.assessments[0].id).toBe(createRes.body.assessment.id);
        expect(res.body.assessments[0].stage).toEqual({ id: assessmentStage.id, name: "Technical Assessment", type: "assessment" });
      });

      // 5. candidate moves to another assessment stage -> old snapshot remains original
      it("leaves the old record's snapshot untouched after the candidate moves to a new assessment stage", async () => {
        const createRes1 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "First" }));
        await moveReq(application.public_id!, review.id);
        const secondStage = await HiringStep.create({ job_id: jobA.id, name: "Second Assessment Stage", type: "assessment", position: 3 });
        await moveReq(application.public_id!, secondStage.id);
        await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "Second" }));

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        const firstRecord = res.body.assessments.find((a: { id: string }) => a.id === createRes1.body.assessment.id);
        expect(firstRecord.stage).toEqual({ id: assessmentStage.id, name: "Technical Assessment", type: "assessment" });
      });

      // 6. new assessment in new stage gets its own new snapshot
      it("gives the new assessment in the new stage its own distinct stage_snapshot", async () => {
        await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "First" }));
        await moveReq(application.public_id!, review.id);
        const secondStage = await HiringStep.create({ job_id: jobA.id, name: "Second Assessment Stage", type: "assessment", position: 3 });
        await moveReq(application.public_id!, secondStage.id);
        const createRes2 = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "Second" }));

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        const secondRecord = res.body.assessments.find((a: { id: string }) => a.id === createRes2.body.assessment.id);
        expect(secondRecord.stage).toEqual({ id: secondStage.id, name: "Second Assessment Stage", type: "assessment" });
      });

      // 7. legacy assessment without snapshot falls back safely
      it("falls back to the live HiringStep for a legacy record with no stage_snapshot", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        await ApplicationAssessment.updateOne({ _id: createRes.body.assessment.id }, { $unset: { stage_snapshot: "" } });

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        expect(res.body.assessments[0].stage).toEqual({ id: assessmentStage.id, name: "Technical Assessment", type: "assessment" });
      });

      it("does not crash and returns a null stage for a legacy record whose live HiringStep is also gone", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        await ApplicationAssessment.updateOne({ _id: createRes.body.assessment.id }, { $unset: { stage_snapshot: "" } });
        await moveReq(application.public_id!, review.id);
        await request(app)
          .delete(`/api/v1/jobs/${jobA.public_id}/hiring-steps/${assessmentStage.public_id}`)
          .set("Authorization", authHeaderFor(hrA, companyA.id));

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        expect(res.status).toBe(200);
        expect(res.body.assessments[0].stage).toBeNull();
      });

      // 10. current-stage detection still uses hiring_step_id, never snapshot content
      it("still determines is_current via hiring_step_id, not by comparing snapshot name/type", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const otherAssessmentStage = await HiringStep.create({ job_id: jobA.id, name: "Another Assessment Stage", type: "assessment", position: 3 });
        await moveReq(application.public_id!, otherAssessmentStage.id);

        const res = await request(app).get(historyUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        const original = res.body.assessments.find((a: { id: string }) => a.id === createRes.body.assessment.id);
        // Even though the old record's snapshot.type ("assessment") matches
        // the type of the stage the candidate is now on, is_current must be
        // false — it is computed strictly from hiring_step_id equality.
        expect(original.is_current).toBe(false);
        expect(original.stage).toEqual({ id: assessmentStage.id, name: "Technical Assessment", type: "assessment" });
      });
    });
  });

  // ===== EDIT LINK (Part 7) =====
  describe("editing the assessment link", () => {
    it("allows correcting name/external_url before a result is recorded", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const assessmentId = createRes.body.assessment.public_id;

      const res = await request(app)
        .patch(assessmentUrl(assessmentId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Corrected Name", external_url: "https://external-platform.example/test/corrected" });

      expect(res.status).toBe(200);
      expect(res.body.assessment.name).toBe("Corrected Name");
      expect(res.body.assessment.external_url).toBe("https://external-platform.example/test/corrected");
    });

    it("editing the link after a failed send does not automatically send a new email", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const assessmentId = createRes.body.assessment.id;
      const assessmentPublicId = createRes.body.assessment.public_id;
      await request(app).post(sendUrl(assessmentPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockSend.mockClear();
      await request(app)
        .patch(assessmentUrl(assessmentPublicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ external_url: "https://external-platform.example/test/corrected" });

      expect(mockSend).not.toHaveBeenCalled();
      expect(await EmailNotification.countDocuments({ application_assessment_id: assessmentId })).toBe(1);
    });

    it("rejects unknown fields (status/grade) on the edit-link endpoint", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const res = await request(app)
        .patch(assessmentUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed" });
      expect(res.status).toBe(400);
    });

    it("returns 404 for a cross-company edit attempt", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const res = await request(app)
        .patch(assessmentUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({ name: "Hijacked" });
      expect(res.status).toBe(404);
    });

    it("does not overwrite grade/notes recorded while still pending when the link is later edited", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const assessmentId = createRes.body.assessment.public_id;
      // A result row can carry grade/notes while status is still explicitly
      // "pending" (see recording-a-result test 11/14) — editing the link at
      // that point must still leave those alone.
      await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "pending", grade: 40, notes: "In progress" });

      const res = await request(app)
        .patch(assessmentUrl(assessmentId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Corrected Name" });

      expect(res.status).toBe(200);
      expect(res.body.assessment.status).toBe("pending");
      expect(res.body.assessment.grade).toBe(40);
      expect(res.body.assessment.notes).toBe("In progress");
    });

    // Stage snapshot immutability hardening: name/link become read-only
    // once a result is recorded — see updateAssessmentLink's own doc
    // comment for the rationale.
    describe("read-only after a result is recorded", () => {
      // 1. pending assessment can edit name/link
      it("allows editing name/link while the assessment is still pending", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const res = await request(app)
          .patch(assessmentUrl(createRes.body.assessment.public_id))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send({ name: "Updated Name" });
        expect(res.status).toBe(200);
        expect(res.body.assessment.name).toBe("Updated Name");
      });

      // 2. passed assessment cannot edit name/link
      it("rejects a name/link edit once the assessment has been marked passed", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.public_id;
        await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 90 });

        const res = await request(app)
          .patch(assessmentUrl(assessmentId))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send({ name: "Should Not Apply" });
        expect(res.status).toBe(409);
      });

      // 3. failed assessment cannot edit name/link
      it("rejects a name/link edit once the assessment has been marked failed", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.public_id;
        await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed" });

        const res = await request(app)
          .patch(assessmentUrl(assessmentId))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send({ external_url: "https://external-platform.example/test/should-not-apply" });
        expect(res.status).toBe(409);
      });

      // 4. backend rejects a direct edit attempt after a result and mutates nothing
      it("leaves the name/link completely untouched after a rejected post-result edit attempt", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.id;
        const assessmentPublicId = createRes.body.assessment.public_id;
        await request(app).patch(resultUrl(assessmentPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 77 });

        await request(app)
          .patch(assessmentUrl(assessmentPublicId))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send({ name: "Attempted Change", external_url: "https://external-platform.example/test/attempted" });

        const stored = await ApplicationAssessment.findById(assessmentId);
        expect(stored!.name).toBe("Backend Technical Test");
        expect(stored!.external_url).toBe("https://external-platform.example/test/abc");
        expect(stored!.status).toBe("passed");
        expect(stored!.grade).toBe(77);
      });

      // 8. result-edit behavior unchanged — recording/correcting a result
      // still works fine even though the link is now locked.
      it("still allows correcting the result after the link has become locked", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.public_id;
        await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed" });

        const res = await request(app)
          .patch(resultUrl(assessmentId))
          .set("Authorization", authHeaderFor(hrA, companyA.id))
          .send({ status: "passed", grade: 95, notes: "Retake succeeded" });

        expect(res.status).toBe(200);
        expect(res.body.assessment.status).toBe("passed");
        expect(res.body.assessment.grade).toBe(95);
        expect(res.body.assessment.notes).toBe("Retake succeeded");
      });

      // 7. Open Assessment / Copy Link rely on external_url/name still being
      // readable from the API after lock — GET still returns them normally.
      it("still returns the (now read-only) name/link via GET after a result is recorded", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.public_id;
        await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 90 });

        const res = await request(app).get(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id));
        expect(res.body.assessment.name).toBe("Backend Technical Test");
        expect(res.body.assessment.external_url).toBe("https://external-platform.example/test/abc");
      });

      // 9. same-company HR/ADMIN permissions unchanged — an ADMIN can still
      // edit while pending, and is still rejected the same way once locked.
      it("still allows a same-company ADMIN to edit while pending, and rejects them the same way once locked", async () => {
        const adminA = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.public_id;

        const pendingRes = await request(app)
          .patch(assessmentUrl(assessmentId))
          .set("Authorization", authHeaderFor(adminA, companyA.id))
          .send({ name: "Admin Edited" });
        expect(pendingRes.status).toBe(200);

        await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed" });

        const lockedRes = await request(app)
          .patch(assessmentUrl(assessmentId))
          .set("Authorization", authHeaderFor(adminA, companyA.id))
          .send({ name: "Should Not Apply" });
        expect(lockedRes.status).toBe(409);
      });

      // 10. cross-company rules unchanged — a locked assessment still 404s
      // for a different company, never leaking a 409 that would confirm
      // the record's existence/status to an unauthorized company.
      it("still returns 404 (not 409) for a cross-company edit attempt on a locked assessment", async () => {
        const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
        const assessmentId = createRes.body.assessment.public_id;
        await request(app).patch(resultUrl(assessmentId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed" });

        const res = await request(app)
          .patch(assessmentUrl(assessmentId))
          .set("Authorization", authHeaderFor(hrB, companyB.id))
          .send({ name: "Hijacked" });
        expect(res.status).toBe(404);
      });
    });
  });

  // ===== 11-22: RESULT =====
  describe("recording a result", () => {
    async function createOne() {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody());
      return res.body.assessment.public_id as string;
    }

    it("11. accepts a pending result", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "pending" });
      expect(res.status).toBe(200);
      expect(res.body.assessment.status).toBe("pending");
    });

    it("12. accepts a passed result", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed" });
      expect(res.status).toBe(200);
      expect(res.body.assessment.status).toBe("passed");
    });

    it("13. accepts a failed result", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed" });
      expect(res.status).toBe(200);
      expect(res.body.assessment.status).toBe("failed");
    });

    it("14. grade is optional — passed with no grade is valid", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed" });
      expect(res.status).toBe(200);
      expect(res.body.assessment.grade).toBeNull();
    });

    it("15. grade 0 is valid", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed", grade: 0 });
      expect(res.status).toBe(200);
      expect(res.body.assessment.grade).toBe(0);
    });

    it("16. grade 100 is valid", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 100 });
      expect(res.status).toBe(200);
      expect(res.body.assessment.grade).toBe(100);
    });

    it("17. grade below 0 is rejected", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed", grade: -1 });
      expect(res.status).toBe(400);
    });

    it("18. grade above 100 is rejected", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 101 });
      expect(res.status).toBe(400);
    });

    it("accepts a decimal grade (e.g. 72.5)", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 72.5 });
      expect(res.status).toBe(200);
      expect(res.body.assessment.grade).toBe(72.5);
    });

    it("19. recording a result never moves the Application's current_step_id", async () => {
      const id = await createOne();
      await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 90 });
      const reread = await Application.findById(application.id);
      expect(reread?.current_step_id?.toString()).toBe(assessmentStage.id);
      expect(reread?.status).toBe("in_process");
    });

    it("20. a failed result never rejects the Application", async () => {
      const id = await createOne();
      await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed", grade: 10 });
      const reread = await Application.findById(application.id);
      expect(reread?.status).toBe("in_process");
    });

    it("21. a passed result never moves the Application", async () => {
      const id = await createOne();
      await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 100 });
      const reread = await Application.findById(application.id);
      expect(reread?.current_step_id?.toString()).toBe(assessmentStage.id);
    });

    it("22. rejects notes over the max length", async () => {
      const id = await createOne();
      const res = await request(app)
        .patch(resultUrl(id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed", notes: "a".repeat(4001) });
      expect(res.status).toBe(400);
    });

    it("accepts and persists notes", async () => {
      const id = await createOne();
      const res = await request(app)
        .patch(resultUrl(id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed", grade: 84, notes: "Strong API knowledge, weaker SQL section." });
      expect(res.body.assessment.notes).toBe("Strong API knowledge, weaker SQL section.");
    });

    it("sets result_recorded_at when a result is saved", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed" });
      expect(res.body.assessment.result_recorded_at).not.toBeNull();
    });

    it("allows correcting an already-recorded result (controlled update, not append-only)", async () => {
      const id = await createOne();
      await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "failed", grade: 40 });
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed", grade: 85 });
      expect(res.status).toBe(200);
      expect(res.body.assessment.status).toBe("passed");
      expect(res.body.assessment.grade).toBe(85);
    });

    it("rejects an invalid status value", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "graded" });
      expect(res.status).toBe(400);
    });

    it("requires status on the result endpoint", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ grade: 90 });
      expect(res.status).toBe(400);
    });

    it("returns 404 for a cross-company result submission", async () => {
      const id = await createOne();
      const res = await request(app).patch(resultUrl(id)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({ status: "passed" });
      expect(res.status).toBe(404);
    });
  });

  // ===== 23-37: EMAIL =====
  describe("candidate email", () => {
    async function createOne() {
      const res = await request(app)
        .post(createUrl(application.public_id!))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send(validBody());
      return { id: res.body.assessment.id as string, publicId: res.body.assessment.public_id as string };
    }

    it("23. explicit Send Assessment works", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { publicId } = await createOne();
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(201);
      expect(res.body.notification.status).toBe("sent");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("24. creating the assessment alone sends no email", async () => {
      await createOne();
      expect(mockSend).not.toHaveBeenCalled();
      expect(await EmailNotification.countDocuments()).toBe(0);
    });

    it("25. the candidate recipient comes from trusted Candidate data, never the request body", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { id, publicId } = await createOne();
      // The strict send-body schema rejects a client-supplied recipient
      // outright (never merely ignores it) — a stronger guarantee than
      // "the server happens to overwrite it". A normal, valid (empty)
      // send confirms the recipient always resolves to the real
      // candidate's own trusted email.
      const attackRes = await request(app)
        .post(sendUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ recipient_email: "attacker@evil.test" });
      expect(attackRes.status).toBe(400);

      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(201);

      const notification = await EmailNotification.findOne({ application_assessment_id: id });
      expect(notification?.recipient_email).toBe(candidate.email.toLowerCase());
    });

    it("26. the external URL is included in the email content", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { publicId } = await createOne();
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [callArgs] = mockSend.mock.calls[0]!;
      expect(callArgs.text).toContain("https://external-platform.example/test/abc");
      expect(callArgs.html).toContain("https://external-platform.example/test/abc");
    });

    it("27. notes/result/grade are excluded from the candidate email", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { publicId } = await createOne();
      await request(app)
        .patch(resultUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed", grade: 84, notes: "Strong API knowledge, weaker SQL section." });
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [callArgs] = mockSend.mock.calls[0]!;
      expect(callArgs.text).not.toMatch(/84|Passed|Strong API knowledge/);
      expect(callArgs.html).not.toMatch(/84|Passed|Strong API knowledge/);
    });

    it("28. an SMTP failure does not remove the assessment record", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { id, publicId } = await createOne();
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(await ApplicationAssessment.findById(id)).not.toBeNull();
    });

    it("29. delivery failure is persisted safely (status failed, safe failure_code)", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { publicId } = await createOne();
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(res.status).toBe(201);
      expect(res.body.notification.status).toBe("failed");
      expect(res.body.notification.failure_code).toBe("delivery_failed");
    });

    it("30. retrying a failed notification works", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { id, publicId } = await createOne();
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const notificationId = sendRes.body.notification.id;
      const notificationPublicId = sendRes.body.notification.public_id;

      mockSend.mockResolvedValueOnce(undefined);
      const retryRes = await request(app)
        .post(retryUrl(publicId, notificationPublicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.notification.status).toBe("sent");
      expect(retryRes.body.notification.id).toBe(notificationId);
      expect(await EmailNotification.countDocuments({ application_assessment_id: id })).toBe(1);
    });

    it("31. retry uses the original immutable snapshot, not the assessment's current data", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { publicId } = await createOne();
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const notificationPublicId = sendRes.body.notification.public_id;

      await request(app)
        .patch(assessmentUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ external_url: "https://external-platform.example/test/corrected" });

      mockSend.mockResolvedValueOnce(undefined);
      await request(app).post(retryUrl(publicId, notificationPublicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const [callArgs] = mockSend.mock.calls[mockSend.mock.calls.length - 1]!;
      expect(callArgs.text).toContain("https://external-platform.example/test/abc");
      expect(callArgs.text).not.toContain("corrected");
    });

    it("32. editing the assessment after a failed send does not mutate the old notification's snapshot", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { publicId } = await createOne();
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      const notificationId = sendRes.body.notification.id;

      await request(app)
        .patch(assessmentUrl(publicId))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Renamed Assessment", external_url: "https://external-platform.example/test/corrected" });

      const notification = await EmailNotification.findById(notificationId);
      expect(notification?.assessment_snapshot?.assessment_name).toBe("Backend Technical Test");
      expect(notification?.assessment_snapshot?.external_url).toBe("https://external-platform.example/test/abc");
    });

    it("33. Send Again (after a successful send) creates a new communication event", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { id, publicId } = await createOne();
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      mockSend.mockResolvedValueOnce(undefined);
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(res.status).toBe(201);
      expect(await EmailNotification.countDocuments({ application_assessment_id: id })).toBe(2);
    });

    it("34. a rapid double-click on Send Assessment is rejected as a safe conflict, never a second email", async () => {
      // Deterministically simulates the double-click race (a concurrent
      // second request's own create() colliding with the first request's
      // still-pending row on the partial unique index) without depending
      // on real two-request timing — same failure-injection approach used
      // elsewhere in this codebase for this exact class of test (see
      // hiringPipelineBulkMove.api.test.ts's own concurrency test).
      const { id, publicId } = await createOne();
      const createSpy = jest.spyOn(EmailNotification, "create").mockRejectedValueOnce({ code: 11000 } as never);

      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      expect(res.status).toBe(409);
      expect(mockSend).not.toHaveBeenCalled();
      expect(await EmailNotification.countDocuments({ application_assessment_id: id })).toBe(0);

      createSpy.mockRestore();
    });

    it("35. cross-company send is blocked", async () => {
      const { publicId } = await createOne();
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrB, companyB.id)).send({});
      expect(res.status).toBe(404);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("35b. cross-company retry is blocked", async () => {
      mockSend.mockRejectedValueOnce(new Error("smtp down"));
      const { publicId } = await createOne();
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app)
        .post(retryUrl(publicId, sendRes.body.notification.public_id))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({});
      expect(res.status).toBe(404);
    });

    it("36. never exposes a raw SMTP error anywhere in the response", async () => {
      mockSend.mockRejectedValueOnce(new Error("534 5.7.9 raw SMTP auth failure detail"));
      const { publicId } = await createOne();
      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      // The raw Error's own message text — never a bare "534", which a
      // randomly generated public_id (e.g. "notif_8bfd379711c35344f925f8db")
      // can legitimately contain as a harmless substring.
      expect(JSON.stringify(res.body)).not.toMatch(/raw SMTP auth failure|5\.7\.9/);
      // The response only ever carries the safe, provider-neutral code —
      // confirms the leak-check above isn't passing merely because the
      // field was absent/undefined.
      expect(res.body.notification.failure_code).toBe("delivery_failed");
    });

    it("blocks sending a NEW invitation once the Job is soft-deleted", async () => {
      const { publicId } = await createOne();
      await Job.updateOne({ _id: jobA.id }, { $set: { deleted_at: new Date() } });

      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(404);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("allows sending for an existing candidate when the Job is merely closed", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { publicId } = await createOne();
      await Job.updateOne({ _id: jobA.id }, { $set: { status: "closed" } });

      const res = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(201);
    });

    it("rejects retrying a notification that has not failed", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { publicId } = await createOne();
      const sendRes = await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app)
        .post(retryUrl(publicId, sendRes.body.notification.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});
      expect(res.status).toBe(409);
    });

    it("lists notification history for an assessment", async () => {
      mockSend.mockResolvedValueOnce(undefined);
      const { publicId } = await createOne();
      await request(app).post(sendUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app).get(notificationsUrl(publicId)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.notifications[0].status).toBe("sent");
    });
  });

  // 37. tests never hit real SMTP — structural: emailService.send is
  // jest.mock()'d at the top of this file for every test in it, so a real
  // network call is structurally impossible here.
  it("37. never hits real SMTP (emailService.send is fully mocked for this suite)", () => {
    expect(jest.isMockFunction(emailService.send)).toBe(true);
  });

  // ===== 47-50: /assessments LIST =====
  describe("GET /api/v1/application-assessments (company-wide list)", () => {
    it("47. is company-scoped", async () => {
      mockSend.mockResolvedValue(undefined);
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.assessments).toHaveLength(1);
      expect(res.body.assessments[0].candidate.full_name).toBe("Ahmad Khalil");
      expect(res.body.assessments[0].job.title).toBe("Backend Developer");
    });

    it("48. filters by jobId and status", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      await request(app).patch(resultUrl(createRes.body.assessment.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({ status: "passed" });

      const otherJob = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Other Job", status: "active" });
      const otherStage = await HiringStep.create({ job_id: otherJob.id, name: "Assessment", type: "assessment", position: 0 });
      const otherCandidate = await Candidate.create({ full_name: "Other Candidate", email: "other-cand@candidate.test" });
      const otherApplication = await Application.create({
        job_id: otherJob.id,
        candidate_id: otherCandidate._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
        current_step_id: otherStage._id,
      });
      await request(app).post(createUrl(otherApplication.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const byJob = await request(app).get(listUrl(`?jobId=${jobA.public_id}`)).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(byJob.body.assessments).toHaveLength(1);
      expect(byJob.body.assessments[0].job.id).toBe(jobA.id);

      const byStatus = await request(app).get(listUrl("?status=passed")).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(byStatus.body.assessments).toHaveLength(1);
      expect(byStatus.body.assessments[0].status).toBe("passed");
    });

    it("49. never shows Company B's assessments to Company A", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const jobB = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Job B", status: "active" });
      const stageB = await HiringStep.create({ job_id: jobB.id, name: "Assessment", type: "assessment", position: 0 });
      const candidateB = await Candidate.create({ full_name: "Candidate B", email: "candidate-b@candidate.test" });
      const applicationB = await Application.create({
        job_id: jobB.id,
        candidate_id: candidateB._id,
        cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
        status: "in_process",
        current_step_id: stageB._id,
      });
      await request(app).post(createUrl(applicationB.id)).set("Authorization", authHeaderFor(hrB, companyB.id)).send(validBody());

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments).toHaveLength(1);
      expect(res.body.assessments.every((a: { candidate: { full_name: string } }) => a.candidate.full_name !== "Candidate B")).toBe(true);
    });

    it("50. does not issue one query per row (no N+1)", async () => {
      for (let i = 0; i < 3; i++) {
        const c = await Candidate.create({ full_name: `Bulk Candidate ${i}`, email: `bulk-${i}-${new Types.ObjectId().toString()}@candidate.test` });
        const step = await HiringStep.create({ job_id: jobA.id, name: `Assessment ${i}`, type: "assessment", position: 10 + i });
        const app2 = await Application.create({
          job_id: jobA.id,
          candidate_id: c._id,
          cv_file: { storage_key: "x", original_name: "r.pdf", mime_type: "application/pdf", size_bytes: 10 },
          status: "in_process",
          current_step_id: step._id,
        });
        await request(app).post(createUrl(app2.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      }

      const findSpy = jest.spyOn(Candidate, "find");
      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.assessments.length).toBeGreaterThanOrEqual(3);
      expect(findSpy).toHaveBeenCalledTimes(1);
      findSpy.mockRestore();
    });

    it("search matches by assessment name", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody({ name: "Unique Assessment Name" }));
      const res = await request(app).get(listUrl("?search=Unique%20Assessment")).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments).toHaveLength(1);
    });

    it("search matches by candidate name", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      const res = await request(app).get(listUrl("?search=Ahmad%20Khalil")).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments).toHaveLength(1);
    });

    it("returns 404 for an unauthenticated request", async () => {
      const res = await request(app).get(listUrl());
      expect(res.status).toBe(401);
    });

    it("never exposes notes/internal ids in the list row", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      await request(app)
        .patch(resultUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "passed", notes: "Private HR note" });

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(JSON.stringify(res.body)).not.toContain("Private HR note");
      expect(JSON.stringify(res.body)).not.toMatch(/company_id/i);
    });
  });

  // ===== Phase 1 opaque public ID migration =====
  describe("public_id", () => {
    it("is assigned automatically on creation with the assess_ prefix and 24-char hex suffix", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.body.assessment.public_id).toMatch(/^assess_[a-f0-9]{24}$/);
    });

    it("is never derived from the assessment's own _id", async () => {
      const res = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      expect(res.body.assessment.public_id).not.toContain(res.body.assessment.id);
    });

    it("has a unique, sparse index on public_id", () => {
      const indexes = ApplicationAssessment.schema.indexes();
      const publicIdIndex = indexes.find(([spec]) => spec.public_id === 1);
      expect(publicIdIndex).toBeDefined();
      expect(publicIdIndex?.[1]).toMatchObject({ unique: true, sparse: true });
    });

    it("updates an assessment link looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app)
        .patch(assessmentUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Renamed Test" });

      expect(res.status).toBe(200);
      expect(res.body.assessment.name).toBe("Renamed Test");
    });

    it("rejects an assessment link edit addressed by legacy Mongo ObjectId", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app)
        .patch(assessmentUrl(createRes.body.assessment.id))
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ name: "Renamed Via Legacy Id" });

      expect(res.status).toBe(400);
    });

    it("returns 404 for another company's assessment looked up by public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app)
        .patch(assessmentUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrB, companyB.id))
        .send({ name: "Hijacked" });

      expect(res.status).toBe(404);
    });

    it("sends an invitation for an assessment looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      mockSend.mockResolvedValue(undefined);

      const res = await request(app).post(sendUrl(createRes.body.assessment.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});
      expect(res.status).toBe(201);
    });

    it("lists notifications for an assessment looked up by its public_id", async () => {
      const createRes = await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());
      mockSend.mockResolvedValue(undefined);
      await request(app).post(sendUrl(createRes.body.assessment.public_id)).set("Authorization", authHeaderFor(hrA, companyA.id)).send({});

      const res = await request(app)
        .get(notificationsUrl(createRes.body.assessment.public_id))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
    });

    it("exposes the owning application's public_id on the company-wide list row", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app).get(listUrl()).set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.body.assessments[0].application_public_id).toBe(application.public_id);
    });

    // "Special attention" case: the jobId filter on the company-wide list
    // is resolved to Job's real internal id before being used against
    // ApplicationAssessment.job_id.
    it("filters the company-wide list by jobId given as the Job's public_id", async () => {
      await request(app).post(createUrl(application.public_id!)).set("Authorization", authHeaderFor(hrA, companyA.id)).send(validBody());

      const res = await request(app)
        .get(listUrl(`?jobId=${jobA.public_id}`))
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(200);
      expect(res.body.assessments).toHaveLength(1);
    });
  });
});
