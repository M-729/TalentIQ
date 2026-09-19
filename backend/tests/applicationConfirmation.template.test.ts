import { buildApplicationConfirmationEmail } from "../src/services/email/templates/applicationConfirmation.template";

describe("buildApplicationConfirmationEmail", () => {
  it("includes candidate name, job title, and company name in both text and html", () => {
    const result = buildApplicationConfirmationEmail({
      candidateName: "Jane Doe",
      jobTitle: "Senior Backend Engineer",
      companyName: "Acme Recruiting Co",
    });

    expect(result.subject).toBe("Application received — Senior Backend Engineer");
    expect(result.text).toContain("Jane Doe");
    expect(result.text).toContain("Senior Backend Engineer");
    expect(result.text).toContain("Acme Recruiting Co");
    expect(result.html).toContain("Jane Doe");
    expect(result.html).toContain("Senior Backend Engineer");
    expect(result.html).toContain("Acme Recruiting Co");
  });

  it("does not promise an interview, expose AI/score language, or mention internal status", () => {
    const result = buildApplicationConfirmationEmail({
      candidateName: "Jane Doe",
      jobTitle: "Engineer",
      companyName: "Acme",
    });

    const combined = (result.text + result.html).toLowerCase();
    expect(combined).not.toContain("interview");
    // A raw `.not.toContain("ai")` false-fails here: "email" legitimately
    // contains the substring "ai". Word-boundary matching avoids that.
    expect(combined).not.toMatch(/\bai\b/);
    expect(combined).not.toContain("score");
    expect(combined).not.toContain("approved");
    expect(combined).not.toContain("rejected");
  });

  it("escapes HTML-sensitive characters in candidate name within the html output", () => {
    const result = buildApplicationConfirmationEmail({
      candidateName: '<script>alert("xss")</script>',
      jobTitle: "Engineer",
      companyName: "Acme",
    });

    expect(result.html).not.toContain("<script>alert(\"xss\")</script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("&quot;xss&quot;");
  });

  it("escapes HTML-sensitive characters in job title and company name", () => {
    const result = buildApplicationConfirmationEmail({
      candidateName: "Jane",
      jobTitle: '<img src=x onerror=alert(1)>',
      companyName: "R&D <Team>",
    });

    expect(result.html).not.toContain("<img src=x onerror=alert(1)>");
    expect(result.html).toContain("&lt;img");
    expect(result.html).not.toContain("R&D <Team>");
    expect(result.html).toContain("R&amp;D &lt;Team&gt;");
  });

  it("leaves the plain-text version unescaped (it is not parsed as markup)", () => {
    const result = buildApplicationConfirmationEmail({
      candidateName: "Jane & Jo",
      jobTitle: "Engineer",
      companyName: "Acme",
    });

    expect(result.text).toContain("Jane & Jo");
  });
});
