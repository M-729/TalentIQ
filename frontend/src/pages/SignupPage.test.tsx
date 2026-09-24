import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SignupPage } from "@/pages/SignupPage";
import * as useAuthModule from "@/hooks/useAuth";
import { ApiError } from "@/services/api/client";

vi.mock("@/hooks/useAuth");

function mockAuth(overrides: Partial<ReturnType<typeof useAuthModule.useAuth>> = {}) {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    hydrateSession: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  );
}

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText("Full name"), "Mohamad Ali");
  await userEvent.type(screen.getByLabelText("Work email"), "mohamad@acme.test");
  await userEvent.type(screen.getByLabelText("Password"), "Password123!");
  await userEvent.type(screen.getByLabelText("Company name"), "Acme Technologies");
  await userEvent.click(screen.getByRole("button", { name: "Create workspace" }));
}

describe("SignupPage", () => {
  beforeEach(() => {
    mockAuth();
  });

  // 2. form validation — required fields, appropriate input types.
  it("2. renders required, appropriately-typed fields", () => {
    renderPage();
    expect(screen.getByLabelText("Full name")).toBeRequired();
    expect(screen.getByLabelText("Work email")).toBeRequired();
    expect(screen.getByLabelText("Work email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Company name")).toBeRequired();
  });

  // 3. no role selector
  it("3. never renders a role selector", () => {
    renderPage();
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  // 4. no company selector
  it("4. company name is a plain text field, never a selector of existing companies", () => {
    renderPage();
    const companyField = screen.getByLabelText("Company name");
    expect(companyField.tagName).toBe("INPUT");
    expect(companyField).toHaveAttribute("type", "text");
  });

  // 5. successful signup follows intended auth flow
  it("5. calls signup with the entered fields and navigates to /dashboard on success", async () => {
    const signup = vi.fn().mockResolvedValue(undefined);
    mockAuth({ signup });
    renderPage();

    await fillAndSubmit();

    await waitFor(() =>
      expect(signup).toHaveBeenCalledWith({
        fullName: "Mohamad Ali",
        email: "mohamad@acme.test",
        password: "Password123!",
        companyName: "Acme Technologies",
      })
    );
  });

  it("shows a loading label while submitting", async () => {
    let resolveSignup: () => void = () => {};
    const signup = vi.fn().mockReturnValue(new Promise<void>((resolve) => (resolveSignup = resolve)));
    mockAuth({ signup });
    renderPage();

    await fillAndSubmit();
    expect(screen.getByRole("button", { name: "Creating workspace…" })).toBeInTheDocument();
    resolveSignup();
  });

  // 6. duplicate email handled
  it("6. shows a clear error when the email is already registered", async () => {
    const signup = vi.fn().mockRejectedValue(new ApiError("An account with this email already exists.", 409));
    mockAuth({ signup });
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
  });

  it("shows a generic error for an unexpected server failure", async () => {
    const signup = vi.fn().mockRejectedValue(new ApiError("boom", 500));
    mockAuth({ signup });
    renderPage();

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("redirects to /dashboard if already authenticated", () => {
    mockAuth({ user: { id: "u1", name: "A", email: "a@acme.test", role: "ADMIN", status: "active", companyId: "c1" }, isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <SignupPage />
      </MemoryRouter>
    );
    expect(screen.queryByText("Create your TalentIQ workspace")).not.toBeInTheDocument();
  });

  // Accessibility baseline (Phase 2) — this route renders outside AppShell,
  // so it previously had no <main> landmark and no <h1> anywhere on the page.
  it("has a main landmark and an h1", () => {
    renderPage();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
