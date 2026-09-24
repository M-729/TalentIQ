import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_AXIS, CHART_GRID, CHART_PRIMARY } from "@/lib/chartColors";
import type { ApplicationsByJobRow } from "@/types/hiringAnalytics";

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: ApplicationsByJobRow }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{row.job_title}</p>
      <p className="text-muted-foreground">
        {row.count} {row.count === 1 ? "application" : "applications"}
      </p>
    </div>
  );
}

export interface ApplicationsByJobChartProps {
  data: ApplicationsByJobRow[];
}

// Real Job/Application data only — never a fabricated zero-count job (see
// hiringAnalytics.service.ts, which only returns Jobs with at least one
// matching Application), and never another company's Job (company-scoped
// server-side).
export function ApplicationsByJobChart({ data }: ApplicationsByJobChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No application data for this period.</p>;
  }

  // Taller for more jobs, capped so the chart never becomes excessively
  // tall on its own — this ticket's explicit "do not make charts
  // excessively tall" rule.
  const height = Math.min(Math.max(data.length * 36, 160), 420);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={CHART_GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: CHART_AXIS }} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
        {/* No custom tickFormatter — recharts' own <Text> wraps a long
            category label onto a second line (and ellipsizes further if
            it still overflows the given width) natively, which reads
            better than a single hard-truncated line for long job titles. */}
        <YAxis
          type="category"
          dataKey="job_title"
          tick={{ fontSize: 12, fill: CHART_AXIS }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="count" fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
