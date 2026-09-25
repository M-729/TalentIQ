import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { Job } from "../src/models/Job.model";
import { createCompany, createUser } from "./helpers/factories";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

describe("Job CRUD API", () => {
  let companyA: CompanyDoc;
  let hrA: UserDoc;
  let companyB: CompanyDoc;
  let hrB: UserDoc;

  beforeEach(async () => {
    companyA = await createCompany("Company A");
    hrA = await createUser({ companyId: companyA.id, email: "hr@a.test", role: "HR" });
    companyB = await createCompany("Company B");
    hrB = await createUser({ companyId: companyB.id, email: "hr@b.test", role: "HR" });
  });

  describe("POST /api/v1/jobs", () => {
    it("allows an authenticated HR user to create a job", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Backend Engineer" });

      expect(res.status).toBe(201);
      expect(res.body.job.title).toBe("Backend Engineer");
      expect(res.body.job.status).toBe("draft");
    });

    it("allows an authenticated ADMIN user to create a job", async () => {
      const admin = await createUser({ companyId: companyA.id, email: "admin@a.test", role: "ADMIN" });

      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(admin, companyA.id))
        .send({ title: "Admin Created Job" });

      expect(res.status).toBe(201);
    });

    it("derives company_id from the authenticated user, ignoring the request body", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Ignore company_id", company_id: companyB.id });

      expect(res.status).toBe(201);
      expect(res.body.job.company_id).toBe(companyA.id);
    });

    it("derives created_by from the authenticated user, ignoring the request body", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Ignore created_by", created_by: hrB.id });

      expect(res.status).toBe(201);
      expect(res.body.job.created_by).toBe(hrA.id);
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app).post("/api/v1/jobs").send({ title: "No Auth" });
      expect(res.status).toBe(401);
    });

    it("rejects a missing title", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});
      expect(res.status).toBe(400);
    });

    it("rejects an invalid status value", async () => {
      const res = await request(app)
        .post("/api/v1/jobs")
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Bad Status", status: "not-a-status" });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/v1/jobs", () => {
    it("lists only jobs belonging to the caller's company", async () => {
      await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "A1" });
      await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "A2" });
      await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "B1" });

      const res = await request(app).get("/api/v1/jobs").set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(2);
      expect(res.body.jobs.every((j: { title: string }) => j.title.startsWith("A"))).toBe(true);
    });

    it("filters by status", async () => {
      await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Draft Job", status: "draft" });
      await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Active Job", status: "active" });

      const res = await request(app)
        .get("/api/v1/jobs?status=active")
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].title).toBe("Active Job");
    });

    it("rejects an invalid status filter", async () => {
      const res = await request(app)
        .get("/api/v1/jobs?status=bogus")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/v1/jobs");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/jobs/:id", () => {
    it("returns a job belonging to the caller's company", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Findable" });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.job.title).toBe("Findable");
    });

    it("returns 404 for a job belonging to another company", async () => {
      const job = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Not Yours" });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("rejects a malformed job id", async () => {
      const res = await request(app)
        .get("/api/v1/jobs/not-an-object-id")
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(400);
    });

    it("returns 404 for a well-formed public_id that doesn't exist", async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/job_${"a".repeat(24)}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));
      expect(res.status).toBe(404);
    });

    it("returns a job looked up by its public_id", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "By Public Id" });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.job.title).toBe("By Public Id");
      expect(res.body.job._id).toBe(job.id);
    });

    // Phase 2 cutover: legacy dual-accept lookup is gone — a raw Mongo
    // ObjectId is now just an invalid id format, not an alternate valid id.
    it("rejects a job looked up by its legacy Mongo ObjectId", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "By Legacy ObjectId" });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(400);
    });

    it("returns 404 for another company's job looked up by public_id (tenant scoping preserved)", async () => {
      const job = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Not Yours" });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
    });

    it("exposes public_id on the returned job", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Exposes Public Id" });

      const res = await request(app)
        .get(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(200);
      expect(res.body.job.public_id).toBe(job.public_id);
    });
  });

  describe("PATCH /api/v1/jobs/:id", () => {
    it("updates a job belonging to the caller's company", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Old Title" });

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "New Title" });

      expect(res.status).toBe(200);
      expect(res.body.job.title).toBe("New Title");
    });

    it("sets published_at the first time status becomes active", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "To Publish" });
      expect(job.published_at).toBeUndefined();

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "active" });

      expect(res.status).toBe(200);
      expect(res.body.job.status).toBe("active");
      expect(res.body.job.published_at).toEqual(expect.any(String));
    });

    it("blocks updates to a job belonging to another company", async () => {
      const job = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Not Yours" });

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Hijacked" });

      expect(res.status).toBe(404);

      const unchanged = await Job.findById(job.id);
      expect(unchanged?.title).toBe("Not Yours");
    });

    it("rejects an invalid status value", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Bad Update" });

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ status: "not-a-status" });

      expect(res.status).toBe(400);
    });

    it("rejects an empty update body", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Empty Update" });

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({});

      expect(res.status).toBe(400);
    });

    it("rejects an update addressed by legacy Mongo ObjectId", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Old Title" });

      const res = await request(app)
        .patch(`/api/v1/jobs/${job.id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id))
        .send({ title: "Should Not Apply" });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/jobs/:id", () => {
    it("soft-deletes a job belonging to the caller's company (sets deleted_at, does not remove the document)", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "To Delete" });

      const res = await request(app)
        .delete(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(204);

      const stillExists = await Job.findById(job.id).select("+deleted_at");
      expect(stillExists).not.toBeNull();
      expect(stillExists?.deleted_at).toBeInstanceOf(Date);
    });

    it("blocks deleting a job belonging to another company", async () => {
      const job = await Job.create({ company_id: companyB.id, created_by: hrB.id, title: "Not Yours" });

      const res = await request(app)
        .delete(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(404);
      expect(await Job.findById(job.id)).not.toBeNull();
    });

    it("rejects unauthenticated requests", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "No Auth Delete" });
      const res = await request(app).delete(`/api/v1/jobs/${job.public_id}`);
      expect(res.status).toBe(401);
    });

    it("soft-deletes a job looked up by its public_id", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Delete By Public Id" });

      const res = await request(app)
        .delete(`/api/v1/jobs/${job.public_id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(204);

      const stillExists = await Job.findById(job.id).select("+deleted_at");
      expect(stillExists?.deleted_at).toBeInstanceOf(Date);
    });

    it("rejects a delete addressed by legacy Mongo ObjectId", async () => {
      const job = await Job.create({ company_id: companyA.id, created_by: hrA.id, title: "Not Deletable By ObjectId" });

      const res = await request(app)
        .delete(`/api/v1/jobs/${job.id}`)
        .set("Authorization", authHeaderFor(hrA, companyA.id));

      expect(res.status).toBe(400);
      const stillExists = await Job.findById(job.id).select("+deleted_at");
      expect(stillExists?.deleted_at).toBeFalsy();
    });
  });
});
