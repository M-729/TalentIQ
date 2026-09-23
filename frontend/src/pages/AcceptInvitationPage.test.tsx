import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from "react-router-dom";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { AuthProvider } from "@/context/AuthContext";
import * as companyInvitationApi from "@/services/api/companyInvitation";
import * as authApi from "@/services/api/auth";
import type { CompanyInvitationResponseResult } from "@/types/companyInvitation";

vi.mock("@/services/api/companyInvitation");
vi.mock("@/services/api/auth");

function buildResult(overrides: Partial<CompanyInvitationResponseResult> = {}): CompanyInvitationResponseResult {
  return {
    state: "valid",
    company_name: "Acme Technologies",
    invited_email: "sara@acme.test",
    role: "HR",
    expires_at: "2026-10-12T00:00:00.000Z",
    ...overrides,
  };
}

function renderAt(hash: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/accept-invitation${hash}`]}>
        <Routes>
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe("AcceptInvitationPage", () => {
  beforeEach(() => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockReset();
    vi.mocked(companyInvitationApi.acceptCompanyInvitation).mockReset();
    vi.mocked(authApi.refresh).mockReset().mockRejectedValue(new Error("no session"));
  });

  // 20. valid invitation context rendered
  it("20. shows the company name and role for a valid invitation", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    renderAt("#token=abc123");

    expect(await screen.findByText("Join Acme Technologies")).toBeInTheDocument();
    expect(screen.getByText(/HR \/ Recruiter/)).toBeInTheDocument();
  });

  // 21. email read-only
  it("21. shows the invited email as a read-only field", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    renderAt("#token=abc123");

    const emailField = await screen.findByLabelText("Email");
    expect(emailField).toHaveValue("sara@acme.test");
    expect(emailField).toHaveAttribute("readonly");
  });

  // 23. opening page does not accept invitation
  it("23. never calls accept on page load — only lookup", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    renderAt("#token=abc123");

    await screen.findByText("Join Acme Technologies");
    expect(companyInvitationApi.lookupCompanyInvitation).toHaveBeenCalledWith("abc123");
    expect(companyInvitationApi.acceptCompanyInvitation).not.toHaveBeenCalled();
  });

  // 22. password validation
  it("22. shows an error when password and confirm password do not match", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    renderAt("#token=abc123");

    await screen.findByText("Join Acme Technologies");
    await userEvent.type(screen.getByLabelText("Full name"), "Sara Ahmad");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Different123!");
    await userEvent.click(screen.getByRole("button", { name: "Join company" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/do not match/i);
    expect(companyInvitationApi.acceptCompanyInvitation).not.toHaveBeenCalled();
  });

  it("22. enforces a minimum password length", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    renderAt("#token=abc123");

    await screen.findByText("Join Acme Technologies");
    expect(screen.getByLabelText("Password")).toHaveAttribute("minlength", "8");
  });

  // 24. explicit Join company accepts
  it("24. calls accept with the token, name, and password on Join company", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    vi.mocked(companyInvitationApi.acceptCompanyInvitation).mockResolvedValue({
      state: "accepted",
      accessToken: "token-abc",
      user: { id: "u1", name: "Sara Ahmad", email: "sara@acme.test", role: "HR", status: "active", companyId: "c1" },
    });
    renderAt("#token=abc123");

    await screen.findByText("Join Acme Technologies");
    await userEvent.type(screen.getByLabelText("Full name"), "Sara Ahmad");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Password123!");
    await userEvent.click(screen.getByRole("button", { name: "Join company" }));

    await waitFor(() =>
      expect(companyInvitationApi.acceptCompanyInvitation).toHaveBeenCalledWith("abc123", "Sara Ahmad", "Password123!")
    );
    expect(await screen.findByText("Account created successfully")).toBeInTheDocument();
  });

  // 25. rapid double submit protected
  it("25. a rapid double click on Join company sends only one accept request", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    vi.mocked(companyInvitationApi.acceptCompanyInvitation).mockReturnValue(new Promise(() => {}));
    renderAt("#token=abc123");

    await screen.findByText("Join Acme Technologies");
    await userEvent.type(screen.getByLabelText("Full name"), "Sara Ahmad");
    await userEvent.type(screen.getByLabelText("Password"), "Password123!");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Password123!");
    const button = screen.getByRole("button", { name: "Join company" });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(companyInvitationApi.acceptCompanyInvitation).toHaveBeenCalledTimes(1);
  });

  // 26. expired state
  it("26. shows the expired message for an expired invitation", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult({ state: "expired" }));
    renderAt("#token=abc123");

    expect(await screen.findByText("This invitation has expired.")).toBeInTheDocument();
  });

  // 27. revoked state
  it("27. shows a safe unavailable message for a revoked invitation", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult({ state: "revoked" }));
    renderAt("#token=abc123");

    expect(await screen.findByText("This invitation is no longer available.")).toBeInTheDocument();
  });

  // 28. already accepted state
  it("28. shows an already-accepted message when the invitation was already accepted before this page load", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult({ state: "accepted" }));
    renderAt("#token=abc123");

    expect(await screen.findByText("This invitation has already been accepted.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join company" })).not.toBeInTheDocument();
  });

  // 29. invalid state
  it("29. shows a safe invalid message for an invalid token, with no company details", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue({ state: "invalid" });
    renderAt("#token=garbage");

    expect(await screen.findByText("This invitation link is invalid or no longer available.")).toBeInTheDocument();
    expect(screen.queryByText("Acme Technologies")).not.toBeInTheDocument();
  });

  it("shows the same safe invalid state when the URL has no token at all", async () => {
    renderAt("");
    expect(await screen.findByText("This invitation link is invalid or no longer available.")).toBeInTheDocument();
    expect(companyInvitationApi.lookupCompanyInvitation).not.toHaveBeenCalled();
  });

  // Token must not linger in browser URL/history once captured.
  it("removes the token from the URL/history after capturing it", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    const router = createMemoryRouter(
      [{ path: "/accept-invitation", element: <AcceptInvitationPage /> }],
      { initialEntries: ["/accept-invitation#token=abc123"] }
    );
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    );

    await screen.findByText("Join Acme Technologies");
    expect(companyInvitationApi.lookupCompanyInvitation).toHaveBeenCalledWith("abc123");

    await waitFor(() => expect(router.state.location.hash).toBe(""));
    expect(router.state.location.pathname).toBe("/accept-invitation");
  });

  // TalentIQ public branding/navigation appropriate — no candidate-style
  // sidebar, brand + Recruiter login present, same as OfferResponsePage.
  it("renders the TalentIQ public brand, linking to /careers, alongside Recruiter login", async () => {
    vi.mocked(companyInvitationApi.lookupCompanyInvitation).mockResolvedValue(buildResult());
    renderAt("#token=abc123");

    await screen.findByText("Join Acme Technologies");
    const brandLink = screen.getByRole("link", { name: /TalentIQ/ });
    expect(brandLink).toHaveAttribute("href", "/careers");
    const recruiterLoginLink = screen.getByRole("link", { name: "Recruiter login" });
    expect(recruiterLoginLink).toHaveAttribute("href", "/login");
  });
});
