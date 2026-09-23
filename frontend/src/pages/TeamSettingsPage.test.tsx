import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TeamSettingsPage } from "@/pages/TeamSettingsPage";
import * as useAuthModule from "@/hooks/useAuth";
import * as teamApi from "@/services/api/team";
import type { TeamInvitation, TeamMember } from "@/types/team";

vi.mock("@/hooks/useAuth");
vi.mock("@/services/api/team");

function mockAuthUser(role: "ADMIN" | "HR" = "ADMIN") {
  vi.mocked(useAuthModule.useAuth).mockReturnValue({
    user: { id: "admin-1", name: "Mohamad Ali", email: "admin@acme.test", role, status: "active", companyId: "company-1" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    hydrateSession: vi.fn(),
    logout: vi.fn(),
  });
}

function buildMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "member-1",
    name: "Sara Ahmad",
    email: "sara@acme.test",
    role: "HR",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildInvitation(overrides: Partial<TeamInvitation> = {}): TeamInvitation {
  return {
    id: "invitation-1",
    email: "john@acme.test",
    role: "HR",
    status: "pending",
    is_expired: false,
    expires_at: "2026-09-30T00:00:00.000Z",
    invited_by: { id: "admin-1", name: "Mohamad Ali" },
    created_at: "2026-09-23T00:00:00.000Z",
    accepted_at: null,
    revoked_at: null,
    email_status: "sent",
    email_failure_code: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeamSettingsPage />
    </MemoryRouter>
  );
}

describe("TeamSettingsPage", () => {
  beforeEach(() => {
    mockAuthUser("ADMIN");
    vi.mocked(teamApi.listTeamMembers).mockReset().mockResolvedValue({ members: [buildMember()] });
    vi.mocked(teamApi.listTeamInvitations).mockReset().mockResolvedValue({ invitations: [buildInvitation()] });
    vi.mocked(teamApi.inviteTeamMember).mockReset();
    vi.mocked(teamApi.resendTeamInvitation).mockReset();
    vi.mocked(teamApi.revokeTeamInvitation).mockReset();
    vi.mocked(teamApi.deactivateTeamMember).mockReset();
    vi.mocked(teamApi.reactivateTeamMember).mockReset();
  });

  // 8. Settings Team page ADMIN accessible
  it("8. renders for an ADMIN", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Team Members" })).toBeInTheDocument();
  });

  // 18. HR cannot access management UI
  it("18. redirects away for an HR user", async () => {
    mockAuthUser("HR");
    renderPage();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Team Members" })).not.toBeInTheDocument());
  });

  // 9. members render
  it("9. renders team members", async () => {
    renderPage();
    expect(await screen.findByText("Sara Ahmad")).toBeInTheDocument();
    expect(screen.getByText("sara@acme.test")).toBeInTheDocument();
  });

  // 10. pending invitations render
  it("10. renders pending invitations", async () => {
    renderPage();
    expect(await screen.findByText("john@acme.test")).toBeInTheDocument();
    expect(screen.getByText("Email: Sent")).toBeInTheDocument();
  });

  // 11. invite dialog works / 12. email validation
  it("11. opens the invite dialog and sends an invitation with a valid email", async () => {
    vi.mocked(teamApi.inviteTeamMember).mockResolvedValue({ invitation: buildInvitation({ email: "newhire@acme.test" }) });
    renderPage();

    await screen.findByRole("heading", { name: "Team Members" });
    await userEvent.click(screen.getByRole("button", { name: "Invite team member" }));
    await userEvent.type(screen.getByLabelText("Email"), "newhire@acme.test");
    await userEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => expect(teamApi.inviteTeamMember).toHaveBeenCalledWith("newhire@acme.test"));
  });

  it("12. requires a valid email format before submitting", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Team Members" });
    await userEvent.click(screen.getByRole("button", { name: "Invite team member" }));

    const emailField = screen.getByLabelText("Email");
    expect(emailField).toHaveAttribute("type", "email");
    expect(emailField).toBeRequired();
  });

  // 13. Retry failed email
  it("13. shows Retry Email for a failed invitation and calls resend", async () => {
    vi.mocked(teamApi.listTeamInvitations).mockResolvedValue({
      invitations: [buildInvitation({ email_status: "failed" })],
    });
    vi.mocked(teamApi.resendTeamInvitation).mockResolvedValue({ invitation: buildInvitation({ email_status: "sent" }) });
    renderPage();

    await screen.findByText("Email: Failed");
    await userEvent.click(screen.getByRole("button", { name: "Retry Email" }));

    await waitFor(() => expect(teamApi.resendTeamInvitation).toHaveBeenCalledWith("invitation-1"));
  });

  // 14. Resend pending invitation
  it("14. shows Resend for a successfully-sent pending invitation and calls resend", async () => {
    vi.mocked(teamApi.resendTeamInvitation).mockResolvedValue({ invitation: buildInvitation() });
    renderPage();

    await screen.findByText("Email: Sent");
    await userEvent.click(screen.getByRole("button", { name: "Resend" }));

    await waitFor(() => expect(teamApi.resendTeamInvitation).toHaveBeenCalledWith("invitation-1"));
  });

  // 15. Revoke with confirmation
  it("15. revoking an invitation requires confirmation", async () => {
    vi.mocked(teamApi.revokeTeamInvitation).mockResolvedValue({ invitation: buildInvitation({ status: "revoked" }) });
    renderPage();

    await screen.findByText("john@acme.test");
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));

    expect(await screen.findByRole("heading", { name: "Revoke invitation" })).toBeInTheDocument();
    expect(teamApi.revokeTeamInvitation).not.toHaveBeenCalled();

    // The dialog's own Revoke confirm button shares a label with the row
    // trigger — findAllByRole/last-element pattern, same as
    // OfferDecisionSection.test.tsx's Withdraw Offer ambiguity handling.
    const confirmButtons = await screen.findAllByRole("button", { name: "Revoke" });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]!);
    await waitFor(() => expect(teamApi.revokeTeamInvitation).toHaveBeenCalledWith("invitation-1"));
  });

  // 16. deactivate HR with confirmation
  it("16. deactivating a member requires confirmation", async () => {
    vi.mocked(teamApi.deactivateTeamMember).mockResolvedValue({ member: buildMember({ status: "disabled" }) });
    renderPage();

    await screen.findByText("Sara Ahmad");
    await userEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(await screen.findByRole("heading", { name: "Deactivate team member" })).toBeInTheDocument();
    expect(teamApi.deactivateTeamMember).not.toHaveBeenCalled();

    const confirmButtons = await screen.findAllByRole("button", { name: "Deactivate" });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => expect(teamApi.deactivateTeamMember).toHaveBeenCalledWith("member-1"));
  });

  // 17. reactivate HR
  it("17. reactivating a deactivated member calls reactivate", async () => {
    vi.mocked(teamApi.listTeamMembers).mockResolvedValue({ members: [buildMember({ status: "disabled" })] });
    vi.mocked(teamApi.reactivateTeamMember).mockResolvedValue({ member: buildMember({ status: "active" }) });
    renderPage();

    await screen.findByText("Sara Ahmad");
    await userEvent.click(screen.getByRole("button", { name: "Reactivate" }));
    const confirmButtons = await screen.findAllByRole("button", { name: "Reactivate" });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => expect(teamApi.reactivateTeamMember).toHaveBeenCalledWith("member-1"));
  });
});
