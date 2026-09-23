/**
 * Exercises the REAL config/env.ts zod schema for FRONTEND_URL (not a
 * mock) — validation/normalization behavior itself is what's under test
 * here, so mocking config/env (the pattern used everywhere else in this
 * suite) would defeat the point. process.env.FRONTEND_URL is set
 * explicitly before each require, so dotenv/config's "only fills in vars
 * absent from process.env" behavior never lets a developer's real local
 * .env leak into these assertions (see tests/smtpEmail.service.test.ts's
 * doc comment for the failure mode this avoids), and it is restored to
 * tests/env.setup.ts's pinned value afterward so no other test file in
 * this worker ever sees a mutated value.
 */
const PINNED_FRONTEND_URL = process.env.FRONTEND_URL;

function parseEnvWithFrontendUrl(value: string): () => typeof import("../src/config/env") {
  jest.resetModules();
  process.env.FRONTEND_URL = value;
  return () => require("../src/config/env") as typeof import("../src/config/env");
}

describe("FRONTEND_URL environment validation/normalization", () => {
  afterEach(() => {
    process.env.FRONTEND_URL = PINNED_FRONTEND_URL;
    jest.resetModules();
  });

  // 3. trailing slash is normalized
  it("strips a trailing slash so generated links never contain a double slash", () => {
    const { env } = parseEnvWithFrontendUrl("https://talentiq.example.com/")();
    expect(env.FRONTEND_URL).toBe("https://talentiq.example.com");
  });

  it("strips multiple trailing slashes", () => {
    const { env } = parseEnvWithFrontendUrl("https://talentiq.example.com///")();
    expect(env.FRONTEND_URL).toBe("https://talentiq.example.com");
  });

  // 6. production-style https URL works
  it("accepts a production-style https URL unchanged", () => {
    const { env } = parseEnvWithFrontendUrl("https://talentiq.example.com")();
    expect(env.FRONTEND_URL).toBe("https://talentiq.example.com");
  });

  it("accepts an explicitly configured, externally reachable http dev URL", () => {
    const { env } = parseEnvWithFrontendUrl("http://192.0.2.10:5173")();
    expect(env.FRONTEND_URL).toBe("http://192.0.2.10:5173");
  });

  // 7. invalid frontend URL config rejected
  it("rejects a javascript: URL", () => {
    expect(() => parseEnvWithFrontendUrl("javascript:alert(1)")()).toThrow(/Invalid environment configuration/);
  });

  it("rejects a data: URL", () => {
    expect(() => parseEnvWithFrontendUrl("data:text/html,hi")()).toThrow(/Invalid environment configuration/);
  });

  it("rejects a file: URL", () => {
    expect(() => parseEnvWithFrontendUrl("file:///etc/passwd")()).toThrow(/Invalid environment configuration/);
  });

  it("rejects a bare hostname with no scheme", () => {
    expect(() => parseEnvWithFrontendUrl("talentiq.example.com")()).toThrow(/Invalid environment configuration/);
  });

  it("rejects an empty string", () => {
    expect(() => parseEnvWithFrontendUrl("")()).toThrow(/Invalid environment configuration/);
  });
});
