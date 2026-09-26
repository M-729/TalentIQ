import {
  Bell,
  Briefcase,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  FileSignature,
  Mail,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineError } from "@/components/ui/inline-error";
import { InterviewStatusBadge } from "@/components/interviews/InterviewStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";
import { formatDateTime } from "@/lib/formatDate";
import { resourceUrlId } from "@/lib/resourceUrlId";
import { INTERVIEW_STATUSES, type InterviewStatus } from "@/types/interview";
import type { Dashboard, DashboardApplicationRow, DashboardInterviewRow } from "@/types/dashboard";

// dashboard.service.ts's own query is `status: "scheduled"` at read time, so
// row.status is provably always "scheduled" today — but the DTO types it as
// a plain string, not the InterviewStatus union, so this stays a real
// runtime check rather than a cast, and falls back to the raw value instead
// of crashing if that query is ever relaxed server-side.
function isKnownInterviewStatus(status: string): status is InterviewStatus {
  return (INTERVIEW_STATUSES as readonly string[]).includes(status);
}

const KPI_CARDS: {
  key: keyof Dashboard["metrics"];
  label: string;
  icon: typeof Briefcase;
  tone: string;
  iconTone: string;
}[] = [
  { key: "open_jobs", label: "Open Jobs", icon: Briefcase, tone: "bg-violet-50/60 border-violet-100", iconTone: "bg-violet-100 text-violet-600" },
  { key: "new_applicants", label: "New Applicants", icon: UserPlus, tone: "bg-rose-50/60 border-rose-100", iconTone: "bg-rose-100 text-rose-600" },
  { key: "upcoming_interviews", label: "Interviews", icon: CalendarClock, tone: "bg-blue-50/60 border-blue-100", iconTone: "bg-blue-100 text-blue-600" },
  { key: "pending_offers", label: "Pending Offers", icon: FileSignature, tone: "bg-amber-50/60 border-amber-100", iconTone: "bg-amber-100 text-amber-600" },
  { key: "hired", label: "Hired", icon: TrendingUp, tone: "bg-emerald-50/60 border-emerald-100", iconTone: "bg-emerald-100 text-emerald-600" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function stageLabel(row: DashboardApplicationRow): string {
  if (row.status === "hired") return "Hired";
  if (row.status === "rejected") return "Rejected";
  if (row.status === "offered") return "Offer Sent";
  if (row.current_step) return row.current_step.name;
  return "New Applicant";
}

function stageBadgeVariant(row: DashboardApplicationRow): BadgeProps["variant"] {
  if (row.status === "hired") return "success";
  if (row.status === "rejected") return "destructive";
  if (row.status === "offered") return "warning";
  return "neutral";
}

function CandidateCell({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {getInitials(name)}
      </span>
      <span className="font-medium text-foreground">{name}</span>
    </div>
  );
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
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent Applications</CardTitle>
        <Link to="/applications" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="px-6 py-2.5">
                    Candidate
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Current Stage
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Applied
                  </th>
                  <th scope="col" className="px-4 py-2.5 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-6 py-3">
                      <CandidateCell name={row.candidate.name} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.job.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant={stageBadgeVariant(row)}>{stageLabel(row)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(row.applied_at)}</td>
                    <td className="px-4 py-3 pr-6 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/applications/${resourceUrlId(row)}`}>View</Link>
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
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Upcoming Interviews</CardTitle>
        <Link to="/interviews" className="text-sm font-medium text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarClock className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-1 text-sm font-semibold text-foreground">No upcoming interviews</p>
            <p className="text-xs text-muted-foreground">You're all caught up. New interviews will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th scope="col" className="px-6 py-2.5">
                    Candidate
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Date/Time
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-6 py-3">
                      <CandidateCell name={row.candidate.name} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.job.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.starts_at)}</td>
                    <td className="px-4 py-3">
                      {isKnownInterviewStatus(row.status) ? (
                        <InterviewStatusBadge status={row.status} />
                      ) : (
                        <Badge variant="neutral">{row.status}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 pr-6 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/applications/${row.application_public_id}`}>View</Link>
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

const ATTENTION_ICONS: Record<string, { icon: typeof Bell; tone: string }> = {
  failed_emails: { icon: Mail, tone: "bg-rose-100 text-rose-600" },
  assessments_awaiting_result: { icon: ClipboardCheck, tone: "bg-blue-100 text-blue-600" },
  interviews_awaiting_feedback: { icon: CalendarClock, tone: "bg-violet-100 text-violet-600" },
  offers_awaiting_response: { icon: FileSignature, tone: "bg-amber-100 text-amber-600" },
  offers_expiring_soon: { icon: FileSignature, tone: "bg-amber-100 text-amber-600" },
};

function NeedsAttentionCard({ attention }: { attention: Dashboard["attention"] }) {
  const items = [
    { key: "failed_emails", count: attention.failed_emails, label: "failed email(s) need attention", to: "/emails?status=failed", description: "Review and retry the emails that didn't send." },
    { key: "assessments_awaiting_result", count: attention.assessments_awaiting_result, label: "assessment(s) awaiting a result", to: "/assessments", description: "Record the outcome to keep candidates moving." },
    { key: "interviews_awaiting_feedback", count: attention.interviews_awaiting_feedback, label: "interview(s) awaiting feedback", to: "/interviews", description: "Your feedback is needed to move the candidate(s) forward." },
    { key: "offers_awaiting_response", count: attention.offers_awaiting_response, label: "offer(s) awaiting candidate response", to: "/offers", description: "Follow up with candidate(s) to finalize the offer." },
    { key: "offers_expiring_soon", count: attention.offers_expiring_soon, label: "offer(s) expiring soon", to: "/offers", description: "These offers will expire without a response soon." },
  ].filter((item) => item.count > 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" aria-hidden="true" />
          Needs Attention
        </CardTitle>
        {items.length > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">
            {items.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're all caught up — nothing needs attention right now.</p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => {
              const { icon: Icon, tone } = ATTENTION_ICONS[item.key];
              return (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    className="flex items-start gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {item.count} {item.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{user ? <>, <span className="text-primary">{user.name}</span></> : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Here's an overview of your hiring activity.</p>
      </div>

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
            {KPI_CARDS.map(({ key, label, icon: Icon, tone, iconTone }) => (
              <Card key={key} className={tone}>
                <CardContent className="py-5">
                  <span className={`flex size-9 items-center justify-center rounded-lg ${iconTone}`}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
                    {dashboard.metrics[key].toLocaleString()}
                  </p>
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
