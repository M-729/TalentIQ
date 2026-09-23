import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatPeriodLabel } from "@/lib/analyticsFormat";
import type { AnalyticsRange, ApplicationsOverTimePoint } from "@/types/hiringAnalytics";

const CHART_COLOR = "#5546e8"; // --primary
const GRID_COLOR = "#e4e7ec"; // --border
const AXIS_COLOR = "#667085"; // --muted-foreground

function TooltipContent({
  active,
  payload,
  range,
}: {
  active?: boolean;
  payload?: { payload: ApplicationsOverTimePoint }[];
  range: AnalyticsRange;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{formatPeriodLabel(point.period, range)}</p>
      <p className="text-muted-foreground">
        {point.count} {point.count === 1 ? "application" : "applications"}
      </p>
    </div>
  );
}

export interface ApplicationsOverTimeChartProps {
  data: ApplicationsOverTimePoint[];
  range: AnalyticsRange;
}

// Real applied_at-based counts from the backend — no client-side
// aggregation, no mock data (see this ticket's explicit rules).
export function ApplicationsOverTimeChart({ data, range }: ApplicationsOverTimeChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No applications in this period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(value: string) => formatPeriodLabel(value, range)}
          tick={{ fontSize: 12, fill: AXIS_COLOR }}
          axisLine={{ stroke: GRID_COLOR }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={32} />
        <Tooltip content={<TooltipContent range={range} />} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={CHART_COLOR}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLOR }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
