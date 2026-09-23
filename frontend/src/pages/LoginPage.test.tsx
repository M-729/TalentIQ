import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import * as useAuthModule from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  it("shows a Browse Open Positions link pointing to /careers", () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      hydrateSession: vi.fn(),
      logout: vi.fn(),
    });
    renderPage();

    const link = screen.getByRole("link", { name: "Browse open positions" });
    expect(link).toHaveAttribute("href", "/careers");
  });

  // 7. Login links to Create company
  it("7. shows a Create company link pointing to /signup", () => {
    vi.mocked(useAuthModule.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      hydrateSession: vi.fn(),
      logout: vi.fn(),
    });
    renderPage();

    const link = screen.getByRole("link", { name: "Create company" });
    expect(link).toHaveAttribute("href", "/signup");
  });
});
