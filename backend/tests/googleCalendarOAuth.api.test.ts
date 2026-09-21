import request from "supertest";
import { createApp } from "../src/app";
import { signAccessToken } from "../src/security/tokens";
import { createCompany, createUser } from "./helpers/factories";
import { GoogleOAuthState } from "../src/models/GoogleOAuthState.model";
import { GoogleCalendarConnection } from "../src/models/GoogleCalendarConnection.model";
import { decryptToken } from "../src/security/googleTokenEncryption";
import type { CompanyDoc } from "../src/models/Company.model";
import type { UserDoc } from "../src/models/User.model";

// Only the real Google-calling functions are mocked — createOAuthState /
// consumeOAuthState (the CSRF machinery under test) stay real, so these
// tests exercise the actual state hashing/expiry/one-time-use logic
// against a real in-memory MongoDB, never a mock of it.
jest.mock("../src/modules/integrations/googleCalendar/googleCalendarOAuth.service", () => ({
  GOOGLE_CALENDAR_SCOPES: ["https://www.googleapis.com/auth/calendar.events", "openid", "https://www.googleapis.com/auth/userinfo.email"],
  getAuthorizationUrl: jest.fn(),
  exchangeCodeForTokens: jest.fn(),
  revokeRefreshToken: jest.fn(),
}));

import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  revokeRefreshToken,
} from "../src/modules/integrations/googleCalendar/googleCalendarOAuth.service";

const mockGetAuthorizationUrl = getAuthorizationUrl as jest.Mock;
const mockExchangeCodeForTokens = exchangeCodeForTokens as jest.Mock;
const mockRevokeRefreshToken = revokeRefreshToken as jest.Mock;

const app = createApp();

function authHeaderFor(user: UserDoc, companyId: string): string {
  const token = signAccessToken({ sub: user.id, companyId, role: user.role });
  return `Bearer ${token}`;
}

function connectUrl() {
  return "/api/v1/integrations/google-calendar/connect";
}
function statusUrl() {
  return "/api/v1/integrations/google-calendar/status";
}
function disconnectUrl() {
  return "/api/v1/integrations/google-calendar";
}
function callbackUrl(params: { code?: string; state?: string }) {
  const qs = new URLSearchParams();
  if (params.code !== undefined) qs.set("code", params.code);
  if (params.state !== undefined) qs.set("state", params.state);
  return `/api/v1/integrations/google-calendar/callback?${qs.toString()}`;
}

/** The raw state value handed to the (mocked) getAuthorizationUrl on the most recent /connect call. */
function lastCapturedState(): string {
  const calls = mockGetAuthorizationUrl.mock.calls;
  return calls[calls.length - 1]![0] as string;
}

async function connectAndCaptureState(user: UserDoc, companyId: string): Promise<string> {
  await request(app).get(connectUrl()).set("Authorization", authHeaderFor(user, companyId));
  return lastCapturedState();
}

describe("Google Calendar OAuth API", () => {
  let company: CompanyDoc;
  let hr: UserDoc;

  beforeEach(async () => {
    company = await createCompany("Company A");
    hr = await createUser({ companyId: company.id, email: "hr@a.test", role: "HR" });

    mockGetAuthorizationUrl.mockReset().mockReturnValue("https://accounts.google.com/mock-consent");
    mockExchangeCodeForTokens.mockReset();
    mockRevokeRefreshToken.mockReset().mockResolvedValue(true);
  });

  // ===== CONNECT =====
  describe("GET /connect", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const res = await request(app).get(connectUrl());
      expect(res.status).toBe(401);
    });

    it("returns an authorization URL for an authenticated HR user", async () => {
      const res = await request(app).get(connectUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://accounts.google.com/mock-consent");
    });

    it("allows an authenticated Admin user", async () => {
      const admin = await createUser({ companyId: company.id, email: "admin@a.test", role: "ADMIN" });
      const res = await request(app).get(connectUrl()).set("Authorization", authHeaderFor(admin, company.id));
      expect(res.status).toBe(200);
    });

    it("persists only a hash of the state, never the raw value", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      const stored = await GoogleOAuthState.findOne({});
      expect(stored).not.toBeNull();
      expect(stored!.state_hash).not.toBe(state);
      expect(JSON.stringify(stored)).not.toContain(state);
    });

    it("associates the state with the requesting user and company", async () => {
      await connectAndCaptureState(hr, company.id);
      const stored = await GoogleOAuthState.findOne({});
      expect(stored!.user_id.toString()).toBe(hr.id);
      expect(stored!.company_id.toString()).toBe(company.id);
    });

    it("sets a short (~10 minute) expiration", async () => {
      const before = Date.now();
      await connectAndCaptureState(hr, company.id);
      const stored = await GoogleOAuthState.findOne({});
      const ttlMs = stored!.expires_at.getTime() - before;
      expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000 + 5000);
    });

    it("creates the state as not yet consumed", async () => {
      await connectAndCaptureState(hr, company.id);
      const stored = await GoogleOAuthState.findOne({});
      expect(stored!.consumed_at).toBeNull();
    });
  });

  // ===== CALLBACK =====
  describe("GET /callback", () => {
    it("redirects with an error indicator when code/state are missing", async () => {
      const res = await request(app).get(callbackUrl({}));
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("http://localhost:5173/settings/integrations?googleCalendar=error");
    });

    it("redirects with an error indicator for an unknown/invalid state", async () => {
      const res = await request(app).get(callbackUrl({ code: "auth-code", state: "garbage-state-value" }));
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("http://localhost:5173/settings/integrations?googleCalendar=error");
      expect(mockExchangeCodeForTokens).not.toHaveBeenCalled();
    });

    it("redirects with an error indicator for an expired state", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      await GoogleOAuthState.updateOne({}, { $set: { expires_at: new Date(Date.now() - 1000) } });

      const res = await request(app).get(callbackUrl({ code: "auth-code", state }));
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("googleCalendar=error");
    });

    it("exchanges the code and persists an encrypted (never plaintext) refresh token", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
        calendarPermissionGranted: true,
      });

      const res = await request(app).get(callbackUrl({ code: "auth-code", state }));
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("http://localhost:5173/settings/integrations?googleCalendar=connected");

      const stored = await GoogleCalendarConnection.findOne({ user_id: hr.id }).select("+encrypted_refresh_token");
      expect(stored).not.toBeNull();
      expect(stored!.encrypted_refresh_token.ciphertext).not.toBe("raw-refresh-token-value-1");
      expect(decryptToken(stored!.encrypted_refresh_token)).toBe("raw-refresh-token-value-1");
      expect(stored!.google_account_email).toBe("alice@gmail.com");
    });

    it("never exposes token material in the redirect or response", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "super-secret-refresh-token",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });

      const res = await request(app).get(callbackUrl({ code: "auth-code", state }));
      expect(res.headers.location).not.toContain("super-secret-refresh-token");
      expect(JSON.stringify(res.body)).not.toContain("super-secret-refresh-token");
      expect(res.text ?? "").not.toContain("super-secret-refresh-token");
    });

    it("rejects replay of an already-consumed state", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });

      const first = await request(app).get(callbackUrl({ code: "auth-code", state }));
      expect(first.headers.location).toContain("googleCalendar=connected");

      const replay = await request(app).get(callbackUrl({ code: "auth-code", state }));
      expect(replay.headers.location).toContain("googleCalendar=error");
      expect(mockExchangeCodeForTokens).toHaveBeenCalledTimes(1);
      expect(await GoogleCalendarConnection.countDocuments({ user_id: hr.id })).toBe(1);
    });

    it("does not overwrite an existing refresh token when Google omits one on reconnect", async () => {
      const firstState = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValueOnce({
        refreshToken: "original-refresh-token",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code-1", state: firstState }));

      const secondState = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValueOnce({
        refreshToken: null,
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      const res = await request(app).get(callbackUrl({ code: "auth-code-2", state: secondState }));
      expect(res.headers.location).toContain("googleCalendar=connected");

      const stored = await GoogleCalendarConnection.findOne({ user_id: hr.id }).select("+encrypted_refresh_token");
      expect(decryptToken(stored!.encrypted_refresh_token)).toBe("original-refresh-token");
    });

    it("redirects with an error indicator when the token exchange itself fails", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockRejectedValue(new Error("google_invalid_grant"));

      const res = await request(app).get(callbackUrl({ code: "bad-code", state }));
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("googleCalendar=error");
      expect(JSON.stringify(res.body)).not.toContain("google_invalid_grant");
    });
  });

  // ===== STATUS =====
  describe("GET /status", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const res = await request(app).get(statusUrl());
      expect(res.status).toBe(401);
    });

    it("reports disconnected when there is no active connection", async () => {
      const res = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });

    it("reports connected with account email and connected_at after a successful callback", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const res = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.account_email).toBe("alice@gmail.com");
      expect(typeof res.body.connected_at).toBe("string");
      expect(res.body.calendar_permission_granted).toBe(true);
    });

    it("reports calendar_permission_granted: true when Google's token introspection confirmed calendar.events", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: ["https://www.googleapis.com/auth/calendar.events", "openid"],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const res = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.body.connected).toBe(true);
      expect(res.body.calendar_permission_granted).toBe(true);
    });

    it("reports calendar_permission_granted: false — and never presents the connection as fully healthy — when the required Calendar scope was not actually granted", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        // Google's own introspection found only openid/email — NOT
        // calendar.events (the exact production incident this hardens
        // against: the OAuth response's own `scope` field/consent screen
        // can't be trusted as proof of what was actually granted).
        scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email"],
        calendarPermissionGranted: false,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const res = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(hr, company.id));
      // Still "connected" (OAuth itself succeeded, a usable refresh token
      // was stored) — but distinguishable from a fully healthy connection.
      expect(res.body.connected).toBe(true);
      expect(res.body.calendar_permission_granted).toBe(false);
    });

    it("never exposes encrypted token fields", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const res = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(JSON.stringify(res.body)).not.toMatch(/ciphertext|encrypted_refresh_token|auth_tag/i);
    });

    it("keeps connections isolated per user", async () => {
      const otherHr = await createUser({ companyId: company.id, email: "other@a.test", role: "HR" });
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const res = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(otherHr, company.id));
      expect(res.body).toEqual({ connected: false });
    });
  });

  // ===== DISCONNECT =====
  describe("DELETE /", () => {
    it("rejects an unauthenticated request with 401", async () => {
      const res = await request(app).delete(disconnectUrl());
      expect(res.status).toBe(401);
    });

    it("is idempotent when there is no active connection", async () => {
      const res = await request(app).delete(disconnectUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.status).toBe(204);
    });

    it("revokes the local connection and attempts provider revocation", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const res = await request(app).delete(disconnectUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.status).toBe(204);
      expect(mockRevokeRefreshToken).toHaveBeenCalledWith("raw-refresh-token-value-1");

      const statusRes = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(statusRes.body).toEqual({ connected: false });

      const stored = await GoogleCalendarConnection.findOne({ user_id: hr.id });
      expect(stored!.revoked_at).not.toBeNull();
    });

    it("still disconnects locally when provider revocation fails", async () => {
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));
      mockRevokeRefreshToken.mockResolvedValue(false);

      const res = await request(app).delete(disconnectUrl()).set("Authorization", authHeaderFor(hr, company.id));
      expect(res.status).toBe(204);
      const stored = await GoogleCalendarConnection.findOne({ user_id: hr.id });
      expect(stored!.revoked_at).not.toBeNull();
    });

    it("does not affect another user's connection", async () => {
      const otherHr = await createUser({ companyId: company.id, email: "other@a.test", role: "HR" });
      const state = await connectAndCaptureState(hr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-1",
        accountEmail: "alice@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code", state }));

      const otherState = await connectAndCaptureState(otherHr, company.id);
      mockExchangeCodeForTokens.mockResolvedValue({
        refreshToken: "raw-refresh-token-value-2",
        accountEmail: "bob@gmail.com",
        scopes: [],
        calendarPermissionGranted: true,
      });
      await request(app).get(callbackUrl({ code: "auth-code-2", state: otherState }));

      await request(app).delete(disconnectUrl()).set("Authorization", authHeaderFor(hr, company.id));

      const otherStatus = await request(app).get(statusUrl()).set("Authorization", authHeaderFor(otherHr, company.id));
      expect(otherStatus.body.connected).toBe(true);
    });
  });
});
