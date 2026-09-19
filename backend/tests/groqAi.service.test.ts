const FAKE_API_KEY = "test-only-fake-groq-key-do-not-log";
const mockCreate = jest.fn();

// The Groq client constructor itself is mocked; the SDK's error classes are
// the real ones (via requireActual) so `instanceof` checks inside
// groqAi.service.ts behave exactly as they would against a real failure.
jest.mock("groq-sdk", () => {
  const actual = jest.requireActual("groq-sdk");
  const MockGroq = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
  return {
    __esModule: true,
    default: MockGroq,
    Groq: MockGroq,
    APIError: actual.APIError,
    APIConnectionError: actual.APIConnectionError,
    RateLimitError: actual.RateLimitError,
  };
});

// groqAi.service.ts reads GROQ_API_KEY/GROQ_MODEL from config/env at
// import time. Rather than toggling process.env (which env.ts's `import
// "dotenv/config"` would repopulate from the developer's real local .env
// whenever a key is absent — exactly what broke tests/smtpEmail.service.test.ts
// once real SMTP credentials landed in that file), config/env is mocked
// directly per test via a fresh module registry. This keeps these tests
// correct regardless of what the real .env does or ever will contain.
function loadConfiguredService(model = "openai/gpt-oss-120b") {
  jest.resetModules();
  jest.doMock("../src/config/env", () => ({ env: { GROQ_API_KEY: FAKE_API_KEY, GROQ_MODEL: model } }));
  return (require("../src/services/ai/groqAi.service") as typeof import("../src/services/ai/groqAi.service"))
    .groqAiService;
}

function loadUnconfiguredService() {
  jest.resetModules();
  jest.doMock("../src/config/env", () => ({ env: { GROQ_API_KEY: undefined, GROQ_MODEL: "openai/gpt-oss-120b" } }));
  return (require("../src/services/ai/groqAi.service") as typeof import("../src/services/ai/groqAi.service"))
    .groqAiService;
}

describe("groqAiService", () => {
  afterEach(() => {
    mockCreate.mockReset();
    jest.restoreAllMocks();
  });

  it("returns normalized content, model, and usage from a successful response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "Candidate has 5 years of experience." } }],
      model: "openai/gpt-oss-120b",
      usage: { prompt_tokens: 42, completion_tokens: 8, total_tokens: 50 },
    });

    const service = loadConfiguredService();
    const result = await service.generate({ userPrompt: "Summarize this." });

    expect(result).toEqual({
      content: "Candidate has 5 years of experience.",
      model: "openai/gpt-oss-120b",
      usage: { promptTokens: 42, completionTokens: 8, totalTokens: 50 },
    });
  });

  it("normalizes a response with no usage metadata to an undefined usage field", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "OK" } }],
      model: "openai/gpt-oss-120b",
    });

    const service = loadConfiguredService();
    const result = await service.generate({ userPrompt: "Hi" });

    expect(result.usage).toBeUndefined();
  });

  it("sends the request using the configured GROQ_MODEL", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "OK" } }],
      model: "openai/gpt-oss-120b",
    });

    const service = loadConfiguredService("openai/gpt-oss-120b");
    await service.generate({ userPrompt: "Hi" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-oss-120b" }),
      expect.anything()
    );
  });

  it("never returns or logs the configured GROQ_API_KEY", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "OK" } }],
      model: "openai/gpt-oss-120b",
    });

    const service = loadConfiguredService();
    const result = await service.generate({ userPrompt: "Hi" });

    expect(JSON.stringify(result)).not.toContain(FAKE_API_KEY);
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(FAKE_API_KEY);
  });

  it("fails clearly, without calling the provider, when GROQ_API_KEY is not configured", async () => {
    const service = loadUnconfiguredService();

    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({
      name: "AIServiceError",
      code: "not_configured",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // Each of these constructs a real error instance (via requireActual)
  // AFTER loading the service. loadConfiguredService() calls
  // jest.resetModules(), which makes the next require("groq-sdk") re-run
  // the mock factory and re-load the real module fresh — so an `actual`
  // obtained beforehand would be a *different* module instance than the
  // one groqAi.service.ts's `instanceof` checks are actually comparing
  // against, and every case would silently fall through to the generic
  // provider_error branch without truly exercising the intended one.

  it("translates a generic provider failure into a safe provider_error without leaking internals", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const service = loadConfiguredService();
    const actual = jest.requireActual("groq-sdk");
    mockCreate.mockRejectedValueOnce(
      new actual.APIError(500, { error: { message: "upstream exploded" } }, "upstream exploded", new Headers())
    );

    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({ code: "provider_error" });
    // Confirms the `instanceof APIError` branch actually matched (status
    // logged), rather than the outcome coincidentally matching the
    // catch-all default.
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 500 }));
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(FAKE_API_KEY);
  });

  it("translates a connection failure into a safe unavailable error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const service = loadConfiguredService();
    const actual = jest.requireActual("groq-sdk");
    mockCreate.mockRejectedValueOnce(new actual.APIConnectionError({ message: "network down" }));

    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({ code: "unavailable" });
  });

  it("translates a rate-limit failure into a safe rate_limited error without exposing secrets", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const service = loadConfiguredService();
    const actual = jest.requireActual("groq-sdk");
    mockCreate.mockRejectedValueOnce(
      new actual.RateLimitError(429, { error: { message: "rate limited" } }, "rate limited", new Headers())
    );

    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({ code: "rate_limited" });
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 429 }));
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(FAKE_API_KEY);
  });

  it("treats a missing message content as a malformed_response error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({ choices: [{ message: {} }], model: "openai/gpt-oss-120b" });

    const service = loadConfiguredService();
    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("treats an empty-string message content as a malformed_response error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "   " } }],
      model: "openai/gpt-oss-120b",
    });

    const service = loadConfiguredService();
    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({ code: "malformed_response" });
  });

  it("treats a response with no choices as a malformed_response error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({ choices: [], model: "openai/gpt-oss-120b" });

    const service = loadConfiguredService();
    await expect(service.generate({ userPrompt: "Hi" })).rejects.toMatchObject({ code: "malformed_response" });
  });
});
