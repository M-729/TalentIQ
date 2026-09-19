import { smtpEmailService } from "../src/services/email/smtpEmail.service";

describe("smtpEmailService", () => {
  it("fails clearly, without attempting a connection, when SMTP is not configured", async () => {
    // The test environment deliberately has no SMTP_* variables set (see
    // tests/env.setup.ts) — email configuration must not be required for
    // the rest of the backend/test suite to boot. Calling send() while
    // unset should fail fast with a clear message, not hang or throw
    // something unrelated from inside Nodemailer.
    await expect(
      smtpEmailService.send({ to: "someone@example.com", subject: "Subject", text: "Text", html: "<p>Html</p>" })
    ).rejects.toThrow(/SMTP email is not configured/);
  });
});
