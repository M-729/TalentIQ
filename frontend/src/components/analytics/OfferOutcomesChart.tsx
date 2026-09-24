import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_STATUS_COLORS as COLORS } from "@/lib/chartColors";
import type { OfferOutcomes } from "@/types/hiringAnalytics";

const LABELS: Record<keyof typeof COLORS, string> = {
  accepted: "Accepted",
  declined: "Declined",
  pending: "Pending",
  withdrawn: "Withdrawn",
};

interface OutcomeDatum {
  key: keyof typeof COLORS;
  label: string;
  count: number;
}

function TooltipContent({ active, payload }: { active?: boolean; payload?: { payload: OutcomeDatum }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-foreground">{row.label}</p>
      <p className="text-muted-foreground">
        {row.count} {row.count === 1 ? "offer" : "offers"}
      </p>
    </div>
  );
}

export interface OfferOutcomesChartProps {
  outcomes: OfferOutcomes;
}

// Draft Offers are never candidate outcomes and are excluded upstream by
// the backend — this component only ever sees accepted/declined/pending/
// withdrawn. "Resolved Offers" in the center is accepted + declined,
// computed here directly from the existing response fields — no new
// backend metric was added just for this decorative text (see this
// ticket's explicit rule).
export function OfferOutcomesChart({ outcomes }: OfferOutcomesChartProps) {
  const data: OutcomeDatum[] = (Object.keys(LABELS) as (keyof typeof COLORS)[])
    .map((key) => ({ key, label: LABELS[key], count: outcomes[key] }))
    .filter((datum) => datum.count > 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No offer outcomes yet.</p>;
  }

  const resolved = outcomes.accepted + outcomes.declined;
  const total = data.reduce((sum, datum) => sum + datum.count, 0);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {data.map((datum) => (
                <Cell key={datum.key} fill={COLORS[datum.key]} />
              ))}
            </Pie>
            <Tooltip content={<TooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{resolved}</span>
          <span className="text-xs text-muted-foreground">Resolved Offers</span>
        </div>
      </div>

      {/* Text legend — outcomes must be understandable without relying on
          color alone (this ticket's explicit accessibility rule). */}
      <ul className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-1">
        {data.map((datum) => (
          <li key={datum.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[datum.key] }} aria-hidden="true" />
              {datum.label}
            </span>
            <span className="font-medium text-muted-foreground">
              {datum.count} ({total > 0 ? Math.round((datum.count / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
