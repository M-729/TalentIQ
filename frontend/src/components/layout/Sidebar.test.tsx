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
});
