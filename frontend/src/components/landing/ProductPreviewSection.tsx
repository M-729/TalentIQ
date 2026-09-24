import { Briefcase, CalendarClock, FileSignature, TrendingUp, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const KPI_PREVIEW = [
  { label: "Open Jobs", value: "12", icon: Briefcase },
  { label: "New Applicants", value: "8", icon: UserPlus },
  { label: "Interviews", value: "5", icon: CalendarClock },
  { label: "Pending Offers", value: "3", icon: FileSignature },
  { label: "Hired", value: "2", icon: TrendingUp },
];

const PIPELINE_PREVIEW = [
  { label: "New Applicants", count: 6 },
  { label: "Review", count: 4 },
  { label: "Interview", count: 3 },
  { label: "Offer", count: 2 },
];

// A static, clearly illustrative composition of existing TalentIQ UI
// concepts (Dashboard KPIs, a pipeline snippet, an interview card, an
// offer status) — never a real customer's data, never a number presented
// as a measured outcome (see this ticket's explicit "no fake live
// metrics" rule). Purely a product-preview visual, not a live component.
export function ProductPreviewSection() {
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-lg" aria-hidden="true">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-destructive/40" />
        <span className="size-2.5 rounded-full bg-warning/40" />
        <span className="size-2.5 rounded-full bg-success/40" />
        <span className="ml-3 text-xs text-muted-foreground">app.talentiq.example — Dashboard</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
        {/* Sidebar strip */}
        <div className="hidden bg-sidebar px-4 py-5 sm:block">
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-block size-4 rotate-45 rounded-[5px] bg-primary" />
            <span className="text-sm font-semibold text-white">TalentIQ</span>
          </div>
          <ul className="space-y-1 text-xs text-sidebar-foreground/80">
            {["Dashboard", "Jobs", "Applications", "Hiring Pipeline", "Interviews", "Offers", "Analytics"].map(
              (item, i) => (
                <li
                  key={item}
                  className={i === 0 ? "rounded-md bg-sidebar-accent px-2 py-1.5 text-white" : "px-2 py-1.5"}
                >
                  {item}
                </li>
              )
            )}
          </ul>
        </div>

        {/* Content preview */}
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {KPI_PREVIEW.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-border bg-background px-3 py-2.5">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <p className="mt-1.5 text-lg font-semibold text-foreground">{value}</p>
                <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Pipeline snippet */}
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Hiring Pipeline</p>
              <div className="space-y-1.5">
                {PIPELINE_PREVIEW.map((stage) => (
                  <div key={stage.label} className="flex items-center justify-between text-xs">
                    <span className="text-foreground">{stage.label}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {stage.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interview + Offer snippet */}
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">Upcoming Interview</p>
                <p className="mt-1 text-sm font-medium text-foreground">Technical Interview</p>
                <p className="text-xs text-muted-foreground">Tomorrow · 10:00 AM</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">Offer Status</p>
                <div className="mt-1.5">
                  <Badge variant="warning">Awaiting response</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
