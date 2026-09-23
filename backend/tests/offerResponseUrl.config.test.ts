import fs from "fs";
import path from "path";

/**
 * offerEmail.service.ts reads env.FRONTEND_URL at call time — mocking
 * config/env directly (via a fresh module registry per test) proves the
 * Accept/Decline links are actually BUILT FROM whatever is configured,
 * not a hard-coded origin, the same technique already used for the
 * Groq/SMTP/rate-limiter "differently configured" tests elsewhere in this
 * suite.
 */
function loadBuildOfferResponseUrl(frontendUrl: string) {
  jest.resetModules();
  jest.doMock("../src/config/env", () => ({ env: { FRONTEND_URL: frontendUrl } }));
  return (require("../src/modules/offers/offerEmail.service") as typeof import("../src/modules/offers/offerEmail.service"))
    .buildOfferResponseUrl;
}

describe("offer response links — configured frontend URL", () => {
  afterEach(() => {
    jest.dontMock("../src/config/env");
  });

  // 1 / 6. uses the configured FRONTEND_URL, including a production-style
  // https origin — never a hard-coded one.
  it("builds the accept/decline links from the configured FRONTEND_URL", () => {
    const buildOfferResponseUrl = loadBuildOfferResponseUrl("https://talentiq.example.com");
    expect(buildOfferResponseUrl("tok123", "accept")).toBe(
      "https://talentiq.example.com/offer-response#token=tok123&decision=accept"
    );
    expect(buildOfferResponseUrl("tok123", "decline")).toBe(
      "https://talentiq.example.com/offer-response#token=tok123&decision=decline"
    );
  });

  it("reflects a different configured origin when the config changes, proving it isn't hard-coded", () => {
    const local = loadBuildOfferResponseUrl("http://localhost:5173")("tok", "accept");
    const staging = loadBuildOfferResponseUrl("https://staging.talentiq.example.com")("tok", "accept");
    expect(local).toContain("http://localhost:5173/");
    expect(staging).toContain("https://staging.talentiq.example.com/");
  });

  // 4. Accept link remains /offer-response#token=... with the token only
  // ever in the URL fragment, never sent to a server as part of the page
  // load (see this ticket's original scanner-safety design).
  it("keeps the Accept link on /offer-response with the token in the URL fragment", () => {
    const buildOfferResponseUrl = loadBuildOfferResponseUrl("http://localhost:5173");
    const url = buildOfferResponseUrl("abc", "accept");
    expect(url).toBe("http://localhost:5173/offer-response#token=abc&decision=accept");
    expect(url.split("#")[0]).not.toContain("token=");
  });

  // 5. Decline link remains /offer-response#token=...
  it("keeps the Decline link on /offer-response with the token in the URL fragment", () => {
    const buildOfferResponseUrl = loadBuildOfferResponseUrl("http://localhost:5173");
    const url = buildOfferResponseUrl("abc", "decline");
    expect(url).toBe("http://localhost:5173/offer-response#token=abc&decision=decline");
    expect(url.split("#")[0]).not.toContain("token=");
  });

  // 2. no localhost literal exists in the offer email-generation source —
  // the base origin must always come from configuration, never be baked
  // in, which is exactly what let this ticket's cross-device bug happen
  // silently in the first place.
  it("never hard-codes localhost inside the offer email-generation source", () => {
    const sourceFiles = [
      path.join(__dirname, "../src/modules/offers/offerEmail.service.ts"),
      path.join(__dirname, "../src/services/email/templates/offerSent.template.ts"),
    ];
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, "utf-8");
      expect(text.toLowerCase()).not.toContain("localhost");
    }
  });
});
