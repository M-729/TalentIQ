import express, { type RequestHandler } from "express";
import request from "supertest";

// rateLimit.middleware.ts only reads env.NODE_ENV and
// env.AI_SCREENING_RATE_LIMIT_PER_HOUR — mocking config/env with just
// those two fields (via a fresh, isolated module registry per test) keeps
// this deterministic regardless of anything in the real local .env, and
// never touches the full app or any real secret. This mirrors the same
// technique already used for the Groq/SMTP/R2 "unconfigured" tests
// elsewhere in this suite.
function loadRateLimiter(overrides: { NODE_ENV?: string; AI_SCREENING_RATE_LIMIT_PER_HOUR?: number } = {}) {
  jest.resetModules();
  jest.doMock("../src/config/env", () => ({
    env: {
      NODE_ENV: overrides.NODE_ENV ?? "production",
      AI_SCREENING_RATE_LIMIT_PER_HOUR: overrides.AI_SCREENING_RATE_LIMIT_PER_HOUR ?? 2,
    },
  }));
  return (require("../src/middleware/rateLimit.middleware") as typeof import("../src/middleware/rateLimit.middleware"))
    .aiScreeningRateLimiter;
}

function appWithFixedUser(limiter: RequestHandler) {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { userId: "test-user-1", companyId: "company-1", role: "HR" };
    next();
  });
  app.post("/screen", limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe("aiScreeningRateLimiter", () => {
  it("allows requests up to the configured limit, then returns 429", async () => {
    const limiter = loadRateLimiter({ AI_SCREENING_RATE_LIMIT_PER_HOUR: 2 });
    const app = appWithFixedUser(limiter);

    const first = await request(app).post("/screen");
    const second = await request(app).post("/screen");
    const third = await request(app).post("/screen");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });

  it("limits per authenticated user, not per IP — a different user is unaffected by the first user's usage", async () => {
    const limiter = loadRateLimiter({ AI_SCREENING_RATE_LIMIT_PER_HOUR: 1 });
    const app = express();
    app.use((req, _res, next) => {
      const userId = req.headers["x-test-user"] as string;
      req.auth = { userId, companyId: "company-1", role: "HR" };
      next();
    });
    app.post("/screen", limiter, (_req, res) => res.status(200).json({ ok: true }));

    const userOne = await request(app).post("/screen").set("x-test-user", "user-1");
    const userOneAgain = await request(app).post("/screen").set("x-test-user", "user-1");
    const userTwo = await request(app).post("/screen").set("x-test-user", "user-2");

    expect(userOne.status).toBe(200);
    expect(userOneAgain.status).toBe(429); // user-1 exhausted their own limit of 1
    expect(userTwo.status).toBe(200); // a different user is not throttled by user-1's usage
  });

  it("is skipped entirely when NODE_ENV is 'test', matching every other rate limiter in this project", async () => {
    const limiter = loadRateLimiter({ NODE_ENV: "test", AI_SCREENING_RATE_LIMIT_PER_HOUR: 1 });
    const app = appWithFixedUser(limiter);

    const first = await request(app).post("/screen");
    const second = await request(app).post("/screen");
    const third = await request(app).post("/screen");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(200);
  });
});

describe("GET latest/history routes are unaffected by the AI screening rate limiter", () => {
  it("the screening router only attaches aiScreeningRateLimiter to the POST route", () => {
    // Structural check on the real router (not the isolated mock above):
    // confirms by inspection of the actual registered route stack that
    // GET /latest and GET / never pass through aiScreeningRateLimiter,
    // rather than relying on the global test-environment skip (which
    // would also silently hide a wrongly-attached limiter).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { screeningRouter } = require("../src/modules/screenings/screening.routes") as typeof import("../src/modules/screenings/screening.routes");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { aiScreeningRateLimiter } = require("../src/middleware/rateLimit.middleware") as typeof import("../src/middleware/rateLimit.middleware");

    type RouterLayer = { route?: { path: string; stack: Array<{ handle: unknown; method: string }> } };
    const layers = (screeningRouter as unknown as { stack: RouterLayer[] }).stack;

    for (const layer of layers) {
      if (!layer.route) continue;
      const usesLimiter = layer.route.stack.some((entry) => entry.handle === aiScreeningRateLimiter);
      if (layer.route.path === "/" && layer.route.stack.some((entry) => entry.method === "get")) {
        expect(usesLimiter).toBe(false);
      }
      if (layer.route.path === "/latest") {
        expect(usesLimiter).toBe(false);
      }
    }
  });
});
