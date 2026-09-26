import { Briefcase, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@/types/job";

// Always derived from the full (unfiltered) job list, independent of
// whatever status filter the table is currently showing — otherwise
// filtering the table would make these counts misleadingly incomplete.
export function JobsStats({ jobs }: { jobs: Job[] }) {
  const stats = [
    { label: "Total Jobs", value: jobs.length, icon: Briefcase, tone: "bg-violet-100 text-violet-600" },
    { label: "Active", value: jobs.filter((j) => j.status === "active").length, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-600" },
    { label: "Draft", value: jobs.filter((j) => j.status === "draft").length, icon: Clock, tone: "bg-amber-100 text-amber-600" },
    { label: "Closed", value: jobs.filter((j) => j.status === "closed").length, icon: XCircle, tone: "bg-rose-100 text-rose-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label}>
          <CardContent className="py-5">
            <span className={`flex size-9 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
