// Unit tests for the REAL googleCalendarOAuth.service.ts logic —
// googleCalendarOAuth.api.test.ts mocks this entire module, so the actual
// exchangeCodeForTokens/resolveActualGrantedScopes logic (the Part 10
// scope-verification hardening) is otherwise never exercised by any test.
// `googleapis` itself is mocked here (never a real network call), same
// pattern as tests/googleCalendar.service.test.ts.
const mockGetToken = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockGetTokenInfo = jest.fn();
const mockRevokeToken = jest.fn();
const mockGenerateAuthUrl = jest.fn();
const mockOAuth2Constructor = jest.fn().mockImplementation(() => ({
  getToken: mockGetToken,
  verifyIdToken: mockVerifyIdToken,
  getTokenInfo: mockGetTokenInfo,
  revokeToken: mockRevokeToken,
  generateAuthUrl: mockGenerateAuthUrl,
}));

jest.mock("googleapis", () => ({
  google: { auth: { OAuth2: mockOAuth2Constructor } },
}));

jest.mock("../src/config/env", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: "https://app.test/api/v1/integrations/google-calendar/callback",
  },
}));

import { exchangeCodeForTokens } from "../src/modules/integrations/googleCalendar/googleCalendarOAuth.service";

function verifiedIdTokenTicket(email = "alice@gmail.com") {
  return { getPayload: () => ({ email }) };
}

describe("googleCalendarOAuth.service exchangeCodeForTokens (real logic, mocked googleapis)", () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    mockVerifyIdToken.mockReset().mockResolvedValue(verifiedIdTokenTicket());
    mockGetTokenInfo.mockReset();
    mockRevokeToken.mockReset();
    mockGenerateAuthUrl.mockReset();
    mockOAuth2Constructor.mockClear();
  });

  it("verifies granted scopes via getTokenInfo on the freshly issued access token, not the token response's own scope field", async () => {
    mockGetToken.mockResolvedValue({
      tokens: { id_token: "id-token", access_token: "fresh-access-token", refresh_token: "refresh-token", scope: undefined },
    });
    mockGetTokenInfo.mockResolvedValue({ scopes: ["https://www.googleapis.com/auth/calendar.events", "openid"] });

    const result = await exchangeCodeForTokens("auth-code");

    expect(mockGetTokenInfo).toHaveBeenCalledWith("fresh-access-token");
    expect(result.calendarPermissionGranted).toBe(true);
    expect(result.scopes).toEqual(["https://www.googleapis.com/auth/calendar.events", "openid"]);
  });

  it("reports calendarPermissionGranted: false when calendar.events is absent from the actual introspected scopes, even if the OAuth response's own scope string listed it", async () => {
    mockGetToken.mockResolvedValue({
      tokens: {
        id_token: "id-token",
        access_token: "fresh-access-token",
        refresh_token: "refresh-token",
        // This is the exact production trap: the token response's `scope`
        // string claims calendar.events, but real introspection disagrees
        // (e.g. a Workspace admin silently restricted the scope). The
        // fix must never trust this field.
        scope: "https://www.googleapis.com/auth/calendar.events openid",
      },
    });
    mockGetTokenInfo.mockResolvedValue({ scopes: ["openid", "https://www.googleapis.com/auth/userinfo.email"] });

    const result = await exchangeCodeForTokens("auth-code");

    expect(result.calendarPermissionGranted).toBe(false);
    expect(result.scopes).not.toContain("https://www.googleapis.com/auth/calendar.events");
  });

  it("never assumes granted when there is no access token to introspect", async () => {
    mockGetToken.mockResolvedValue({ tokens: { id_token: "id-token", access_token: null, refresh_token: "refresh-token" } });

    const result = await exchangeCodeForTokens("auth-code");

    expect(mockGetTokenInfo).not.toHaveBeenCalled();
    expect(result.calendarPermissionGranted).toBe(false);
    expect(result.scopes).toEqual([]);
  });

  it("never assumes granted when token introspection itself fails", async () => {
    mockGetToken.mockResolvedValue({
      tokens: { id_token: "id-token", access_token: "fresh-access-token", refresh_token: "refresh-token" },
    });
    mockGetTokenInfo.mockRejectedValue(new Error("introspection unavailable"));

    const result = await exchangeCodeForTokens("auth-code");

    expect(result.calendarPermissionGranted).toBe(false);
    expect(result.scopes).toEqual([]);
  });

  it("still extracts the account email and refresh token normally alongside the scope verification", async () => {
    mockGetToken.mockResolvedValue({
      tokens: { id_token: "id-token", access_token: "fresh-access-token", refresh_token: "a-refresh-token" },
    });
    mockVerifyIdToken.mockResolvedValue(verifiedIdTokenTicket("Alice@Gmail.com"));
    mockGetTokenInfo.mockResolvedValue({ scopes: ["https://www.googleapis.com/auth/calendar.events"] });

    const result = await exchangeCodeForTokens("auth-code");

    expect(result.accountEmail).toBe("alice@gmail.com");
    expect(result.refreshToken).toBe("a-refresh-token");
  });

  it("throws without ever calling getTokenInfo when there is no id_token to verify identity from", async () => {
    mockGetToken.mockResolvedValue({ tokens: { id_token: null, access_token: "fresh-access-token" } });

    await expect(exchangeCodeForTokens("auth-code")).rejects.toThrow();
    expect(mockGetTokenInfo).not.toHaveBeenCalled();
  });
});
