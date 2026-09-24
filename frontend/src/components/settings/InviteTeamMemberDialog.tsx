import { useState, type FormEvent } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconInput } from "@/components/ui/icon-input";
import { Label } from "@/components/ui/label";
import { useInviteTeamMember } from "@/hooks/useInviteTeamMember";
import type { TeamInvitation } from "@/types/team";

export interface InviteTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (invitation: TeamInvitation) => void;
}

// No role selector — every invitation through this dialog is always HR
// (see this ticket's explicit "Do NOT allow arbitrary ADMIN creation
// through invitations" rule); the server decides the role regardless of
// what this dialog sends.
export function InviteTeamMemberDialog({ open, onOpenChange, onInvited }: InviteTeamMemberDialogProps) {
  const { run, isSubmitting, error, clearError } = useInviteTeamMember();
  const [email, setEmail] = useState("");

  function handleOpenChange(next: boolean) {
    if (isSubmitting) return;
    if (!next) {
      setEmail("");
      clearError();
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const invitation = await run(email);
    if (invitation) {
      setEmail("");
      onInvited(invitation);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite HR</DialogTitle>
          <DialogDescription>Send a secure invitation to join your TalentIQ workspace as HR / Recruiter.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <IconInput
              icon={Mail}
              id="invite-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
