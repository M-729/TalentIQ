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

  // ===== FAIL-CLOSED TEST-ENVIRONMENT SAFEGUARD =====
  describe("fail-closed safeguard against real SMTP under NODE_ENV=test", () => {
    const REAL_LOOKING_CONFIG = {
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: "someone@gmail.com",
      SMTP_PASS: "a-real-looking-app-password",
      EMAIL_FROM_NAME: "TalentIQ",
      EMAIL_FROM_ADDRESS: "someone@gmail.com",
    };

    afterEach(() => {
      jest.dontMock("nodemailer");
    });

    it("refuses to create a real transporter when NODE_ENV=test, even with fully-configured (real-looking) SMTP credentials", async () => {
      const mockCreateTransport = jest.fn();
      jest.resetModules();
      jest.doMock("nodemailer", () => ({ createTransport: mockCreateTransport }));
      jest.doMock("../src/config/env", () => ({ env: { ...REAL_LOOKING_CONFIG, NODE_ENV: "test" } }));

      const { smtpEmailService } = require("../src/services/email/smtpEmail.service") as typeof import("../src/services/email/smtpEmail.service");

      await expect(
        smtpEmailService.send({ to: "candidate@example.com", subject: "Subject", text: "Text", html: "<p>Html</p>" })
      ).rejects.toThrow(/Refusing to create a real SMTP transporter while NODE_ENV=test/);

      // The guard fires BEFORE a transporter (and therefore any real
      // network connection) is ever created.
      expect(mockCreateTransport).not.toHaveBeenCalled();
    });

    it("does not interfere with production behavior — a real transporter is created and used normally", async () => {
      const mockSendMail = jest.fn().mockResolvedValue(undefined);
      const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });
      jest.resetModules();
      jest.doMock("nodemailer", () => ({ createTransport: mockCreateTransport }));
      jest.doMock("../src/config/env", () => ({ env: { ...REAL_LOOKING_CONFIG, NODE_ENV: "production" } }));

      const { smtpEmailService } = require("../src/services/email/smtpEmail.service") as typeof import("../src/services/email/smtpEmail.service");

      await smtpEmailService.send({ to: "candidate@example.com", subject: "Subject", text: "Text", html: "<p>Html</p>" });

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "candidate@example.com", subject: "Subject" }));
    });

    it("does not interfere with development behavior — a real transporter is created and used normally", async () => {
      const mockSendMail = jest.fn().mockResolvedValue(undefined);
      const mockCreateTransport = jest.fn().mockReturnValue({ sendMail: mockSendMail });
      jest.resetModules();
      jest.doMock("nodemailer", () => ({ createTransport: mockCreateTransport }));
      jest.doMock("../src/config/env", () => ({ env: { ...REAL_LOOKING_CONFIG, NODE_ENV: "development" } }));

      const { smtpEmailService } = require("../src/services/email/smtpEmail.service") as typeof import("../src/services/email/smtpEmail.service");

      await smtpEmailService.send({ to: "candidate@example.com", subject: "Subject", text: "Text", html: "<p>Html</p>" });

      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });
});
