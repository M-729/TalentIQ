import {
  Briefcase,
  CalendarClock,
  ChevronDown,
  FileSignature,
  FolderKanban,
  LayoutGrid,
  Mail,
  Search,
  Send,
  Settings,
  TrendingUp,
  Users,
  UserPlus,
  UsersRound,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { icon: LayoutGrid, label: "Dashboard", active: true },
  { icon: Briefcase, label: "Jobs" },
  { icon: FolderKanban, label: "Applications" },
  { icon: Users, label: "Hiring Pipeline" },
  { icon: ClipboardCheck, label: "Assessments" },
  { icon: CalendarClock, label: "Interviews" },
  { icon: Mail, label: "Emails" },
  { icon: Send, label: "Offers" },
  { icon: BarChart3, label: "Analytics" },
];

const SECONDARY_NAV = [
  { icon: Settings, label: "Settings" },
  { icon: UsersRound, label: "Team" },
];

const STATS = [
  { label: "Open Jobs", value: "6", icon: Briefcase, tone: "bg-violet-100 text-violet-600" },
  { label: "New Applicants", value: "12", icon: UserPlus, tone: "bg-rose-100 text-rose-600" },
  { label: "Interviews", value: "4", icon: CalendarClock, tone: "bg-blue-100 text-blue-600" },
  { label: "Pending Offers", value: "3", icon: FileSignature, tone: "bg-amber-100 text-amber-600" },
  { label: "Hired", value: "8", icon: TrendingUp, tone: "bg-emerald-100 text-emerald-600" },
];

const APPLICATIONS = [
  { initials: "YS", name: "Yara Saleh", job: "Backend Developer", stage: "Interview", date: "Sep 26, 2026" },
  { initials: "OK", name: "Omar Khaled", job: "UI/UX Designer", stage: "Assessment", date: "Sep 25, 2026" },
  { initials: "LN", name: "Layla Nassar", job: "Frontend Developer", stage: "Interview", date: "Sep 24, 2026" },
  { initials: "KB", name: "Karim Boulos", job: "Product Manager", stage: "Offer Sent", date: "Sep 22, 2026" },
  { initials: "SR", name: "Sara Rahal", job: "Data Analyst", stage: "New Applicant", date: "Sep 22, 2026" },
];

const STAGE_STYLES: Record<string, string> = {
  Interview: "bg-blue-500/10 text-blue-700",
  Assessment: "bg-warning/10 text-warning",
  "Offer Sent": "bg-amber-500/10 text-amber-700",
  "New Applicant": "bg-muted text-muted-foreground",
};

const AVATAR_TONES: Record<string, string> = {
  YS: "bg-violet-100 text-violet-700",
  OK: "bg-rose-100 text-rose-700",
  LN: "bg-blue-100 text-blue-700",
  KB: "bg-amber-100 text-amber-700",
  SR: "bg-emerald-100 text-emerald-700",
};

function StagePill({ stage }: { stage: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold ${STAGE_STYLES[stage]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {stage}
    </span>
  );
}

// A static product illustration assembled from real TalentIQ concepts and
// pages (Dashboard's own KPI/Recent Applications/Needs Attention layout)
// for the marketing landing page only — this component is never rendered
// inside the authenticated app, and the names/counts here are fixed
// sample content, never live customer data.
export function ProductPreviewSection() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -left-6 -top-8 hidden text-primary/70 sm:block"
        aria-hidden="true"
      >
        <svg width="28" height="40" viewBox="0 0 28 40" fill="none">
          <path d="M4 2L2 14M24 6L18 16M14 2L12 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <div
        className="pointer-events-none absolute -right-8 -bottom-8 -z-10 hidden size-full rounded-3xl bg-[linear-gradient(135deg,#4B3EDD,#8B7CF6)] opacity-90 sm:block"
        aria-hidden="true"
      />

      <div
        className="overflow-hidden rounded-2xl border border-[#e4e6f0] bg-white shadow-[0_30px_60px_rgba(30,27,75,0.18)] sm:rotate-1"
        aria-hidden="true"
      >
        <div className="grid grid-cols-[10.5rem_minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)]">
          <aside className="hidden bg-[#121a33] px-3 py-4 text-[#b8c0dd] sm:flex sm:flex-col sm:justify-between">
            <div>
              <div className="mb-6 flex items-center gap-2 px-1 text-sm font-bold text-white">
                <span className="flex size-6 items-center justify-center rounded-md bg-[#5546e8]">
                  <LayoutGrid className="size-3.5" />
                </span>
                TalentIQ
              </div>
              <ul className="space-y-1 text-[11px] font-medium">
                {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
                  <li
                    key={label}
                    className={
                      active
                        ? "flex items-center gap-2 rounded-md bg-[#5546e8] px-2.5 py-2 text-white"
                        : "flex items-center gap-2 px-2.5 py-2"
                    }
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <ul className="space-y-1 border-t border-white/10 pt-3 text-[11px] font-medium">
              {SECONDARY_NAV.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 px-2.5 py-2">
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[#e4e6f0] bg-[#f7f8fc] px-2.5 py-1.5 text-[10px] text-[#9199b5]">
                <Search className="size-3 shrink-0" />
                <span className="truncate">Search candidates, jobs, or anything...</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#e9e6ff] text-[9px] font-bold text-[#5546e8]">
                  MA
                </span>
                <span className="hidden text-[10px] font-semibold text-[#252940] sm:inline">Muhammad Ali</span>
                <ChevronDown className="size-3 text-[#9199b5]" />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-bold text-[#15172b] sm:text-base">
                Welcome back, <span className="text-[#5546e8]">Muhammad Ali</span>
              </p>
              <p className="text-[10px] text-[#747a91]">Here's an overview of your hiring activity.</p>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STATS.map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="rounded-lg border border-[#e4e6f0] bg-white px-2.5 py-2">
                  <span className={`flex size-5 items-center justify-center rounded ${tone}`}>
                    <Icon className="size-3" />
                  </span>
                  <p className="mt-1.5 truncate text-[8px] font-medium text-[#8991ac]">{label}</p>
                  <p className="text-sm font-bold text-[#15172b]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(8.5rem,0.65fr)]">
              <div className="overflow-hidden rounded-lg border border-[#e4e6f0] bg-white">
                <div className="flex items-center justify-between border-b border-[#e7e9f0] px-3 py-2">
                  <p className="text-[11px] font-bold text-[#252940]">Recent Applications</p>
                  <span className="text-[9px] font-semibold text-[#5546e8]">View all</span>
                </div>
                <div className="divide-y divide-[#eff0f5]">
                  {APPLICATIONS.map((row) => (
                    <div key={row.name} className="flex items-center gap-2 px-3 py-1.5">
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold ${AVATAR_TONES[row.initials]}`}
                      >
                        {row.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9px] font-semibold text-[#252940]">{row.name}</p>
                        <p className="truncate text-[8px] text-[#9199b5]">{row.job}</p>
                      </div>
                      <StagePill stage={row.stage} />
                      <span className="hidden shrink-0 text-[8px] text-[#9ca1b5] md:block">{row.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden flex-col gap-2 sm:flex">
                <div className="flex items-center justify-between rounded-lg border border-[#e4e6f0] bg-white px-2.5 py-1.5">
                  <p className="text-[10px] font-bold text-[#252940]">Needs Attention</p>
                  <Badge variant="destructive" className="px-1.5 text-[8px]">
                    2
                  </Badge>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-[#e4e6f0] bg-white p-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600">
                    <CalendarClock className="size-3.5" />
                  </span>
                  <p className="text-[8px] leading-relaxed text-[#5b6178]">
                    <span className="font-semibold text-[#252940]">4 interview(s)</span> awaiting feedback.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-[#e4e6f0] bg-white p-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                    <FileSignature className="size-3.5" />
                  </span>
                  <p className="text-[8px] leading-relaxed text-[#5b6178]">
                    <span className="font-semibold text-[#252940]">3 offer(s)</span> awaiting a response.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
