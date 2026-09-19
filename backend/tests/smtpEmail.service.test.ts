describe("smtpEmailService", () => {
  it("fails clearly, without attempting a connection, when SMTP is not configured", async () => {
    // smtpEmail.service.ts reads SMTP_HOST/PORT/USER/PASS/EMAIL_FROM_ADDRESS
    // from config/env at call time. Asserting "not configured" by relying on
    // tests/env.setup.ts leaving these unset is not actually isolated: env.ts's
    // `import "dotenv/config"` fills in any var absent from process.env from
    // the developer's real local .env — so this test would start failing the
    // moment real SMTP credentials exist there (as happened in practice).
    // Mocking config/env directly, the same approach used for the Groq AI
    // service tests, makes this deterministic regardless of local .env
    // contents, now or in the future.
    jest.resetModules();
    jest.doMock("../src/config/env", () => ({
      env: {
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
        SMTP_SECURE: undefined,
        SMTP_USER: undefined,
        SMTP_PASS: undefined,
        EMAIL_FROM_NAME: "TalentIQ",
        EMAIL_FROM_ADDRESS: undefined,
      },
    }));

    const { smtpEmailService } = require("../src/services/email/smtpEmail.service") as typeof import("../src/services/email/smtpEmail.service");

    await expect(
      smtpEmailService.send({ to: "someone@example.com", subject: "Subject", text: "Text", html: "<p>Html</p>" })
    ).rejects.toThrow(/SMTP email is not configured/);
  });
});
