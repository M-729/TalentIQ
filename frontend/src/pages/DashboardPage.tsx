import { Briefcase, CalendarClock, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Static placeholders only — real metrics are wired up in a later ticket.
// Shown as "—" rather than invented numbers so nothing here reads as real data.
const STAT_CARDS = [
  { label: "Active Jobs", icon: Briefcase, tint: "bg-primary/10 text-primary" },
  { label: "Candidates in Process", icon: Users, tint: "bg-success/10 text-success" },
  { label: "Upcoming Interviews", icon: CalendarClock, tint: "bg-warning/10 text-warning" },
  { label: "Hires this Month", icon: TrendingUp, tint: "bg-primary/10 text-primary" },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome{user ? `, ${user.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here's an overview of your recruitment activity.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ label, icon: Icon, tint }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tint)}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold text-foreground">—</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recruitment analytics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Detailed analytics and funnel reporting are coming in a later update.
        </CardContent>
      </Card>
    </div>
  );
}
