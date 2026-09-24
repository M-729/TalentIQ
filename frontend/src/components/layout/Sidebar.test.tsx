import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

function renderSidebarAt(path: string, role?: "ADMIN" | "HR") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar role={role} />
    </MemoryRouter>
  );
}

describe("Sidebar navigation", () => {
  it("renders Applications as an enabled link, not a disabled placeholder", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Applications" });
    expect(link).toHaveAttribute("href", "/applications");
  });

  it("highlights Applications on /applications", () => {
    renderSidebarAt("/applications");
    expect(screen.getByRole("link", { name: "Applications" })).toHaveClass("bg-sidebar-accent");
  });

  it("highlights Applications on /applications/:id", () => {
    renderSidebarAt("/applications/app-1");
    expect(screen.getByRole("link", { name: "Applications" })).toHaveClass("bg-sidebar-accent");
  });

  it("highlights Applications on /applications/:id/screening", () => {
    renderSidebarAt("/applications/app-1/screening");
    expect(screen.getByRole("link", { name: "Applications" })).toHaveClass("bg-sidebar-accent");
  });

  it("does not highlight Jobs while on an application/screening route", () => {
    renderSidebarAt("/applications/app-1/screening");
    expect(screen.getByRole("link", { name: "Jobs" })).not.toHaveClass("bg-sidebar-accent");
  });

  it("renders Hiring Pipeline as an enabled link, not a disabled placeholder", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Hiring Pipeline" });
    expect(link).toHaveAttribute("href", "/hiring-pipeline");
  });

  it("highlights Hiring Pipeline on /hiring-pipeline", () => {
    renderSidebarAt("/hiring-pipeline");
    expect(screen.getByRole("link", { name: "Hiring Pipeline" })).toHaveClass("bg-sidebar-accent");
  });

  it("does not highlight Jobs or Applications while on /hiring-pipeline", () => {
    renderSidebarAt("/hiring-pipeline");
    expect(screen.getByRole("link", { name: "Jobs" })).not.toHaveClass("bg-sidebar-accent");
    expect(screen.getByRole("link", { name: "Applications" })).not.toHaveClass("bg-sidebar-accent");
  });

  it("does not highlight Hiring Pipeline while on Jobs or Applications routes", () => {
    renderSidebarAt("/jobs");
    expect(screen.getByRole("link", { name: "Hiring Pipeline" })).not.toHaveClass("bg-sidebar-accent");
  });

  it("renders Interviews as an enabled link, not a disabled placeholder", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Interviews" });
    expect(link).toHaveAttribute("href", "/interviews");
  });

  it("highlights Interviews on /interviews", () => {
    renderSidebarAt("/interviews");
    expect(screen.getByRole("link", { name: "Interviews" })).toHaveClass("bg-sidebar-accent");
  });

  it("highlights Interviews on /interviews/:id", () => {
    renderSidebarAt("/interviews/interview-1");
    expect(screen.getByRole("link", { name: "Interviews" })).toHaveClass("bg-sidebar-accent");
  });

  it("renders Settings as an enabled link pointing at Integrations", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Settings" });
    expect(link).toHaveAttribute("href", "/settings/integrations");
  });

  it("highlights Settings on /settings/integrations", () => {
    renderSidebarAt("/settings/integrations");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveClass("bg-sidebar-accent");
  });

  it("renders Offers as an enabled link, not a disabled placeholder", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Offers" });
    expect(link).toHaveAttribute("href", "/offers");
  });

  it("highlights Offers on /offers", () => {
    renderSidebarAt("/offers");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveClass("bg-sidebar-accent");
  });

  it("shows Team for an ADMIN, linking to /settings/team", () => {
    renderSidebarAt("/dashboard", "ADMIN");
    const link = screen.getByRole("link", { name: "Team" });
    expect(link).toHaveAttribute("href", "/settings/team");
  });

  it("never shows Team for an HR user", () => {
    renderSidebarAt("/dashboard", "HR");
    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
    expect(screen.queryByText("Team")).not.toBeInTheDocument();
  });

  it("never shows Team when role is not yet known (session still loading)", () => {
    renderSidebarAt("/dashboard");
    expect(screen.queryByRole("link", { name: "Team" })).not.toBeInTheDocument();
  });

  it("never renders a standalone Candidates destination", () => {
    renderSidebarAt("/dashboard");
    expect(screen.queryByRole("link", { name: "Candidates" })).not.toBeInTheDocument();
    expect(screen.queryByText("Candidates")).not.toBeInTheDocument();
  });

  it("renders Emails as an enabled link, not a disabled placeholder", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Emails" });
    expect(link).toHaveAttribute("href", "/emails");
  });

  it("highlights Emails on /emails", () => {
    renderSidebarAt("/emails");
    expect(screen.getByRole("link", { name: "Emails" })).toHaveClass("bg-sidebar-accent");
  });

  it("renders Analytics as an enabled link, not a disabled placeholder", () => {
    renderSidebarAt("/dashboard");
    const link = screen.getByRole("link", { name: "Analytics" });
    expect(link).toHaveAttribute("href", "/analytics");
  });

  it("highlights Analytics on /analytics", () => {
    renderSidebarAt("/analytics");
    expect(screen.getByRole("link", { name: "Analytics" })).toHaveClass("bg-sidebar-accent");
  });

  // Phase 4 shell redesign — active state must be more than color alone.
  it("marks the active link with aria-current, and no other link", () => {
    renderSidebarAt("/offers");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Jobs" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Applications" })).not.toHaveAttribute("aria-current");
  });

  it("gives the active link a non-color indicator (left border) in addition to its background", () => {
    renderSidebarAt("/offers");
    expect(screen.getByRole("link", { name: "Offers" })).toHaveClass("border-primary");
    expect(screen.getByRole("link", { name: "Jobs" })).not.toHaveClass("border-primary");
  });
});
