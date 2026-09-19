import { describe, expect, it } from "vitest";
import { ApiError } from "@/services/api/client";
import { getScreeningErrorMessage } from "@/lib/screeningErrors";

describe("getScreeningErrorMessage", () => {
  it("returns a safe message for 422, without leaking backend/parser detail", () => {
    const err = new ApiError("CvParseError: no_extractable_text — internal parser trace", 422);
    const message = getScreeningErrorMessage(err);
    expect(message).toBe(
      "We couldn't analyze this CV. It may not contain extractable text or may be in an unsupported format."
    );
    expect(message).not.toContain("CvParseError");
    expect(message).not.toContain("internal parser trace");
  });

  it("returns a safe message for 502", () => {
    expect(getScreeningErrorMessage(new ApiError("raw groq detail", 502))).toBe(
      "The AI response could not be processed. Please try again."
    );
  });

  it("returns a safe message for 503", () => {
    expect(getScreeningErrorMessage(new ApiError("raw groq detail", 503))).toBe(
      "AI screening is temporarily unavailable. Please try again later."
    );
  });

  it("returns a safe message for 429 (rate limit)", () => {
    expect(getScreeningErrorMessage(new ApiError("raw rate-limit detail", 429))).toBe(
      "You've reached the AI screening limit. Please try again later."
    );
  });

  it("returns a safe message for 404", () => {
    expect(getScreeningErrorMessage(new ApiError("raw detail", 404))).toBe("This application is unavailable.");
  });

  it("never surfaces the raw ApiError message for a mapped status", () => {
    const err = new ApiError("AKIA-fake-secret-detail should never appear", 503);
    expect(getScreeningErrorMessage(err)).not.toContain("AKIA-fake-secret-detail");
  });

  it("returns a generic fallback for a non-ApiError value", () => {
    expect(getScreeningErrorMessage(new Error("network down"))).toBe("Something went wrong. Please try again.");
  });
});
