import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TeamInvitation } from "@/types/team";

const ROLE_LABELS: Record<string, string> = { ADMIN: "Admin", HR: "HR" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusBadge(invitation: TeamInvitation): { label: string; variant: "neutral" | "success" | "destructive" | "warning" } {
  if (invitation.status === "accepted") return { label: "Accepted", variant: "success" };
  if (invitation.status === "revoked") return { label: "Revoked", variant: "neutral" };
  if (invitation.is_expired) return { label: "Expired", variant: "destructive" };
  return { label: "Pending", variant: "warning" };
}

function emailStatusLabel(invitation: TeamInvitation): string {
  if (invitation.email_status === "sent") return "Sent";
  if (invitation.email_status === "failed") return "Failed";
  return "Pending";
}

export interface PendingInvitationsTableProps {
  invitations: TeamInvitation[];
  onResend: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
}

// Professional, compact SaaS density — matches TeamMembersTable.tsx and
// OffersTable.tsx exactly. Resend/Retry Email are the same action under
// the hood (see useResendTeamInvitation.ts) — only the button LABEL
// differs, based on whether the last delivery attempt succeeded or failed.
export function PendingInvitationsTable({ invitations, onResend, onRevoke }: PendingInvitationsTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-3">
                Email
              </th>
              <th scope="col" className="px-4 py-3">
                Role
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Invited
              </th>
              <th scope="col" className="px-4 py-3">
                Expires
              </th>
              <th scope="col" className="px-4 py-3">
                Email
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => {
              const badge = statusBadge(invitation);
              const isActionable = invitation.status === "pending";
              return (
                <tr key={invitation.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3 text-foreground">{invitation.email}</td>
                  <td className="px-4 py-3 text-foreground">{ROLE_LABELS[invitation.role] ?? invitation.role}</td>
                  <td className="px-4 py-3">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(invitation.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(invitation.expires_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    Email: {emailStatusLabel(invitation)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isActionable && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onResend(invitation)}>
                          {invitation.email_status === "failed" ? "Retry Email" : "Resend"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onRevoke(invitation)}>
                          Revoke
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
