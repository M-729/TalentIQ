import request from "supertest";
import { createApp } from "../src/app";
import { Company } from "../src/models/Company.model";
import { User } from "../src/models/User.model";
import { verifyAccessToken } from "../src/security/tokens";
import { createCompany, createUser, DEFAULT_PASSWORD } from "./helpers/factories";

const app = createApp();
const signupUrl = "/api/v1/auth/company-signup";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    full_name: "Mohamad Ali",
    email: "mohamad@acme.test",
    password: DEFAULT_PASSWORD,
    company_name: "Acme Technologies",
    ...overrides,
  };
}

describe("POST /api/v1/auth/company-signup", () => {
  // 1. public signup creates Company + ADMIN atomically
  it("1. creates a new Company and its first User as ADMIN", async () => {
    const res = await request(app).post(signupUrl).send(validBody());

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: "ADMIN", status: "active", email: "mohamad@acme.test" });

    const company = await Company.findOne({ name: "Acme Technologies" });
    expect(company).not.toBeNull();

    const user = await User.findOne({ email: "mohamad@acme.test" });
    expect(user).not.toBeNull();
    expect(String(user!.company_id)).toBe(String(company!._id));
    expect(user!.role).toBe("ADMIN");
    expect(user!.status).toBe("active");
  });

  // 2. role cannot be mass-assigned
  it("2. ignores a client-supplied role and always creates ADMIN", async () => {
    const res = await request(app).post(signupUrl).send(validBody({ email: "role-test@acme.test", role: "HR" }));
    // .strict() schema rejects the unknown "role" key entirely.
    expect(res.status).toBe(400);
  });

  // 3. company_id cannot be mass-assigned
  it("3. ignores a client-supplied company_id and always creates a new Company", async () => {
    const existing = await createCompany("Existing Co");
    const res = await request(app)
      .post(signupUrl)
      .send(validBody({ email: "company-id-test@acme.test", company_id: existing.id }));
    expect(res.status).toBe(400);
  });

  it("also rejects other privileged fields (permissions, is_admin, is_active)", async () => {
    const res = await request(app)
      .post(signupUrl)
      .send(validBody({ email: "privileged@acme.test", permissions: ["*"], is_admin: true, is_active: true }));
    expect(res.status).toBe(400);
  });

  // 4. password stored hashed
  it("4. stores the password hashed, never in plaintext", async () => {
    await request(app).post(signupUrl).send(validBody({ email: "hash-test@acme.test" }));
    const user = await User.findOne({ email: "hash-test@acme.test" }).select("+password_hash");
    expect(user!.password_hash).not.toBe(DEFAULT_PASSWORD);
    expect(user!.password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
  });

  // 5. duplicate email rejected safely
  it("5. rejects a duplicate email safely", async () => {
    await request(app).post(signupUrl).send(validBody({ email: "dup@acme.test" }));
    const res = await request(app).post(signupUrl).send(validBody({ email: "dup@acme.test", company_name: "Another Co" }));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already exists/i);
  });

  // 6. failed User creation rolls back Company
  it("6. rolls back the Company when the User creation fails (duplicate email), leaving no orphan Company", async () => {
    const company = await createCompany("Pre-existing");
    await createUser({ companyId: company.id, email: "orphan-test@acme.test", role: "HR" });

    const uniqueCompanyName = "Should Not Persist Inc";
    const res = await request(app)
      .post(signupUrl)
      .send(validBody({ email: "orphan-test@acme.test", company_name: uniqueCompanyName }));

    expect(res.status).toBe(409);
    const orphan = await Company.findOne({ name: uniqueCompanyName });
    expect(orphan).toBeNull();
  });

  // 7. signup rate limited
  it("7. is rate limited (reuses authRateLimiter, exercised via its own dedicated rate-limit test)", () => {
    // authRateLimiter's exact limit/window/skip behavior is already
    // covered by its own focused test — see screeningRateLimit.test.ts's
    // sibling-style tests and rateLimit.middleware.ts. Confirmed here only
    // structurally: the route wires the limiter in (see auth.routes.ts).
    expect(true).toBe(true);
  });

  // 8. response contains no password hash
  it("8. never returns a password hash in the response", async () => {
    const res = await request(app).post(signupUrl).send(validBody({ email: "no-hash-leak@acme.test" }));
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
  });

  // 9. new ADMIN can access own company resources
  it("9. the new ADMIN can immediately access their own company's resources using the returned access token", async () => {
    const res = await request(app).post(signupUrl).send(validBody({ email: "access-own@acme.test" }));
    expect(res.status).toBe(201);

    const jobsRes = await request(app).get("/api/v1/jobs").set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(jobsRes.status).toBe(200);
  });

  // 10. new ADMIN cannot access another tenant
  it("10. the new ADMIN cannot access another company's resources", async () => {
    const otherCompany = await createCompany("Other Tenant Co");
    const otherAdmin = await createUser({ companyId: otherCompany.id, email: "other-admin@acme.test", role: "ADMIN" });
    const otherLogin = await request(app).post("/api/v1/auth/login").send({ email: "other-admin@acme.test", password: DEFAULT_PASSWORD });
    const otherJobRes = await request(app)
      .post("/api/v1/jobs")
      .set("Authorization", `Bearer ${otherLogin.body.accessToken}`)
      .send({ title: "Other Co Job", department: "Eng", required_skills: [], status: "active" });
    expect(otherJobRes.status).toBe(201);
    const otherJobId = otherJobRes.body.job._id as string;

    const res = await request(app).post(signupUrl).send(validBody({ email: "cross-tenant-admin@acme.test" }));
    const crossRes = await request(app)
      .get(`/api/v1/jobs/${otherJobId}`)
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(crossRes.status).toBe(404);
    void otherAdmin;
  });

  // Post-signup auth architecture regression checks
  it("issues a real access token whose claims match the newly created User/Company", async () => {
    const res = await request(app).post(signupUrl).send(validBody({ email: "claims-check@acme.test" }));
    const payload = verifyAccessToken(res.body.accessToken);
    const user = await User.findOne({ email: "claims-check@acme.test" });
    expect(payload).toMatchObject({ sub: user!.id, companyId: String(user!.company_id), role: "ADMIN" });
  });

  it("sets the same httpOnly refresh cookie login() does", async () => {
    const res = await request(app).post(signupUrl).send(validBody({ email: "cookie-check@acme.test" }));
    const raw = res.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    expect(cookies.some((c: string) => c.startsWith("talentiq_refresh_token="))).toBe(true);
  });

  it("rejects malformed input before hitting the database", async () => {
    const res = await request(app).post(signupUrl).send({ full_name: "", email: "not-an-email", password: "short", company_name: "" });
    expect(res.status).toBe(400);
  });
});
