import { useState } from "react";
import { Mail } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { InviteTeamMemberDialog } from "@/components/settings/InviteTeamMemberDialog";
import { PendingInvitationsTable } from "@/components/settings/PendingInvitationsTable";
import { TeamActionConfirmDialog } from "@/components/settings/TeamActionConfirmDialog";
import { TeamMembersTable } from "@/components/settings/TeamMembersTable";
import { useAuth } from "@/hooks/useAuth";
import { useDeactivateTeamMember } from "@/hooks/useDeactivateTeamMember";
import { useReactivateTeamMember } from "@/hooks/useReactivateTeamMember";
import { useResendTeamInvitation } from "@/hooks/useResendTeamInvitation";
import { useRevokeTeamInvitation } from "@/hooks/useRevokeTeamInvitation";
import { useTeamInvitations } from "@/hooks/useTeamInvitations";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { TeamInvitation, TeamMember } from "@/types/team";

type MemberDialogState = { kind: "deactivate" | "reactivate"; member: TeamMember } | null;

// Settings -> Team Members — ADMIN only (see this ticket's explicit
// Part 3 rule). The backend already enforces this on every endpoint; this
// page-level check exists purely for a clean redirect on direct
// navigation rather than a page full of 403s, since no shared
// role-gating route wrapper exists yet in this codebase.
export function TeamSettingsPage() {
  const { user } = useAuth();
  const { members, isLoading: isLoadingMembers, refetch: refetchMembers } = useTeamMembers();
  const { invitations, isLoading: isLoadingInvitations, refetch: refetchInvitations } = useTeamInvitations();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [memberDialog, setMemberDialog] = useState<MemberDialogState>(null);
  const [revokeTarget, setRevokeTarget] = useState<TeamInvitation | null>(null);

  const { run: runDeactivate, isSubmitting: isDeactivating, error: deactivateError } = useDeactivateTeamMember();
  const { run: runReactivate, isSubmitting: isReactivating, error: reactivateError } = useReactivateTeamMember();
  const { run: runResend } = useResendTeamInvitation();
  const { run: runRevoke, isSubmitting: isRevoking, error: revokeError } = useRevokeTeamInvitation();

  if (user && user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleConfirmMemberAction() {
    if (!memberDialog) return;
    const result =
      memberDialog.kind === "deactivate" ? await runDeactivate(memberDialog.member.id) : await runReactivate(memberDialog.member.id);
    if (result) {
      setMemberDialog(null);
      refetchMembers();
    }
  }

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;
    const result = await runRevoke(revokeTarget.id);
    if (result) {
      setRevokeTarget(null);
      refetchInvitations();
    }
  }

  async function handleResend(invitation: TeamInvitation) {
    const result = await runResend(invitation.id);
    if (result) refetchInvitations();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Team Members"
        description="Manage the people who can access your TalentIQ workspace."
        action={<Button onClick={() => setIsInviteOpen(true)}>Invite HR</Button>}
      />

      <section className="space-y-3">
        {/* Distinct from the page's own "Team Members" H1 — matches
            "Pending Invitations" below for a symmetric section hierarchy. */}
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Members</h2>
        {isLoadingMembers || !members ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <TeamMembersTable
            members={members}
            onDeactivate={(member) => setMemberDialog({ kind: "deactivate", member })}
            onReactivate={(member) => setMemberDialog({ kind: "reactivate", member })}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Pending Invitations</h2>
        {isLoadingInvitations || !invitations ? (
          <Skeleton className="h-32 w-full" />
        ) : invitations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Mail className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No invitations yet.</p>
            </CardContent>
          </Card>
        ) : (
          <PendingInvitationsTable invitations={invitations} onResend={(inv) => void handleResend(inv)} onRevoke={setRevokeTarget} />
        )}
      </section>

      <InviteTeamMemberDialog
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
        onInvited={() => refetchInvitations()}
      />

      <TeamActionConfirmDialog
        open={memberDialog !== null}
        onOpenChange={(open) => !open && setMemberDialog(null)}
        title={memberDialog?.kind === "deactivate" ? "Deactivate team member" : "Reactivate team member"}
        description={
          memberDialog?.kind === "deactivate"
            ? `${memberDialog.member.name} will no longer be able to sign in to TalentIQ. Their historical records are kept.`
            : `${memberDialog?.member.name ?? "This member"} will regain access to TalentIQ.`
        }
        confirmLabel={memberDialog?.kind === "deactivate" ? "Deactivate" : "Reactivate"}
        submittingLabel={memberDialog?.kind === "deactivate" ? "Deactivating…" : "Reactivating…"}
        destructive={memberDialog?.kind === "deactivate"}
        isSubmitting={isDeactivating || isReactivating}
        error={memberDialog?.kind === "deactivate" ? deactivateError : reactivateError}
        onConfirm={() => void handleConfirmMemberAction()}
      />

      <TeamActionConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke invitation"
        description={`The invitation link sent to ${revokeTarget?.email ?? "this address"} will no longer work.`}
        confirmLabel="Revoke"
        submittingLabel="Revoking…"
        destructive
        isSubmitting={isRevoking}
        error={revokeError}
        onConfirm={() => void handleConfirmRevoke()}
      />
    </div>
  );
}
