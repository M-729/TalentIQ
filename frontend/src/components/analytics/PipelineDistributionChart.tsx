import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PipelineDistribution } from "@/types/hiringAnalytics";

const CHART_COLOR = "#5546e8"; // --primary
const GRID_COLOR = "#e4e7ec"; // --border
const AXIS_COLOR = "#667085"; // --muted-foreground

const PIPELINE_LABELS: Record<keyof PipelineDistribution, string> = {
  new_applicants: "New Applicants",
  review: "Review",
  interview: "Interview",
  assessment: "Assessment",
  other: "Other",
  offered: "Offered",
  hired: "Hired",
  rejected: "Rejected",
  offer_declined: "Offer Declined",
};

interface PipelineDatum {
  label: string;
  count: number;
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: PipelineDatum }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{row.label}</p>
      <p className="text-muted-foreground">
        {row.count} {row.count === 1 ? "candidate" : "candidates"}
      </p>
    </div>
  );
}

export interface PipelineDistributionChartProps {
  distribution: PipelineDistribution;
}

// A CURRENT STATE snapshot — never a historical conversion funnel, never
// a fabricated conversion percentage (see hiringAnalytics.service.ts's
// own explicit doc comment on this distinction). Only categories with at
// least one candidate are rendered, matching the previous hand-rolled
// chart's behavior.
export function PipelineDistributionChart({ distribution }: PipelineDistributionChartProps) {
  const data: PipelineDatum[] = (Object.keys(distribution) as (keyof PipelineDistribution)[])
    .map((key) => ({ label: PIPELINE_LABELS[key], count: distribution[key] }))
    .filter((datum) => datum.count > 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No candidates are currently in the hiring pipeline.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: AXIS_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={50}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
