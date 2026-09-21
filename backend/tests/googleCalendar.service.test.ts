// Unit tests for the ONE module that talks to real `googleapis` — every
// other module in this codebase only ever sees GoogleCalendarProviderError
// (see googleCalendar.types.ts's doc comment). `googleapis` itself is
// mocked here (never a real network call); config/env is mocked to supply
// fake-but-present OAuth client config, matching the same
// "mock the underlying SDK client, not our own code" pattern already used
// by tests/r2CvStorage.download.test.ts.
const mockInsert = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();
const mockGet = jest.fn();
const mockSetCredentials = jest.fn();
const mockCalendarFactory = jest.fn().mockImplementation(() => ({
  events: { insert: mockInsert, patch: mockPatch, delete: mockDelete, get: mockGet },
}));
const mockOAuth2Constructor = jest.fn().mockImplementation(() => ({ setCredentials: mockSetCredentials }));

jest.mock("googleapis", () => ({
  google: {
    auth: { OAuth2: mockOAuth2Constructor },
    calendar: mockCalendarFactory,
  },
}));

jest.mock("../src/config/env", () => ({
  env: {
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REDIRECT_URI: "https://app.test/api/v1/integrations/google-calendar/callback",
  },
}));

import { realGoogleCalendarProvider } from "../src/modules/integrations/googleCalendar/googleCalendar.service";
import { GoogleCalendarProviderError } from "../src/modules/integrations/googleCalendar/googleCalendar.types";
import type { GoogleCalendarEventInput } from "../src/modules/integrations/googleCalendar/googleCalendar.types";

function sampleInput(overrides: Partial<GoogleCalendarEventInput> = {}): GoogleCalendarEventInput {
  return {
    summary: "Technical Interview",
    description: "TalentIQ interview for: Backend Developer",
    startsAt: new Date("2030-01-01T10:00:00.000Z"),
    endsAt: new Date("2030-01-01T11:00:00.000Z"),
    timezone: "Asia/Beirut",
    attendeeEmails: ["candidate@example.com", "interviewer@example.com"],
    conferenceRequestId: "fixed-request-id-1",
    ...overrides,
  };
}

function apiError(status: number, reason?: string) {
  return {
    response: {
      status,
      data: reason ? { error: { code: status, message: "generic Google error message", errors: [{ reason, message: "generic Google error message" }] } } : undefined,
    },
  };
}

describe("googleCalendar.service (real provider, mocked googleapis)", () => {
  beforeEach(() => {
    mockInsert.mockReset();
    mockPatch.mockReset();
    mockDelete.mockReset();
    mockGet.mockReset();
    mockSetCredentials.mockReset();
    mockCalendarFactory.mockClear();
    mockOAuth2Constructor.mockClear();
  });

  describe("createEvent", () => {
    it("calls events.insert on the primary calendar with sendUpdates=all and conferenceDataVersion=1", async () => {
      mockInsert.mockResolvedValue({ data: { id: "evt-1", conferenceData: undefined } });

      await realGoogleCalendarProvider.createEvent("refresh-token", sampleInput());

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const call = mockInsert.mock.calls[0]![0];
      expect(call.calendarId).toBe("primary");
      expect(call.sendUpdates).toBe("all");
      expect(call.conferenceDataVersion).toBe(1);
    });

    it("uses the given refresh token to authorize the calendar client", async () => {
      mockInsert.mockResolvedValue({ data: { id: "evt-1" } });
      await realGoogleCalendarProvider.createEvent("a-specific-refresh-token", sampleInput());
      expect(mockSetCredentials).toHaveBeenCalledWith({ refresh_token: "a-specific-refresh-token" });
    });

    it("builds a request body with summary/description/start/end/timezone/attendees", async () => {
      mockInsert.mockResolvedValue({ data: { id: "evt-1" } });
      const input = sampleInput();
      await realGoogleCalendarProvider.createEvent("refresh-token", input);

      const body = mockInsert.mock.calls[0]![0].requestBody;
      expect(body.summary).toBe(input.summary);
      expect(body.description).toBe(input.description);
      expect(body.start).toEqual({ dateTime: input.startsAt.toISOString(), timeZone: input.timezone });
      expect(body.end).toEqual({ dateTime: input.endsAt.toISOString(), timeZone: input.timezone });
      expect(body.attendees).toEqual([{ email: "candidate@example.com" }, { email: "interviewer@example.com" }]);
    });

    it("requests a Meet conference via conferenceData.createRequest using the given fresh requestId", async () => {
      mockInsert.mockResolvedValue({ data: { id: "evt-1" } });
      await realGoogleCalendarProvider.createEvent("refresh-token", sampleInput({ conferenceRequestId: "unique-request-id-xyz" }));

      const body = mockInsert.mock.calls[0]![0].requestBody;
      expect(body.conferenceData.createRequest.requestId).toBe("unique-request-id-xyz");
      expect(body.conferenceData.createRequest.conferenceSolutionKey).toEqual({ type: "hangoutsMeet" });
    });

    it("extracts the Meet URL from conferenceData's video entry point, never constructing one", async () => {
      mockInsert.mockResolvedValue({
        data: {
          id: "evt-1",
          conferenceData: {
            createRequest: { status: { statusCode: "success" } },
            entryPoints: [
              { entryPointType: "phone", uri: "tel:+1-555-0100" },
              { entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" },
            ],
          },
        },
      });

      const result = await realGoogleCalendarProvider.createEvent("refresh-token", sampleInput());
      expect(result.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
      expect(result.conferencePending).toBe(false);
      expect(result.eventId).toBe("evt-1");
    });

    it("treats a pending conference creation as pending with no meeting URL", async () => {
      mockInsert.mockResolvedValue({
        data: {
          id: "evt-1",
          conferenceData: { createRequest: { status: { statusCode: "pending" } } },
        },
      });

      const result = await realGoogleCalendarProvider.createEvent("refresh-token", sampleInput());
      expect(result.conferencePending).toBe(true);
      expect(result.meetingUrl).toBeNull();
    });

    it("treats conferenceData with no video entry point yet as pending, even without an explicit pending status", async () => {
      mockInsert.mockResolvedValue({
        data: { id: "evt-1", conferenceData: { entryPoints: [{ entryPointType: "phone", uri: "tel:+1" }] } },
      });

      const result = await realGoogleCalendarProvider.createEvent("refresh-token", sampleInput());
      expect(result.conferencePending).toBe(true);
      expect(result.meetingUrl).toBeNull();
    });

    it("throws a safe provider_error when Google's response has no event id", async () => {
      mockInsert.mockResolvedValue({ data: {} });
      await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
        name: "GoogleCalendarProviderError",
        code: "provider_error",
      });
    });

    it.each([
      [401, "authorization_required"],
      [404, "event_not_found"],
      [429, "rate_limited"],
      [500, "provider_unavailable"],
      [503, "provider_unavailable"],
      [400, "provider_error"],
    ] as const)("maps a %d Google error to safe code %s", async (status, code) => {
      mockInsert.mockRejectedValue(apiError(status));
      await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
        name: "GoogleCalendarProviderError",
        code,
        providerHttpStatus: status,
      });
    });

    it("never leaks the raw Google error message in the thrown error", async () => {
      mockInsert.mockRejectedValue(new Error("invalid_grant: token has been expired or revoked for account foo@bar.com"));
      const rejection = realGoogleCalendarProvider.createEvent("refresh-token", sampleInput());
      await expect(rejection).rejects.toBeInstanceOf(GoogleCalendarProviderError);
      await expect(rejection).rejects.not.toThrow(/foo@bar\.com/);
    });

    // A generic 403 is NOT specifically "your authorization is invalid" —
    // Google Calendar returns 403 for rate/quota limits, the caller's own
    // API configuration, and forbidden-but-authorized operations alike.
    // Only a whitelisted, Google-documented authorization-specific
    // `reason` may ever turn a 403 into authorization_required; see
    // googleCalendar.service.ts's mapGoogleApiError doc comment for why a
    // blanket "401 or 403 -> authorization_required" was wrong (it told
    // still-validly-connected users to reconnect for unrelated failures).
    describe("403 reason classification (never assumes reconnect)", () => {
      it.each([
        ["insufficientPermissions", "authorization_required"],
        ["authError", "authorization_required"],
        ["insufficientScopes", "authorization_required"],
      ] as const)("maps 403 %s to %s", async (reason, code) => {
        mockInsert.mockRejectedValue(apiError(403, reason));
        await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
          code,
          providerHttpStatus: 403,
          providerReason: reason,
        });
      });

      it.each([
        ["rateLimitExceeded", "rate_limited"],
        ["userRateLimitExceeded", "rate_limited"],
        ["quotaExceeded", "rate_limited"],
        ["dailyLimitExceeded", "rate_limited"],
      ] as const)("maps 403 %s to %s", async (reason, code) => {
        mockInsert.mockRejectedValue(apiError(403, reason));
        await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
          code,
          providerHttpStatus: 403,
          providerReason: reason,
        });
      });

      it("maps 403 accessNotConfigured (API/service configuration) to provider_unavailable, not authorization_required", async () => {
        mockInsert.mockRejectedValue(apiError(403, "accessNotConfigured"));
        await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
          code: "provider_unavailable",
          providerReason: "accessNotConfigured",
        });
      });

      it("maps 403 forbiddenForNonOrganizer to provider_error, not authorization_required", async () => {
        mockInsert.mockRejectedValue(apiError(403, "forbiddenForNonOrganizer"));
        await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
          code: "provider_error",
          providerReason: "forbiddenForNonOrganizer",
        });
      });

      it("maps an unrecognized/unknown 403 reason to provider_error, never authorization_required", async () => {
        mockInsert.mockRejectedValue(apiError(403, "someUndocumentedFutureReason"));
        await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
          code: "provider_error",
        });
      });

      it("maps a 403 with no reason at all to provider_error, never authorization_required", async () => {
        mockInsert.mockRejectedValue(apiError(403));
        await expect(realGoogleCalendarProvider.createEvent("refresh-token", sampleInput())).rejects.toMatchObject({
          code: "provider_error",
          providerHttpStatus: 403,
        });
      });
    });

    it("captures Google's short reason identifier for diagnostics without leaking the message/body", async () => {
      mockInsert.mockRejectedValue({
        response: {
          status: 403,
          data: {
            error: {
              code: 403,
              message: "The caller does not have permission for account foo@bar.com, key AKIA-fake-secret",
              errors: [{ reason: "insufficientPermissions", message: "The caller does not have permission for account foo@bar.com, key AKIA-fake-secret" }],
            },
          },
        },
      });

      const rejection = realGoogleCalendarProvider.createEvent("refresh-token", sampleInput());
      await expect(rejection).rejects.toMatchObject({ providerReason: "insufficientPermissions" });
      await expect(rejection).rejects.not.toThrow(/foo@bar\.com|AKIA-fake-secret/);
    });

    it("never includes the refresh token in the thrown error", async () => {
      mockInsert.mockRejectedValue(apiError(403, "insufficientPermissions"));
      const rejection = realGoogleCalendarProvider.createEvent("a-real-looking-refresh-token-value", sampleInput());
      await expect(rejection).rejects.not.toThrow(/a-real-looking-refresh-token-value/);
    });
  });

  describe("updateEvent", () => {
    it("patches (not inserts) the existing event by id, with the same sendUpdates/conferenceDataVersion", async () => {
      mockPatch.mockResolvedValue({ data: { id: "evt-1" } });
      await realGoogleCalendarProvider.updateEvent("refresh-token", "evt-1", sampleInput());

      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockPatch).toHaveBeenCalledTimes(1);
      const call = mockPatch.mock.calls[0]![0];
      expect(call.calendarId).toBe("primary");
      expect(call.eventId).toBe("evt-1");
      expect(call.sendUpdates).toBe("all");
      expect(call.conferenceDataVersion).toBe(1);
    });

    it("maps a 404 on patch to event_not_found", async () => {
      mockPatch.mockRejectedValue(apiError(404));
      await expect(realGoogleCalendarProvider.updateEvent("refresh-token", "missing-evt", sampleInput())).rejects.toMatchObject({
        code: "event_not_found",
      });
    });
  });

  describe("cancelEvent", () => {
    it("deletes the event with sendUpdates=all", async () => {
      mockDelete.mockResolvedValue({});
      await realGoogleCalendarProvider.cancelEvent("refresh-token", "evt-1");
      expect(mockDelete).toHaveBeenCalledWith({ calendarId: "primary", eventId: "evt-1", sendUpdates: "all" });
    });

    it("treats an already-deleted (410 Gone) event as a successful, idempotent cancel", async () => {
      mockDelete.mockRejectedValue(apiError(410));
      await expect(realGoogleCalendarProvider.cancelEvent("refresh-token", "evt-1")).resolves.toBeUndefined();
    });

    it("treats a not-found (404) event as a successful, idempotent cancel", async () => {
      mockDelete.mockRejectedValue(apiError(404));
      await expect(realGoogleCalendarProvider.cancelEvent("refresh-token", "evt-1")).resolves.toBeUndefined();
    });

    it("still surfaces a genuine failure (e.g. 429) as a safe error", async () => {
      mockDelete.mockRejectedValue(apiError(429));
      await expect(realGoogleCalendarProvider.cancelEvent("refresh-token", "evt-1")).rejects.toMatchObject({
        code: "rate_limited",
      });
    });
  });

  describe("getEvent", () => {
    it("reads the existing event without creating or modifying it", async () => {
      mockGet.mockResolvedValue({
        data: {
          id: "evt-1",
          conferenceData: {
            createRequest: { status: { statusCode: "success" } },
            entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/xyz" }],
          },
        },
      });

      const result = await realGoogleCalendarProvider.getEvent("refresh-token", "evt-1");
      expect(mockGet).toHaveBeenCalledWith({ calendarId: "primary", eventId: "evt-1" });
      expect(mockInsert).not.toHaveBeenCalled();
      expect(mockPatch).not.toHaveBeenCalled();
      expect(result).toEqual({ eventId: "evt-1", meetingUrl: "https://meet.google.com/xyz", conferencePending: false });
    });
  });
});
