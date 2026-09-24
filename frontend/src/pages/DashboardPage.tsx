import {
  Briefcase,
  CalendarClock,
  FileSignature,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { formatDateTime } from "@/lib/formatDate";
import type { Dashboard, DashboardApplicationRow, DashboardInterviewRow } from "@/types/dashboard";

const KPI_CARDS: { key: keyof Dashboard["metrics"]; label: string; icon: typeof Briefcase }[] = [
  { key: "open_jobs", label: "Open Jobs", icon: Briefcase },
  { key: "new_applicants", label: "New Applicants", icon: UserPlus },
  { key: "upcoming_interviews", label: "Interviews", icon: CalendarClock },
  { key: "pending_offers", label: "Pending Offers", icon: FileSignature },
  { key: "hired", label: "Hired", icon: TrendingUp },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function stageLabel(row: DashboardApplicationRow): string {
  if (row.status === "hired") return "Hired";
  if (row.status === "rejected") return "Rejected";
  if (row.status === "offered") return "Offer Sent";
  if (row.current_step) return row.current_step.name;
  return "New Applicant";
}


function EmptyCompanyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Briefcase className="size-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="text-lg font-semibold text-foreground">Welcome to TalentIQ</p>
          <p className="text-sm text-muted-foreground">Start by creating your first job.</p>
        </div>
        <Button asChild>
          <Link to="/jobs/new">Create Job</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RecentApplicationsCard({ rows }: { rows: DashboardApplicationRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Applications</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="px-6 py-2">
                    Candidate
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Current Stage
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Applied
                  </th>
                  <th scope="col" className="px-4 py-2 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-6 py-2.5 font-medium text-foreground">{row.candidate.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.job.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{stageLabel(row)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(row.applied_at)}</td>
                    <td className="px-4 py-2.5 pr-6 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/applications/${row.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingInterviewsCard({ rows }: { rows: DashboardInterviewRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Interviews</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No upcoming interviews.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="px-6 py-2">
                    Candidate
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Date/Time
                  </th>
                  <th scope="col" className="px-4 py-2">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-6 py-2.5 font-medium text-foreground">{row.candidate.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.job.title}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateTime(row.starts_at)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="warning">Scheduled</Badge>
                    </td>
                    <td className="px-4 py-2.5 pr-6 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/applications/${row.application_id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NeedsAttentionCard({ attention }: { attention: Dashboard["attention"] }) {
  const items = [
    { count: attention.failed_emails, label: "failed email(s) need attention", to: "/emails?status=failed" },
    { count: attention.assessments_awaiting_result, label: "assessment(s) awaiting a result", to: "/assessments" },
    { count: attention.interviews_awaiting_feedback, label: "interview(s) awaiting feedback", to: "/interviews" },
    { count: attention.offers_awaiting_response, label: "offer(s) awaiting candidate response", to: "/offers" },
    { count: attention.offers_expiring_soon, label: "offer(s) expiring soon", to: "/offers" },
  ].filter((item) => item.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs Attention</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're all caught up — nothing needs attention right now.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="text-foreground">
                    <span className="font-semibold">{item.count}</span> {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Real, company-scoped hiring activity — never mock data (see this
// ticket's explicit "No fake metrics" rule). Answers "what needs my
// attention today?" via one backend endpoint.
export function DashboardPage() {
  const { user } = useAuth();
  const { dashboard, isLoading, error, refetch } = useDashboard();

  const isEmptyCompany =
    dashboard &&
    dashboard.metrics.open_jobs === 0 &&
    dashboard.recent_applications.length === 0 &&
    dashboard.upcoming_interviews.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome${user ? `, ${user.name}` : ""}`} description="Overview of your hiring activity." />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <InlineError title="Couldn't load your dashboard" message={error} onRetry={refetch} />
      ) : !dashboard ? null : isEmptyCompany ? (
        <EmptyCompanyState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {KPI_CARDS.map(({ key, label, icon: Icon }) => (
              <Card key={key}>
                <CardContent className="py-5">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </div>
                  <p className="mt-1 text-2xl font-semibold text-foreground">{dashboard.metrics[key].toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <RecentApplicationsCard rows={dashboard.recent_applications} />
              <UpcomingInterviewsCard rows={dashboard.upcoming_interviews} />
            </div>
            <NeedsAttentionCard attention={dashboard.attention} />
          </div>
        </>
      )}
    </div>
  );
}
