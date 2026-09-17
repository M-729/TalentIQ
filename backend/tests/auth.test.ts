import request from "supertest";
import { createApp } from "../src/app";
import { verifyAccessToken } from "../src/security/tokens";
import { createCompany, createUser, DEFAULT_PASSWORD } from "./helpers/factories";

const app = createApp();

function getRefreshCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = cookies.find((c: string) => c.startsWith("talentiq_refresh_token="));
  if (!cookie) throw new Error("Refresh cookie not set");
  return cookie.split(";")[0]!;
}

describe("POST /api/v1/auth/login", () => {
  it("logs in with valid credentials and returns an access token + safe user", async () => {
    const company = await createCompany();
    await createUser({ companyId: company.id, email: "hr@acme.test", role: "HR" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr@acme.test", password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "hr@acme.test", role: "HR" });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects an unknown email with a generic message", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@acme.test", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects a wrong password with the same generic message", async () => {
    const company = await createCompany();
    await createUser({ companyId: company.id, email: "hr2@acme.test", role: "HR" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "hr2@acme.test", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects a disabled user", async () => {
    const company = await createCompany();
    await createUser({ companyId: company.id, email: "disabled@acme.test", role: "HR", status: "disabled" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "disabled@acme.test", password: DEFAULT_PASSWORD });

    expect(res.status).toBe(401);
  });

  it("rejects malformed input before hitting the database", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("rejects requests without an access token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed access token", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid access token", async () => {
    const company = await createCompany();
    await createUser({ companyId: company.id, email: "me@acme.test", role: "ADMIN" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "me@acme.test", password: DEFAULT_PASSWORD });

    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: "me@acme.test", role: "ADMIN" });
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rejects a missing refresh cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("issues a valid access token and rotates the refresh cookie", async () => {
    const company = await createCompany();
    const user = await createUser({ companyId: company.id, email: "refresh@acme.test", role: "HR" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "refresh@acme.test", password: DEFAULT_PASSWORD });

    const originalCookie = getRefreshCookie(login);

    const refreshed = await request(app).post("/api/v1/auth/refresh").set("Cookie", originalCookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));

    // The two access tokens carry the same claims and may legitimately be
    // byte-identical if issued within the same second (second-resolution
    // iat/exp on an otherwise-identical payload) — assert on the decoded
    // claims, not on string identity/inequality.
    const payload = verifyAccessToken(refreshed.body.accessToken);
    expect(payload).toMatchObject({
      sub: user.id,
      companyId: company.id,
      role: "HR",
    });

    // The refresh token itself must always rotate, regardless of timing.
    const rotatedCookie = getRefreshCookie(refreshed);
    expect(rotatedCookie).not.toBe(originalCookie);
  });

  it("detects reuse of an already-rotated refresh token and revokes the session", async () => {
    const company = await createCompany();
    await createUser({ companyId: company.id, email: "reuse@acme.test", role: "HR" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "reuse@acme.test", password: DEFAULT_PASSWORD });

    const originalCookie = getRefreshCookie(login);

    // First refresh rotates the token (this is legitimate use).
    const firstRefresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", originalCookie);
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = getRefreshCookie(firstRefresh);

    // Reusing the original (now-revoked) token should fail...
    const reuse = await request(app).post("/api/v1/auth/refresh").set("Cookie", originalCookie);
    expect(reuse.status).toBe(401);

    // ...and should have invalidated the rotated token too (whole family revoked).
    const afterReuse = await request(app).post("/api/v1/auth/refresh").set("Cookie", rotatedCookie);
    expect(afterReuse.status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("revokes the refresh token so it can no longer be used", async () => {
    const company = await createCompany();
    await createUser({ companyId: company.id, email: "logout@acme.test", role: "HR" });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "logout@acme.test", password: DEFAULT_PASSWORD });

    const cookie = getRefreshCookie(login);

    const logoutRes = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);

    const refreshAfterLogout = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("is a no-op (still 204) when no refresh cookie is present", async () => {
    const res = await request(app).post("/api/v1/auth/logout");
    expect(res.status).toBe(204);
  });
});
