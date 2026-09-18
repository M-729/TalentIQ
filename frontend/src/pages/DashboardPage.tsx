import { Briefcase, CalendarClock, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

// Static placeholders only — real metrics are wired up in a later ticket.
// Shown as "—" rather than invented numbers so nothing here reads as real data.
const STAT_CARDS = [
  { label: "Active Jobs", icon: Briefcase },
  { label: "Candidates in Process", icon: Users },
  { label: "Upcoming Interviews", icon: CalendarClock },
  { label: "Hires this Month", icon: TrendingUp },
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
        {STAT_CARDS.map(({ label, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-foreground">—</p>
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
