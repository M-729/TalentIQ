import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";

function renderSidebarAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
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
});
