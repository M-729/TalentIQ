import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage", () => {
  // 1. `/` renders LandingPage — covered directly here; router-level
  // coverage (that "/" actually mounts this page) lives in router.test.tsx.
  it("1. renders the hero headline", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Hire smarter/i, level: 1 })).toBeInTheDocument();
  });

  // 2. Start Free -> /signup
  it("2. Start Free links to /signup", () => {
    renderPage();
    const startFreeLinks = screen.getAllByRole("link", { name: "Start Free" });
    expect(startFreeLinks.length).toBeGreaterThan(0);
    startFreeLinks.forEach((link) => expect(link).toHaveAttribute("href", "/signup"));
  });

  // 3. Recruiter login -> /login
  it("3. Recruiter login links to /login", () => {
    renderPage();
    // Casing normalized to match PublicHeader's "Recruiter login" elsewhere
    // in the public site.
    const links = screen.getAllByRole("link", { name: "Recruiter login" });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/login"));
  });

  // 4. Browse Open Jobs -> /careers
  it("4. Browse Open Jobs links to /careers", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Browse Open Jobs" })).toHaveAttribute("href", "/careers");
  });

  it("final CTA links to /signup and /careers", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Create your TalentIQ workspace" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Browse open positions" })).toHaveAttribute("href", "/careers");
  });

  // 5. main feature sections render
  it("5. renders the core feature sections", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Everything hiring teams need" })).toBeInTheDocument();
    expect(screen.getByText("AI-Assisted CV Screening")).toBeInTheDocument();
    expect(screen.getByText("Dynamic Hiring Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Interview Scheduling")).toBeInTheDocument();
    expect(screen.getByText("External Assessments")).toBeInTheDocument();
    expect(screen.getByText("Offers & Final Decisions")).toBeInTheDocument();
    expect(screen.getByText("Hiring Analytics")).toBeInTheDocument();
  });

  it("renders the How it works steps in order", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByText("Create your workspace")).toBeInTheDocument();
    expect(screen.getByText("Hire")).toBeInTheDocument();
  });

  // 6. AI trust section renders
  it("6. renders the AI trust section with its explicit product principles", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "AI assists. Your team decides." })).toBeInTheDocument();
    expect(screen.getByText(/never rejects a candidate automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/never hires a candidate automatically/i)).toBeInTheDocument();
  });

  // 7. no fake candidate account CTA
  it("7. never invites a candidate to create an account", () => {
    renderPage();
    expect(screen.queryByText(/candidate.*(sign up|create an account|register)/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/No candidate account required/i).length).toBeGreaterThan(0);
  });

  it("never claims AI autonomously hires or rejects candidates", () => {
    renderPage();
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/AI chooses the best candidate/i);
    expect(bodyText).not.toMatch(/AI hires for you/i);
    expect(bodyText).not.toMatch(/guaranteed better hires/i);
  });

  it("never claims unearned security certifications", () => {
    renderPage();
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toMatch(/SOC ?2/i);
    expect(bodyText).not.toMatch(/ISO ?27001/i);
    expect(bodyText).not.toMatch(/HIPAA/i);
    expect(bodyText).not.toMatch(/GDPR.?compliant/i);
  });

  // 8. mobile nav accessible
  it("8. the mobile menu toggle opens an accessible navigation panel", async () => {
    renderPage();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Two elements share aria-label="Main" (the always-in-DOM desktop nav,
    // hidden purely via a CSS class jsdom never actually applies, and the
    // conditionally-rendered mobile panel) — disambiguated by the mobile
    // panel's own id, which the toggle's aria-controls also points at.
    const mobileNav = document.getElementById("landing-mobile-menu");
    expect(mobileNav).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-controls", "landing-mobile-menu");
  });

  it("13. never renders authenticated sidebar navigation", () => {
    renderPage();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Applications" })).not.toBeInTheDocument();
  });
});
