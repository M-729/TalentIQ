import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import * as useAuthModule from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AppShell />
    </MemoryRouter>
  );
}

// Accessibility baseline (Phase 2) — the mobile off-canvas nav has no Radix
// primitive behind it, so its focus-on-open / Escape-to-close /
// focus-return behavior is hand-wired in AppShell.tsx and is only verified
// here, not by Radix's own test suite.
describe("AppShell — mobile navigation accessibility", () => {
  beforeEach(() => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: { id: "admin-1", name: "Mohamad Ali", email: "admin@acme.test", role: "ADMIN", status: "active", companyId: "company-1" },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      hydrateSession: vi.fn(),
      logout: vi.fn(),
    });
  });

  it("reflects open state on the toggle button via aria-expanded/aria-controls", async () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "mobile-nav-panel");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the panel as an accessible, named modal dialog", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    const panel = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(panel).toHaveAttribute("id", "mobile-nav-panel");
    expect(panel).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus to the first nav link when opened", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    // Desktop and mobile Sidebar instances are both in the DOM (jsdom never
    // applies the `hidden md:flex` CSS that keeps only one visible), so the
    // query is scoped to the dialog panel to check the mobile instance.
    const panel = await screen.findByRole("dialog", { name: "Navigation menu" });
    await waitFor(() => {
      expect(within(panel).getByRole("link", { name: /Dashboard/ })).toHaveFocus();
    });
  });

  it("closes on Escape and returns focus to the toggle button", async () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(toggle);
    await screen.findByRole("dialog", { name: "Navigation menu" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
    });
    expect(toggle).toHaveFocus();
  });

  it("closes when the backdrop is clicked", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Close navigation menu" }));

    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
  });
});
