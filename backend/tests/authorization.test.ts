import express from "express";
import request from "supertest";
import { requireRole } from "../src/middleware/role.middleware";
import { errorHandler } from "../src/middleware/error.middleware";
import type { UserRole } from "../src/models/User.model";

function buildTestApp(auth?: { userId: string; companyId: string; role: UserRole }) {
  const app = express();
  app.use((req, _res, next) => {
    if (auth) req.auth = auth;
    next();
  });
  app.get("/admin-only", requireRole("ADMIN"), (_req, res) => res.status(200).json({ ok: true }));
  app.get("/hr-or-admin", requireRole("HR", "ADMIN"), (_req, res) => res.status(200).json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe("requireRole", () => {
  it("allows a user whose role is in the allow-list", async () => {
    const app = buildTestApp({ userId: "u1", companyId: "c1", role: "ADMIN" });
    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(200);
  });

  it("rejects a user whose role is not in the allow-list", async () => {
    const app = buildTestApp({ userId: "u1", companyId: "c1", role: "HR" });
    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(403);
  });

  it("allows either role when multiple roles are permitted", async () => {
    const app = buildTestApp({ userId: "u1", companyId: "c1", role: "HR" });
    const res = await request(app).get("/hr-or-admin");
    expect(res.status).toBe(200);
  });

  it("rejects when no auth context is present at all", async () => {
    const app = buildTestApp(undefined);
    const res = await request(app).get("/admin-only");
    expect(res.status).toBe(401);
  });
});
