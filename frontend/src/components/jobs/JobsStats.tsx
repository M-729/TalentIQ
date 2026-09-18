import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Job } from "@/types/job";

// Always derived from the full (unfiltered) job list, independent of
// whatever status filter the table is currently showing — otherwise
// filtering the table would make these counts misleadingly incomplete.
export function JobsStats({ jobs }: { jobs: Job[] }) {
  const stats = [
    { label: "Total Jobs", value: jobs.length },
    { label: "Active", value: jobs.filter((j) => j.status === "active").length },
    { label: "Draft", value: jobs.filter((j) => j.status === "draft").length },
    { label: "Closed", value: jobs.filter((j) => j.status === "closed").length },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
