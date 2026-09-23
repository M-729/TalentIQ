import express, { type RequestHandler } from "express";
import request from "supertest";

// Mirrors screeningRateLimit.test.ts's exact technique: mocking
// config/env with a fresh, isolated module registry per test keeps this
// deterministic regardless of the real local .env, and never touches the
// full app or any real secret.
function loadLimiters(overrides: { NODE_ENV?: string } = {}) {
  jest.resetModules();
  jest.doMock("../src/config/env", () => ({
    env: { NODE_ENV: overrides.NODE_ENV ?? "production" },
  }));
  return require("../src/middleware/rateLimit.middleware") as typeof import("../src/middleware/rateLimit.middleware");
}

function appWith(limiter: RequestHandler) {
  const app = express();
  app.post("/action", limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("offerResponseLookupRateLimiter / offerResponseRespondRateLimiter", () => {
  // 39. public endpoints rate limited
  it("39a. offerResponseLookupRateLimiter allows requests up to its limit, then returns 429", async () => {
    const { offerResponseLookupRateLimiter } = loadLimiters();
    const app = appWith(offerResponseLookupRateLimiter);

    const results = [];
    for (let i = 0; i < 31; i++) {
      results.push((await request(app).post("/action")).status);
    }

    expect(results.slice(0, 30)).toEqual(Array(30).fill(200));
    expect(results[30]).toBe(429);
  });

  it("39b. offerResponseRespondRateLimiter allows requests up to its limit, then returns 429", async () => {
    const { offerResponseRespondRateLimiter } = loadLimiters();
    const app = appWith(offerResponseRespondRateLimiter);

    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push((await request(app).post("/action")).status);
    }

    expect(results.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(results[10]).toBe(429);
  });

  it("both are skipped entirely when NODE_ENV is 'test', matching every other rate limiter in this project", async () => {
    const { offerResponseRespondRateLimiter } = loadLimiters({ NODE_ENV: "test" });
    const app = appWith(offerResponseRespondRateLimiter);

    for (let i = 0; i < 15; i++) {
      expect((await request(app).post("/action")).status).toBe(200);
    }
  });
});

describe("offerResponseRouter attaches the expected rate limiters", () => {
  it("structurally confirms lookup and respond each go through their own limiter", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { offerResponseRouter } = require("../src/modules/offerResponse/offerResponse.routes") as typeof import("../src/modules/offerResponse/offerResponse.routes");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { offerResponseLookupRateLimiter, offerResponseRespondRateLimiter } = require("../src/middleware/rateLimit.middleware") as typeof import("../src/middleware/rateLimit.middleware");

    type RouterLayer = { route?: { path: string; stack: Array<{ handle: unknown }> } };
    const layers = (offerResponseRouter as unknown as { stack: RouterLayer[] }).stack;

    const lookupLayer = layers.find((l) => l.route?.path === "/lookup");
    const respondLayer = layers.find((l) => l.route?.path === "/respond");

    expect(lookupLayer!.route!.stack.some((entry) => entry.handle === offerResponseLookupRateLimiter)).toBe(true);
    expect(respondLayer!.route!.stack.some((entry) => entry.handle === offerResponseRespondRateLimiter)).toBe(true);
  });
});
