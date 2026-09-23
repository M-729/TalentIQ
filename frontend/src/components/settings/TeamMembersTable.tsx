import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TeamMember } from "@/types/team";
import type { UserStatus } from "@/types/auth";

const STATUS_CONFIG: Record<UserStatus, { label: string; variant: "neutral" | "success" | "destructive" | "warning" }> = {
  active: { label: "Active", variant: "success" },
  invited: { label: "Invited", variant: "warning" },
  disabled: { label: "Deactivated", variant: "neutral" },
};

const ROLE_LABELS: Record<string, string> = { ADMIN: "Admin", HR: "HR" };

export interface TeamMembersTableProps {
  members: TeamMember[];
  onDeactivate: (member: TeamMember) => void;
  onReactivate: (member: TeamMember) => void;
}

// Professional, compact SaaS density — a plain table, matching
// OffersTable.tsx/AssessmentsTable.tsx exactly. Only HR rows ever get a
// Deactivate/Reactivate action — an ADMIN row never does, since this
// ticket's scope is "Admin can Deactivate/Reactivate HR" only.
export function TeamMembersTable({ members, onDeactivate, onReactivate }: TeamMembersTableProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-3">
                Name
              </th>
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
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                <td className="px-4 py-3 text-foreground">{ROLE_LABELS[member.role] ?? member.role}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_CONFIG[member.status].variant}>{STATUS_CONFIG[member.status].label}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {member.role === "HR" && member.status === "active" && (
                    <Button variant="outline" size="sm" onClick={() => onDeactivate(member)}>
                      Deactivate
                    </Button>
                  )}
                  {member.role === "HR" && member.status === "disabled" && (
                    <Button variant="outline" size="sm" onClick={() => onReactivate(member)}>
                      Reactivate
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
